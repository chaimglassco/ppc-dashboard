import type { LibraryDocument } from "../domain/types";
import { ADMIN_LIBRARY_KEY, readAdminDocuments, writeAdminDocuments } from "./admin-storage";
import { ADMIN_CATEGORIES_KEY, readAdminCategories, writeAdminCategories } from "./category-storage";
import { mergeLocalIntoShared, mergeLocalOnlyIntoShared, parseSharedLibraryState, type SharedLibraryResponse, type SharedLibraryState } from "./shared-library-state";

const SHARED_MIGRATION_KEY = "glassco-library-shared-migration-v1";

async function readJson(response: Response) {
  const value: unknown = await response.json();
  if (!response.ok) {
    const message = value && typeof value === "object" && typeof (value as Record<string, unknown>).error === "string" ? String((value as Record<string, unknown>).error) : "Shared library request failed.";
    throw new Error(message);
  }
  return value;
}

export async function fetchSharedLibraryState(): Promise<SharedLibraryResponse> {
  const value = await readJson(await fetch("/api/library", { cache: "no-store" }));
  if (!value || typeof value !== "object") throw new Error("Shared library returned an invalid response.");
  const response = value as Record<string, unknown>;
  const state = parseSharedLibraryState(response.state);
  if (!state) throw new Error("Shared library returned invalid data.");
  return { initialized: response.initialized === true, state };
}

export async function saveSharedLibraryState(state: SharedLibraryState): Promise<SharedLibraryState> {
  const value = await readJson(await fetch("/api/library", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state }),
  }));
  if (!value || typeof value !== "object") throw new Error("Shared library returned an invalid response.");
  const saved = parseSharedLibraryState((value as Record<string, unknown>).state);
  if (!saved) throw new Error("Shared library returned invalid data.");
  return saved;
}

export function cacheSharedLibraryState(state: SharedLibraryState, storage: Storage) {
  writeAdminDocuments(state.documents, storage);
  writeAdminCategories(state.categories, storage);
}

export async function hydrateSharedLibraryState(seed: LibraryDocument[], storage: Storage): Promise<SharedLibraryState> {
  const localDocuments = readAdminDocuments(seed, storage);
  const localCategories = readAdminCategories(storage);
  const response = await fetchSharedLibraryState();
  const hasLocalAdminState = Boolean(storage.getItem(ADMIN_LIBRARY_KEY) || storage.getItem(ADMIN_CATEGORIES_KEY));
  const needsLegacyMigration = hasLocalAdminState && storage.getItem(SHARED_MIGRATION_KEY) !== "complete";
  let state = response.state;

  if (hasLocalAdminState) {
    const migrated: SharedLibraryState = response.initialized
      ? needsLegacyMigration
        ? mergeLocalIntoShared(response.state, localDocuments, localCategories)
        : mergeLocalOnlyIntoShared(response.state, localDocuments, localCategories)
      : { version: 1, documents: localDocuments, categories: localCategories };
    if (JSON.stringify(migrated) !== JSON.stringify(response.state)) state = await saveSharedLibraryState(migrated);
    if (needsLegacyMigration) storage.setItem(SHARED_MIGRATION_KEY, "complete");
  }

  cacheSharedLibraryState(state, storage);
  return state;
}
