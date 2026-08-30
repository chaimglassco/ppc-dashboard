import { describe, expect, it } from "vitest";
import { mergeDashboardProducts, parseDashboardCatalogStore } from "./ppc-dashboard-catalog";

describe("PPC dashboard catalog", () => {
  it("fails closed and removes malformed, duplicate, and orphaned values", () => {
    const parsed = parseDashboardCatalogStore(JSON.stringify({
      version: 1,
      tags: [{ id: "tag-a", name: "Launch" }, { id: "tag-b", name: "launch" }, { id: "", name: "Invalid" }],
      customProducts: [
        { id: "custom-1", name: "Cleaner", asin: "b012345678", sku: "SKU-1", tagId: "tag-a", imageDataUrl: "javascript:alert(1)" },
        { id: "custom-1", name: "Duplicate" },
      ],
      productOverrides: {
        "pipeline-1": { name: "Renamed", asin: "b000000001", sku: "P-1", tagId: "missing", imageDataUrl: "" },
      },
    }));

    expect(parsed.tags).toEqual([{ id: "tag-a", name: "Launch" }]);
    expect(parsed.customProducts).toHaveLength(1);
    expect(parsed.customProducts[0]).toMatchObject({ asin: "B012345678", tagId: "tag-a", imageDataUrl: "" });
    expect(parsed.productOverrides["pipeline-1"].tagId).toBe("");
  });

  it("applies local overrides without changing the Pipeline source object", () => {
    const pipeline = [{ id: "pipeline-1", name: "Original", asin: "A", sku: "S", stageId: "research", status: "Active" as const }];
    const merged = mergeDashboardProducts(pipeline, {
      version: 1,
      tags: [{ id: "tag-launch", name: "Launch" }],
      customProducts: [],
      productOverrides: { "pipeline-1": { name: "Dashboard Name", asin: "B", sku: "T", tagId: "tag-launch", imageDataUrl: "" } },
    });

    expect(merged[0]).toMatchObject({ name: "Dashboard Name", tagId: "tag-launch", source: "pipeline" });
    expect(pipeline[0].name).toBe("Original");
  });
});
