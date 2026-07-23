import { afterEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function mutationRequest() {
  return new Request("http://localhost/ppc/api/library?summary=1", {
    method: "PATCH",
    headers: {
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ operation: "document.delete", documentId: "document-1", expectedVersion: 1 }),
  });
}

describe("Library API proxy", () => {
  it("forwards the upstream status and error body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(
      { error: "The shared Library database did not respond in time. Please retry." },
      { status: 503 },
    )));

    const response = await PATCH(mutationRequest());

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "The shared Library database did not respond in time. Please retry.",
    });
  });

  it("returns a retryable timeout response when the upstream request stalls", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })));

    const pending = PATCH(mutationRequest());
    await vi.advanceTimersByTimeAsync(15_000);
    const response = await pending;

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      error: "The Library service took too long to respond. Please try again.",
    });
  });
});
