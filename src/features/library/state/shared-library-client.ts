import { withPpcBasePath } from "@/lib/glassco-apps";
import { getPipelineAuthorizationHeader } from "@/lib/pipeline-session";
import type { ManagedLibraryDocument } from "./admin-storage";
import type { ManagedCategory } from "./category-storage";
import { parseSharedLibraryResponse, type SharedLibraryResponse, type SharedLibraryState } from "./shared-library-state";

export const SHARED_LIBRARY_CACHE_KEY = "glassco-library-confirmed-cache-v2";
export const SHARED_LIBRARY_REQUEST_TIMEOUT_MS = 18_000;

export type SharedLibraryReadOptions = { summary?: boolean; slug?: string };

export class SharedLibraryTimeoutError extends Error {
  constructor() {
    super("The shared library took too long to respond.");
    this.name = "SharedLibraryTimeoutError";
  }
}

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

function sharedLibraryUrl(options: SharedLibraryReadOptions = {}) {
  const params = new URLSearchParams();
  if (options.summary) params.set("summary", "1");
  if (options.slug) params.set("slug", options.slug);
  const query = params.toString();
  return `${withPpcBasePath("/api/library")}${query ? `?${query}` : ""}`;
}

export function getSharedLibraryCacheKey(options: SharedLibraryReadOptions = {}) {
  return options.slug ? `${SHARED_LIBRARY_CACHE_KEY}:document:${encodeURIComponent(options.slug)}` : SHARED_LIBRARY_CACHE_KEY;
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

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const parentSignal = init.signal;
  let timedOut = false;
  const abortFromParent = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) abortFromParent();
  else parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, SHARED_LIBRARY_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new SharedLibraryTimeoutError();
    throw error;
  } finally {
    window.clearTimeout(timer);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}

export async function fetchSharedLibraryState(signal?: AbortSignal, options: SharedLibraryReadOptions = {}): Promise<SharedLibraryResponse> {
  const value = await readJson(await fetchWithTimeout(sharedLibraryUrl(options), {
    cache: "no-store",
    headers: getPipelineAuthorizationHeader(),
    signal,
  }));
  const parsed = parseSharedLibraryResponse(value);
  if (!parsed) throw new Error("Shared library returned invalid data.");
  return parsed;
}

export async function mutateSharedLibrary(mutation: SharedLibraryMutation, options: SharedLibraryReadOptions = {}): Promise<SharedLibraryResponse> {
  const value = await readJson(await fetchWithTimeout(sharedLibraryUrl(options), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getPipelineAuthorizationHeader() },
    body: JSON.stringify(mutation),
  }));
  const parsed = parseSharedLibraryResponse(value);
  if (!parsed) throw new Error("Shared library returned invalid data.");
  return parsed;
}

export async function initializeCleanLibrary(): Promise<SharedLibraryResponse> {
  const value = await readJson(await fetchWithTimeout(withPpcBasePath("/api/library/migration"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getPipelineAuthorizationHeader() },
    body: JSON.stringify({ action: "initialize-clean-catalog" }),
  }));
  const parsed = parseSharedLibraryResponse(value);
  if (!parsed) throw new Error("Library migration returned invalid data.");
  return parsed;
}

export function cacheSharedLibraryResponse(response: SharedLibraryResponse, storage: Pick<Storage, "setItem">, options: SharedLibraryReadOptions = {}): boolean {
  try { storage.setItem(getSharedLibraryCacheKey(options), JSON.stringify(response)); return true; } catch { return false; }
}

export function readCachedSharedLibraryResponse(storage: Pick<Storage, "getItem">, options: SharedLibraryReadOptions = {}): SharedLibraryResponse | null {
  try {
    const raw = storage.getItem(getSharedLibraryCacheKey(options));
    return raw ? parseSharedLibraryResponse(JSON.parse(raw)) : null;
  } catch { return null; }
}

export async function hydrateSharedLibraryState(storage: Storage, signal?: AbortSignal, options: SharedLibraryReadOptions = {}): Promise<{ response: SharedLibraryResponse; source: "server" | "cache" }> {
  try {
    const response = await fetchSharedLibraryState(signal, options);
    cacheSharedLibraryResponse(response, storage, options);
    return { response, source: "server" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    const cached = readCachedSharedLibraryResponse(storage, options);
    if (!cached) throw error;
    return { response: cached, source: "cache" };
  }
}
