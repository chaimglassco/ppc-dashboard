import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { normalizeDashboardProducts } from "@/features/dashboard/domain/pipeline-products";

describe("PPC dashboard product catalog", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns only valid, deduplicated Pipeline products", () => {
    expect(normalizeDashboardProducts({ state: { userProducts: [
      { id: "p-1", name: "Glass Cleaner", asin: "B001", sku: "GC-1", stageId: "launch" },
      { id: "p-1", name: "Duplicate" },
      { id: "", name: "Invalid" },
    ] } })).toEqual([{ id: "p-1", name: "Glass Cleaner", asin: "B001", sku: "GC-1", stageId: "launch", status: "Active" }]);
  });

  it("verifies the session and proxies a compact no-store catalog", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: { id: "u-1", email: "admin@example.com", name: "Admin", role: "ADMIN" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ state: { userProducts: [{ id: "p-1", name: "Glass Cleaner" }] } }), { status: 200 }));
    const response = await GET(new Request("http://localhost/ppc/api/dashboard/products", { headers: { Authorization: "Bearer token" } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    await expect(response.json()).resolves.toEqual({ products: [{ id: "p-1", name: "Glass Cleaner", asin: "", sku: "", stageId: "product-research", status: "Active" }] });
  });
});
