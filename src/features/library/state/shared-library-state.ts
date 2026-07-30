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

export type SharedLibraryDocumentStatus = {
  status: "active" | "deleted" | "archived" | "purged" | "not_found";
  slug: string;
  documentId?: string;
  title?: string;
  deletedAt?: string;
  archivedAt?: string;
  hidden?: boolean;
  recordVersion?: number;
  deletionAudit?: LibraryDocumentDeletionAudit;
};

export type SharedLibraryIntegrityStatus = {
  status: "healthy" | "repaired" | "blocked";
  checksum: string;
  unacknowledgedIncidentCount: number;
};

export type SharedLibraryMutationResult = {
  operation: "document.update";
  documentId: string;
  document: ManagedLibraryDocument;
  recordVersion: number;
  lifecycleState: "active" | "deleted" | "archived";
};

export type SharedLibraryResponse = {
  initialized: boolean;
  state: SharedLibraryState;
  revision: number;
  recordVersions: SharedLibraryRecordVersions;
  updatedAt: string | null;
  updatedBy: string | null;
  snapshotAt?: string;
  recoveryDocumentCount?: number;
  archivedDocumentCount?: number;
  integrityStatus?: SharedLibraryIntegrityStatus;
  documentStatus?: SharedLibraryDocumentStatus;
  deletionAudit?: SharedLibraryDeletionAudit;
  restoredCount?: number;
  mutationResult?: SharedLibraryMutationResult;
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

function parseDocumentStatus(value: unknown): SharedLibraryDocumentStatus | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entry = value as Record<string, unknown>;
  if (!["active", "deleted", "archived", "purged", "not_found"].includes(String(entry.status)) || typeof entry.slug !== "string") return null;
  if (entry.documentId !== undefined && typeof entry.documentId !== "string") return null;
  if (entry.title !== undefined && typeof entry.title !== "string") return null;
  if (entry.deletedAt !== undefined && (typeof entry.deletedAt !== "string" || !Number.isFinite(Date.parse(entry.deletedAt)))) return null;
  if (entry.archivedAt !== undefined && (typeof entry.archivedAt !== "string" || !Number.isFinite(Date.parse(entry.archivedAt)))) return null;
  if (entry.hidden !== undefined && typeof entry.hidden !== "boolean") return null;
  if (entry.recordVersion !== undefined && (!Number.isInteger(entry.recordVersion) || Number(entry.recordVersion) < 0)) return null;
  let deletionAudit: LibraryDocumentDeletionAudit | undefined;
  if (entry.deletionAudit !== undefined) {
    const parsed = parseDeletionAudit({ documents: { status: entry.deletionAudit } });
    deletionAudit = parsed?.documents.status;
    if (!deletionAudit) return null;
  }
  return {
    status: entry.status as SharedLibraryDocumentStatus["status"],
    slug: entry.slug,
    ...(typeof entry.documentId === "string" ? { documentId: entry.documentId } : {}),
    ...(typeof entry.title === "string" ? { title: entry.title } : {}),
    ...(typeof entry.deletedAt === "string" ? { deletedAt: entry.deletedAt } : {}),
    ...(typeof entry.archivedAt === "string" ? { archivedAt: entry.archivedAt } : {}),
    ...(typeof entry.hidden === "boolean" ? { hidden: entry.hidden } : {}),
    ...(entry.recordVersion === undefined ? {} : { recordVersion: Number(entry.recordVersion) }),
    ...(deletionAudit ? { deletionAudit } : {}),
  };
}

function parseMutationResult(value: unknown): SharedLibraryMutationResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entry = value as Record<string, unknown>;
  if (entry.operation !== "document.update"
    || typeof entry.documentId !== "string"
    || !Number.isInteger(entry.recordVersion)
    || Number(entry.recordVersion) < 1
    || !["active", "deleted", "archived"].includes(String(entry.lifecycleState))) return null;
  const parsed = parseAdminLibraryState(JSON.stringify({ version: 1, documents: [entry.document] }));
  const document = parsed?.documents[0];
  if (!document || parsed?.documents.length !== 1 || document.id !== entry.documentId) return null;
  return {
    operation: "document.update",
    documentId: entry.documentId,
    document,
    recordVersion: Number(entry.recordVersion),
    lifecycleState: entry.lifecycleState as SharedLibraryMutationResult["lifecycleState"],
  };
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
  if (candidate.snapshotAt !== undefined && (typeof candidate.snapshotAt !== "string" || !Number.isFinite(Date.parse(candidate.snapshotAt)))) return null;
  if (candidate.recoveryDocumentCount !== undefined && (!Number.isInteger(candidate.recoveryDocumentCount) || Number(candidate.recoveryDocumentCount) < 0)) return null;
  if (candidate.archivedDocumentCount !== undefined && (!Number.isInteger(candidate.archivedDocumentCount) || Number(candidate.archivedDocumentCount) < 0)) return null;
  let integrityStatus: SharedLibraryIntegrityStatus | undefined;
  if (candidate.integrityStatus !== undefined) {
    if (!candidate.integrityStatus || typeof candidate.integrityStatus !== "object" || Array.isArray(candidate.integrityStatus)) return null;
    const integrity = candidate.integrityStatus as Record<string, unknown>;
    if (!["healthy", "repaired", "blocked"].includes(String(integrity.status))
      || typeof integrity.checksum !== "string"
      || !Number.isInteger(integrity.unacknowledgedIncidentCount)
      || Number(integrity.unacknowledgedIncidentCount) < 0) return null;
    integrityStatus = {
      status: integrity.status as SharedLibraryIntegrityStatus["status"],
      checksum: integrity.checksum,
      unacknowledgedIncidentCount: Number(integrity.unacknowledgedIncidentCount),
    };
  }
  const documentStatus = candidate.documentStatus === undefined ? undefined : parseDocumentStatus(candidate.documentStatus);
  if (candidate.documentStatus !== undefined && !documentStatus) return null;
  const deletionAudit = candidate.deletionAudit === undefined ? undefined : parseDeletionAudit(candidate.deletionAudit);
  if (candidate.deletionAudit !== undefined && !deletionAudit) return null;
  const mutationResult = candidate.mutationResult === undefined ? undefined : parseMutationResult(candidate.mutationResult);
  if (candidate.mutationResult !== undefined && !mutationResult) return null;
  if (candidate.restoredCount !== undefined && (!Number.isInteger(candidate.restoredCount) || Number(candidate.restoredCount) < 0)) return null;
  return {
    initialized: candidate.initialized,
    state,
    revision: Number(candidate.revision),
    recordVersions: { documents, categories },
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
    updatedBy: typeof candidate.updatedBy === "string" ? candidate.updatedBy : null,
    ...(typeof candidate.snapshotAt === "string" ? { snapshotAt: candidate.snapshotAt } : {}),
    recoveryDocumentCount: candidate.recoveryDocumentCount === undefined
      ? state.documents.filter(document => document.deletedAt).length
      : Number(candidate.recoveryDocumentCount),
    archivedDocumentCount: candidate.archivedDocumentCount === undefined
      ? state.documents.filter(document => document.archivedAt).length
      : Number(candidate.archivedDocumentCount),
    ...(integrityStatus ? { integrityStatus } : {}),
    ...(documentStatus ? { documentStatus } : {}),
    ...(deletionAudit ? { deletionAudit } : {}),
    ...(candidate.restoredCount === undefined ? {} : { restoredCount: Number(candidate.restoredCount) }),
    ...(mutationResult ? { mutationResult } : {}),
  };
}
