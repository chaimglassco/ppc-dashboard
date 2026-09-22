import { withPpcBasePath } from "@/lib/glassco-apps";
import { getPipelineAuthorizationHeader } from "@/lib/pipeline-session";
import { DASHBOARD_STORES, isDashboardStoreKey, parseDashboardDocument, validateDashboardValue, type DashboardDocumentResponse, type DashboardStoreKey } from "../domain/shared-dashboard";

export type DashboardStorage = Pick<Storage, "getItem" | "setItem">;
export type SharedSaveStatus = { pending: number; error: string };
export type DashboardResponses = Map<DashboardStoreKey, DashboardDocumentResponse>;

export async function requestDashboardStore(key: DashboardStoreKey, body?: { value: string; expectedEtag: string | null; operationId: string }): Promise<DashboardDocumentResponse> {
  const response = await fetch(withPpcBasePath(`/api/dashboard/state?key=${encodeURIComponent(key)}`), {
    method: body ? "PUT" : "GET", headers: { ...getPipelineAuthorizationHeader(), ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Shared dashboard request failed.");
  if (!data || typeof data.canEdit !== "boolean" || !(data.etag === null || typeof data.etag === "string") || (data.document === null) !== (data.etag === null)) throw new Error("Incomplete shared dashboard response. Please retry.");
  return { document: data.document === null ? null : parseDashboardDocument(data.document, key), etag: data.etag, canEdit: data.canEdit };
}

export async function loadDashboardStores(): Promise<DashboardResponses> {
  return new Map(await Promise.all(DASHBOARD_STORES.map(async ({ key }) => [key, await requestDashboardStore(key)] as const)));
}

// A mounted workspace owns this adapter. It never changes the browser's legacy v1 stores.
export class SharedDashboardStorage implements DashboardStorage {
  private values = new Map<DashboardStoreKey, string>();
  private responses: DashboardResponses;
  private pending = new Map<DashboardStoreKey, { value: string; expectedEtag: string | null; operationId: string }>();
  private running = false;
  private error = "";
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(responses: DashboardResponses, private onStatus: (status: SharedSaveStatus) => void) {
    this.responses = new Map(responses);
    for (const [key, result] of responses) if (result.document) this.values.set(key, result.document.value);
  }
  getItem(key: string) { return isDashboardStoreKey(key) ? this.values.get(key) ?? null : null; }
  setItem(key: string, raw: string) {
    if (!isDashboardStoreKey(key)) throw new Error("Unknown dashboard dataset.");
    if (this.error) throw new Error(this.error);
    const value = validateDashboardValue(key, raw);
    if (this.values.get(key) === value) return;
    this.values.set(key, value);
    // Viewers may retrieve fresh metrics in memory, but cannot persist changes for the team.
    if (!this.responses.get(key)?.canEdit) return;
    this.pending.set(key, { value, expectedEtag: this.responses.get(key)?.etag ?? null, operationId: crypto.randomUUID() });
    this.notify();
    if (!this.timer) this.timer = setTimeout(() => { this.timer = undefined; void this.flush(); }, 500);
  }
  private notify() { this.onStatus({ pending: this.pending.size, error: this.error }); }
  async flush() {
    if (this.running || this.error) return;
    this.running = true;
    try {
      while (this.pending.size) {
        const [key, item] = this.pending.entries().next().value!;
        const result = await requestDashboardStore(key, item);
        if (!result.document || result.document.operationId !== item.operationId || result.document.value !== item.value) throw new Error("The server did not confirm this save. Keep the tab open and retry.");
        this.responses.set(key, result);
        if (this.pending.get(key) === item) this.pending.delete(key);
        else { const newer = this.pending.get(key)!; this.pending.set(key, { ...newer, expectedEtag: result.etag }); }
        this.notify();
      }
    } catch (error) { this.error = error instanceof Error ? error.message : "Online save failed."; }
    finally { this.running = false; this.notify(); }
  }
  retry() { this.error = ""; this.notify(); void this.flush(); }
  exportData() { return Object.fromEntries(this.values); }
  hasPending() { return this.pending.size > 0; }
}

let activeStorage: DashboardStorage | null = null;
export function attachDashboardStorage(storage: DashboardStorage) { activeStorage = storage; return () => { if (activeStorage === storage) activeStorage = null; }; }
export function dashboardStorage(): DashboardStorage {
  if (activeStorage) return activeStorage;
  // Standalone component tests exercise the unchanged v1 contracts.
  if (process.env.NODE_ENV === "test") return window.localStorage;
  throw new Error("Shared dashboard has not finished loading.");
}
