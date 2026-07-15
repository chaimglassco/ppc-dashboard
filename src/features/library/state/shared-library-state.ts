import type { LibraryDocument } from "../domain/types";
import { mergeAdminDocuments, parseAdminLibraryState, type ManagedLibraryDocument } from "./admin-storage";
import { createDefaultCategories, parseCategoryState, type ManagedCategory } from "./category-storage";

export type SharedLibraryState = {
  version: 1;
  documents: ManagedLibraryDocument[];
  categories: ManagedCategory[];
};

export type SharedLibraryResponse = {
  initialized: boolean;
  state: SharedLibraryState;
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

export function mergeSharedLibraryState(seed: LibraryDocument[], stored: SharedLibraryState | null): SharedLibraryState {
  const defaults = createDefaultCategories();
  if (!stored) return createSharedLibraryState(seed);
  const categoryIds = new Set(stored.categories.map(category => category.id));
  return {
    version: 1,
    documents: mergeAdminDocuments(seed, { version: 1, documents: stored.documents }),
    categories: [...stored.categories, ...defaults.filter(category => !categoryIds.has(category.id))],
  };
}

export function mergeLocalOnlyIntoShared(shared: SharedLibraryState, localDocuments: ManagedLibraryDocument[], localCategories: ManagedCategory[]): SharedLibraryState {
  const documentIds = new Set(shared.documents.map(document => document.id));
  const categoryIds = new Set(shared.categories.map(category => category.id));
  return {
    version: 1,
    documents: [...shared.documents, ...localDocuments.filter(document => !documentIds.has(document.id))],
    categories: [...shared.categories, ...localCategories.filter(category => !categoryIds.has(category.id))],
  };
}
