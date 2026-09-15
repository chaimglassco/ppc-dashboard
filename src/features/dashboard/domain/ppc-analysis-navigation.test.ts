import { describe, expect, it } from "vitest";
import { getScaleInsightsAnalysisHref, getScaleInsightsCampaignCreationHref, getScaleInsightsSearchTermHref, normalizeDashboardAsin } from "./ppc-analysis-navigation";

describe("PPC analysis navigation", () => {
  it("builds only validated ASIN-scoped destinations", () => {
    expect(normalizeDashboardAsin(" b012345678 ")).toBe("B012345678");
    expect(getScaleInsightsAnalysisHref("b012345678", "search-terms", "2026-08-26", "2026-09-01")).toBe(
      "https://portal.scaleinsights.com/Ads/SearchTerms/Index?from=2026-08-26&to=2026-09-01&asinList=B012345678",
    );
    expect(getScaleInsightsAnalysisHref("b012345678", "product-targeting", "2026-08-26", "2026-09-01")).toContain(
      "/Ads/Performance/ProductAds/Index?",
    );
    expect(getScaleInsightsAnalysisHref("b012345678", "daily-performance-trend", "2026-08-26", "2026-09-01")).toBe(
      "https://portal.scaleinsights.com/Sales/SalesTrend?cycles=7&daysPerCycle=1&to=2026-09-01&asinList=B012345678",
    );
    expect(getScaleInsightsAnalysisHref("b012345678", "weekly-performance-trend", "2026-08-26", "2026-09-01")).toBe(
      "https://portal.scaleinsights.com/Sales/SalesTrend?cycles=7&daysPerCycle=7&to=2026-09-01&asinList=B012345678",
    );
    expect(getScaleInsightsAnalysisHref("b012345678", "monthly-performance-trend", "2026-08-26", "2026-09-01")).toBe(
      "https://portal.scaleinsights.com/Sales/SalesTrend?cycles=7&daysPerCycle=30&to=2026-09-01&asinList=B012345678",
    );
    expect(getScaleInsightsAnalysisHref("not-an-asin", "search-terms", "2026-08-26", "2026-09-01")).toBe(
      "https://portal.scaleinsights.com/Ads",
    );
    expect(getScaleInsightsAnalysisHref("b012345678", "search-terms", "bad-date", "2026-09-01")).toBe(
      "https://portal.scaleinsights.com/Ads",
    );
  });

  it("builds a Search terms destination with the active product and reporting period", () => {
    expect(getScaleInsightsSearchTermHref("b012345678", "2026-08-26", "2026-09-01")).toBe(
      "https://portal.scaleinsights.com/Ads/SearchTerms/Index?from=2026-08-26&to=2026-09-01&asinList=B012345678",
    );
  });

  it("falls back when a Search terms source scope is invalid", () => {
    expect(getScaleInsightsSearchTermHref("invalid", "2026-08-26", "2026-09-01")).toBe(
      "https://portal.scaleinsights.com/Ads",
    );
  });

  it("opens campaign creation from the ASIN-scoped Search terms page", () => {
    expect(getScaleInsightsCampaignCreationHref("b012345678", "2026-08-26", "2026-09-01")).toBe(
      "https://portal.scaleinsights.com/Ads/SearchTerms/Index?from=2026-08-26&to=2026-09-01&asinList=B012345678",
    );
  });
});
