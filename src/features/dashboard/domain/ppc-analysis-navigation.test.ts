import { describe, expect, it } from "vitest";
import { getPpcAnalysisHref, getPpcAnalysisSection, normalizeDashboardAsin } from "./ppc-analysis-navigation";

describe("PPC analysis navigation", () => {
  it("builds only validated ASIN-scoped destinations", () => {
    expect(normalizeDashboardAsin(" b012345678 ")).toBe("B012345678");
    expect(getPpcAnalysisHref("b012345678", "search-terms")).toBe("/dashboard/products/B012345678/search-terms");
    expect(getPpcAnalysisHref("not-an-asin", "search-terms")).toBe("/dashboard");
    expect(getPpcAnalysisSection("match-types")?.label).toBe("Match Types");
    expect(getPpcAnalysisSection("unknown")).toBeNull();
  });
});
