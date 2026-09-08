import { describe, expect, it } from "vitest";
import { getScaleInsightsAnalysisHref, normalizeDashboardAsin } from "./ppc-analysis-navigation";

describe("PPC analysis navigation", () => {
  it("builds only validated ASIN-scoped destinations", () => {
    expect(normalizeDashboardAsin(" b012345678 ")).toBe("B012345678");
    expect(getScaleInsightsAnalysisHref("b012345678", "search-terms", "2026-08-26", "2026-09-01")).toBe(
      "https://portal.scaleinsights.com/Ads/SearchTerms/Index?from=2026-08-26&to=2026-09-01&asinList=B012345678",
    );
    expect(getScaleInsightsAnalysisHref("b012345678", "product-targeting", "2026-08-26", "2026-09-01")).toContain(
      "/Ads/Performance/ProductAds/Index?",
    );
    expect(getScaleInsightsAnalysisHref("not-an-asin", "search-terms", "2026-08-26", "2026-09-01")).toBe(
      "https://portal.scaleinsights.com/Ads",
    );
    expect(getScaleInsightsAnalysisHref("b012345678", "search-terms", "bad-date", "2026-09-01")).toBe(
      "https://portal.scaleinsights.com/Ads",
    );
  });
});
