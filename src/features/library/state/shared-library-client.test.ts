import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPublishedDocuments } from "../data/repository";
import { createDefaultCategories } from "./category-storage";
import { fetchSharedLibraryState, getSharedLibraryCacheKey, hydrateSharedLibraryState, initializeCleanLibrary, mutateSharedLibrary, SHARED_LIBRARY_CACHE_KEY, SHARED_LIBRARY_REQUEST_TIMEOUT_MS, SharedLibraryTimeoutError } from "./shared-library-client";

const response = {
  initialized: true,
  state: { version: 1 as const, documents: getPublishedDocuments().slice(0, 1), categories: createDefaultCategories() },
  revision: 2,
  recordVersions: { documents: {}, categories: {} },
  updatedAt: null,
  updatedBy: null,
};

describe("shared library client", () => {
  beforeEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });
  afterEach(() => { vi.useRealTimers(); });

  it("uses only the last server-confirmed cache when the server is unavailable", async () => {
    window.localStorage.setItem(SHARED_LIBRARY_CACHE_KEY, JSON.stringify(response));
    window.localStorage.setItem("glassco-library-admin-state", JSON.stringify({ version: 1, documents: [{ ...response.state.documents[0], id: "stale-local" }] }));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const hydrated = await hydrateSharedLibraryState(window.localStorage);
    expect(hydrated.source).toBe("cache");
    expect(hydrated.response.state.documents.map(document => document.id)).not.toContain("stale-local");
  });

  it("never uploads local storage during hydration", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await hydrateSharedLibraryState(window.localStorage);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).not.toMatchObject({ method: "PATCH" });
  });

  it("sends scoped mutations with PATCH", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await mutateSharedLibrary({ operation: "document.create", document: response.state.documents[0] });
    expect(fetchMock).toHaveBeenCalledWith("/ppc/api/library", expect.objectContaining({ method: "PATCH", body: expect.stringContaining('"operation":"document.create"') }));
  });

  it("validates fetched response envelopes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 })));
    await expect(fetchSharedLibraryState()).resolves.toMatchObject({ revision: 2 });
  });

  it("requests compact catalog summaries without mixing them with document caches", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchSharedLibraryState(undefined, { summary: true });

    expect(fetchMock).toHaveBeenCalledWith("/ppc/api/library?summary=1", expect.any(Object));
    expect(getSharedLibraryCacheKey({ slug: "checking-spend" })).toBe(`${SHARED_LIBRARY_CACHE_KEY}:document:checking-spend`);
  });

  it("requests only the full document opened by the reader", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchSharedLibraryState(undefined, { slug: "checking-spend" });

    expect(fetchMock).toHaveBeenCalledWith("/ppc/api/library?slug=checking-spend", expect.any(Object));
  });

  it("aborts a hung shared-state request instead of leaving hydration pending forever", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);

    const request = fetchSharedLibraryState();
    const rejection = expect(request).rejects.toBeInstanceOf(SharedLibraryTimeoutError);
    await vi.advanceTimersByTimeAsync(SHARED_LIBRARY_REQUEST_TIMEOUT_MS);

    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses the authenticated migration action without exposing a token in the URL", async () => {
    window.localStorage.setItem("launchflow.authSession.v1", JSON.stringify({ token: "secret-token", email: "admin@example.com", role: "ADMIN" }));
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await initializeCleanLibrary();
    expect(fetchMock).toHaveBeenCalledWith("/ppc/api/library/migration", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer secret-token" }),
      body: JSON.stringify({ action: "initialize-clean-catalog" }),
    }));
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("secret-token");
  });
});
