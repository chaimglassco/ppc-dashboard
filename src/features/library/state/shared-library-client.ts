import { withPpcBasePath } from "@/lib/glassco-apps";
import { getPipelineAuthorizationHeader } from "@/lib/pipeline-session";
import type { ManagedLibraryDocument } from "./admin-storage";
import type { ManagedCategory } from "./category-storage";
import { parseSharedLibraryResponse, type SharedLibraryResponse, type SharedLibraryState } from "./shared-library-state";

export const SHARED_LIBRARY_CACHE_KEY = "glassco-library-confirmed-cache-v2";

export type SharedLibraryMutation =
  | { operation: "catalog.initialize"; state: SharedLibraryState; expectedRevision: 0 }
  | { operation: "document.create"; document: ManagedLibraryDocument }
  | { operation: "document.update"; documentId: string; expectedVersion: number; document: ManagedLibraryDocument }
  | { operation: "document.delete" | "document.restore"; documentId: string; expectedVersion: number }
  | { operation: "documents.reorder"; documentIds: string[]; expectedRevision: number }
  | { operation: "category.create"; category: ManagedCategory }
  | { operation: "category.update"; categoryId: string; expectedVersion: number; category: ManagedCategory }
  | { operation: "category.delete" | "category.restore"; categoryId: string; expectedVersion: number }
  | { operation: "categories.reorder"; categoryIds: string[]; expectedRevision: number };

export class SharedLibraryConflictError extends Error {
  constructor(public readonly latest: SharedLibraryResponse) {
    super("The shared library changed in another session. The latest version has been loaded.");
  }
}

async function readJson(response: Response): Promise<unknown> {
  let value: unknown = null;
  try { value = await response.json(); } catch { /* handled below */ }
  if (!response.ok) {
    const parsed = parseSharedLibraryResponse(value);
    if (response.status === 409 && parsed) throw new SharedLibraryConflictError(parsed);
    const message = value && typeof value === "object" && typeof (value as Record<string, unknown>).error === "string"
      ? String((value as Record<string, unknown>).error)
      : "Shared library request failed.";
    throw new Error(message);
  }
  return value;
}

export async function fetchSharedLibraryState(signal?: AbortSignal): Promise<SharedLibraryResponse> {
  const value = await readJson(await fetch(withPpcBasePath("/api/library"), {
    cache: "no-store",
    headers: getPipelineAuthorizationHeader(),
    signal,
  }));
  const parsed = parseSharedLibraryResponse(value);
  if (!parsed) throw new Error("Shared library returned invalid data.");
  return parsed;
}

export async function mutateSharedLibrary(mutation: SharedLibraryMutation): Promise<SharedLibraryResponse> {
  const value = await readJson(await fetch(withPpcBasePath("/api/library"), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getPipelineAuthorizationHeader() },
    body: JSON.stringify(mutation),
  }));
  const parsed = parseSharedLibraryResponse(value);
  if (!parsed) throw new Error("Shared library returned invalid data.");
  return parsed;
}

export async function initializeCleanLibrary(): Promise<SharedLibraryResponse> {
  const value = await readJson(await fetch(withPpcBasePath("/api/library/migration"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getPipelineAuthorizationHeader() },
    body: JSON.stringify({ action: "initialize-clean-catalog" }),
  }));
  const parsed = parseSharedLibraryResponse(value);
  if (!parsed) throw new Error("Library migration returned invalid data.");
  return parsed;
}

export function cacheSharedLibraryResponse(response: SharedLibraryResponse, storage: Pick<Storage, "setItem">): boolean {
  try { storage.setItem(SHARED_LIBRARY_CACHE_KEY, JSON.stringify(response)); return true; } catch { return false; }
}

export function readCachedSharedLibraryResponse(storage: Pick<Storage, "getItem">): SharedLibraryResponse | null {
  try {
    const raw = storage.getItem(SHARED_LIBRARY_CACHE_KEY);
    return raw ? parseSharedLibraryResponse(JSON.parse(raw)) : null;
  } catch { return null; }
}

export async function hydrateSharedLibraryState(storage: Storage, signal?: AbortSignal): Promise<{ response: SharedLibraryResponse; source: "server" | "cache" }> {
  try {
    const response = await fetchSharedLibraryState(signal);
    cacheSharedLibraryResponse(response, storage);
    return { response, source: "server" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    const cached = readCachedSharedLibraryResponse(storage);
    if (!cached) throw error;
    return { response: cached, source: "cache" };
  }
}
