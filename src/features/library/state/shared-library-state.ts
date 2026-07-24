import type { LibraryDocument } from "../domain/types";
import { parseAdminLibraryState, type ManagedLibraryDocument } from "./admin-storage";
import { createDefaultCategories, parseCategoryState, type ManagedCategory } from "./category-storage";

export type SharedLibraryState = {
  version: 1;
  documents: ManagedLibraryDocument[];
  categories: ManagedCategory[];
};

export type SharedLibraryRecordVersions = {
  documents: Record<string, number>;
  categories: Record<string, number>;
};

export type LibraryDeletionSource = "user" | "system_migration" | "system_backup_restore" | "unknown";

export type LibraryAuditActor = {
  name: string;
  email: string;
  role: "ADMIN" | "USER" | "VIEWER";
};

export type LibraryDocumentDeletionAudit = {
  source: LibraryDeletionSource;
  deletedAt: string;
  reason: string;
  actor: LibraryAuditActor | null;
  initiatedBy: LibraryAuditActor | null;
};

export type SharedLibraryDeletionAudit = {
  documents: Record<string, LibraryDocumentDeletionAudit>;
};

export type SharedLibraryResponse = {
  initialized: boolean;
  state: SharedLibraryState;
  revision: number;
  recordVersions: SharedLibraryRecordVersions;
  updatedAt: string | null;
  updatedBy: string | null;
  deletionAudit?: SharedLibraryDeletionAudit;
  restoredCount?: number;
};

export function parseSharedLibraryState(value: unknown): SharedLibraryState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1) return null;
  const documents = parseAdminLibraryState(JSON.stringify({ version: 1, documents: candidate.documents }));
  const categories = parseCategoryState(JSON.stringify({ version: 1, categories: candidate.categories }));
  if (!documents || !categories) return null;
  return { version: 1, documents: documents.documents, categories: categories.categories };
}

export function createSharedLibraryState(seed: LibraryDocument[]): SharedLibraryState {
  return { version: 1, documents: seed.map(document => ({ ...document })), categories: createDefaultCategories() };
}

function parseVersionMap(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.every(([, version]) => Number.isInteger(version) && Number(version) >= 0)) return null;
  return Object.fromEntries(entries.map(([id, version]) => [id, Number(version)]));
}

function parseAuditActor(value: unknown): LibraryAuditActor | null | undefined {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const actor = value as Record<string, unknown>;
  if (typeof actor.name !== "string" || typeof actor.email !== "string" || !["ADMIN", "USER", "VIEWER"].includes(String(actor.role))) return undefined;
  return { name: actor.name, email: actor.email, role: actor.role as LibraryAuditActor["role"] };
}

function parseDeletionAudit(value: unknown): SharedLibraryDeletionAudit | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const documentsValue = (value as Record<string, unknown>).documents;
  if (!documentsValue || typeof documentsValue !== "object" || Array.isArray(documentsValue)) return null;
  const entries: Array<[string, LibraryDocumentDeletionAudit]> = [];
  for (const [id, entryValue] of Object.entries(documentsValue as Record<string, unknown>)) {
    if (!entryValue || typeof entryValue !== "object" || Array.isArray(entryValue)) return null;
    const entry = entryValue as Record<string, unknown>;
    const actor = parseAuditActor(entry.actor);
    const initiatedBy = parseAuditActor(entry.initiatedBy);
    if (!["user", "system_migration", "system_backup_restore", "unknown"].includes(String(entry.source))
      || typeof entry.deletedAt !== "string"
      || !Number.isFinite(Date.parse(entry.deletedAt))
      || typeof entry.reason !== "string"
      || actor === undefined
      || initiatedBy === undefined) return null;
    entries.push([id, {
      source: entry.source as LibraryDeletionSource,
      deletedAt: entry.deletedAt,
      reason: entry.reason,
      actor,
      initiatedBy,
    }]);
  }
  return { documents: Object.fromEntries(entries) };
}

export function parseSharedLibraryResponse(value: unknown): SharedLibraryResponse | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const state = parseSharedLibraryState(candidate.state);
  const versions = candidate.recordVersions as Record<string, unknown> | undefined;
  const documents = parseVersionMap(versions?.documents);
  const categories = parseVersionMap(versions?.categories);
  if (typeof candidate.initialized !== "boolean" || !state || !Number.isInteger(candidate.revision) || Number(candidate.revision) < 0 || !documents || !categories) return null;
  if (candidate.updatedAt !== null && candidate.updatedAt !== undefined && typeof candidate.updatedAt !== "string") return null;
  if (candidate.updatedBy !== null && candidate.updatedBy !== undefined && typeof candidate.updatedBy !== "string") return null;
  const deletionAudit = candidate.deletionAudit === undefined ? undefined : parseDeletionAudit(candidate.deletionAudit);
  if (candidate.deletionAudit !== undefined && !deletionAudit) return null;
  if (candidate.restoredCount !== undefined && (!Number.isInteger(candidate.restoredCount) || Number(candidate.restoredCount) < 0)) return null;
  return {
    initialized: candidate.initialized,
    state,
    revision: Number(candidate.revision),
    recordVersions: { documents, categories },
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
    updatedBy: typeof candidate.updatedBy === "string" ? candidate.updatedBy : null,
    ...(deletionAudit ? { deletionAudit } : {}),
    ...(candidate.restoredCount === undefined ? {} : { restoredCount: Number(candidate.restoredCount) }),
  };
}
