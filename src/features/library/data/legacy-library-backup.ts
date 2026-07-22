import { get, put } from "@vercel/blob";
import { createHash } from "node:crypto";
import { parseSharedLibraryState, type SharedLibraryState } from "../state/shared-library-state";

const LEGACY_STATE_PATH = "glassco/library-state-v1.json";
const LEGACY_BACKUP_DIRECTORY = "glassco/library-backups";

export class LegacyLibraryBackupError extends Error {
  constructor(public readonly code: "BLOB_NOT_CONFIGURED" | "LEGACY_SNAPSHOT_MISSING" | "LEGACY_SNAPSHOT_INVALID", message: string) {
    super(message);
    this.name = "LegacyLibraryBackupError";
  }
}

export type LegacyLibrarySnapshot = {
  body: string;
  checksum: string;
  state: SharedLibraryState;
};

export type LegacyLibraryBackup = {
  pathname: string;
  checksum: string;
  size: number;
  documentCount: number;
  created: boolean;
};

export type LegacyCleanupReport = {
  activeDocuments: 2;
  newlyTombstoned: number;
  previouslyTombstoned: number;
  keepDocuments: Array<{ id: string; slug: string; title: string }>;
};

const CLEAN_CATALOG_TITLES = Object.freeze([
  "Sample Document with all the elements",
  "Checking Spenders with No Sales",
]);

function assertBlobConfigured() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new LegacyLibraryBackupError("BLOB_NOT_CONFIGURED", "The legacy Library Blob store is not configured.");
  }
}

function checksum(body: string) {
  return createHash("sha256").update(body).digest("hex");
}

export async function readLegacyLibrarySnapshot(): Promise<LegacyLibrarySnapshot> {
  assertBlobConfigured();
  const result = await get(LEGACY_STATE_PATH, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) {
    throw new LegacyLibraryBackupError("LEGACY_SNAPSHOT_MISSING", "The legacy Library snapshot does not exist.");
  }
  const body = await new Response(result.stream).text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new LegacyLibraryBackupError("LEGACY_SNAPSHOT_INVALID", "The legacy Library snapshot is not valid JSON.");
  }
  const state = parseSharedLibraryState(parsed);
  if (!state) {
    throw new LegacyLibraryBackupError("LEGACY_SNAPSHOT_INVALID", "The legacy Library snapshot failed schema validation.");
  }
  return { body, checksum: checksum(body), state };
}

export async function ensureLegacyLibraryBackup(snapshot?: LegacyLibrarySnapshot): Promise<LegacyLibraryBackup> {
  const source = snapshot ?? await readLegacyLibrarySnapshot();
  const pathname = `${LEGACY_BACKUP_DIRECTORY}/library-state-v1-${source.checksum}.json`;
  const existing = await get(pathname, { access: "private", useCache: false });
  if (existing?.statusCode === 200) {
    return {
      pathname,
      checksum: source.checksum,
      size: Buffer.byteLength(source.body),
      documentCount: source.state.documents.length,
      created: false,
    };
  }
  let created = true;
  try {
    await put(pathname, source.body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
  } catch (error) {
    const concurrent = await get(pathname, { access: "private", useCache: false });
    if (concurrent?.statusCode !== 200) throw error;
    created = false;
  }
  return {
    pathname,
    checksum: source.checksum,
    size: Buffer.byteLength(source.body),
    documentCount: source.state.documents.length,
    created,
  };
}

export function createCleanLegacyCatalog(state: SharedLibraryState, deletedAt = new Date().toISOString()): { state: SharedLibraryState; report: LegacyCleanupReport } {
  const parsedTimestamp = new Date(deletedAt);
  if (Number.isNaN(parsedTimestamp.valueOf())) throw new LegacyLibraryBackupError("LEGACY_SNAPSHOT_INVALID", "The cleanup timestamp is invalid.");
  const timestamp = parsedTimestamp.toISOString();
  const matches = new Map(CLEAN_CATALOG_TITLES.map(title => [title, state.documents.filter(document => document.title === title)]));
  for (const title of CLEAN_CATALOG_TITLES) {
    const documents = matches.get(title) ?? [];
    if (documents.length !== 1) {
      throw new LegacyLibraryBackupError("LEGACY_SNAPSHOT_INVALID", `Expected exactly one legacy document titled "${title}", found ${documents.length}.`);
    }
  }
  const keepIds = new Set([...matches.values()].flat().map(document => document.id));
  let newlyTombstoned = 0;
  let previouslyTombstoned = 0;
  const documents = state.documents.map(document => {
    if (keepIds.has(document.id)) {
      const restored = { ...document };
      delete restored.deletedAt;
      return restored;
    }
    if (document.deletedAt) {
      previouslyTombstoned += 1;
      return { ...document };
    }
    newlyTombstoned += 1;
    return { ...document, deletedAt: timestamp };
  });
  const keepDocuments = documents.filter(document => keepIds.has(document.id)).map(document => ({ id: document.id, slug: document.slug, title: document.title }));
  return {
    state: { ...state, documents },
    report: { activeDocuments: 2, newlyTombstoned, previouslyTombstoned, keepDocuments },
  };
}
