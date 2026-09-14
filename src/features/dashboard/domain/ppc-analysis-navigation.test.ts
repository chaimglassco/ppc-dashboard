import { describe, expect, it } from "vitest";
import { getScaleInsightsAnalysisHref, getScaleInsightsCampaignSourceHref, getScaleInsightsSearchTermHref, normalizeDashboardAsin } from "./ppc-analysis-navigation";

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

  it("builds a search-term source destination with the active product and reporting period", () => {
    expect(getScaleInsightsSearchTermHref("b012345678", " 3/16 lead came ", "2026-08-26", "2026-09-01")).toBe(
      "https://portal.scaleinsights.com/Ads/SearchTerms/Index?from=2026-08-26&to=2026-09-01&asinList=B012345678&searchTerm=3%2F16+lead+came",
    );
    expect(getScaleInsightsSearchTermHref("b012345678", "", "2026-08-26", "2026-09-01")).toBe(
      "https://portal.scaleinsights.com/Ads/SearchTerms/Index?from=2026-08-26&to=2026-09-01&asinList=B012345678",
    );
  });

  it("builds a campaign source destination with the active product and reporting period", () => {
    expect(getScaleInsightsCampaignSourceHref("b012345678", " 477249359263376 ", "2026-08-26", "2026-09-01")).toBe(
      "https://portal.scaleinsights.com/Ads/Performance/Campaigns/Index?from=2026-08-26&to=2026-09-01&asinList=B012345678&campaignId=477249359263376",
    );
  });
});
