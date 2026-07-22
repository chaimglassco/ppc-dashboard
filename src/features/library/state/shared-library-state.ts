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

export type SharedLibraryResponse = {
  initialized: boolean;
  state: SharedLibraryState;
  revision: number;
  recordVersions: SharedLibraryRecordVersions;
  updatedAt: string | null;
  updatedBy: string | null;
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
  return {
    initialized: candidate.initialized,
    state,
    revision: Number(candidate.revision),
    recordVersions: { documents, categories },
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : null,
    updatedBy: typeof candidate.updatedBy === "string" ? candidate.updatedBy : null,
  };
}
