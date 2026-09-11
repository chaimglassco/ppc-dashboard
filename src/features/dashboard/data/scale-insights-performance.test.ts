import { describe, expect, it, vi } from "vitest";
import { loadScaleInsightsWeeklyPerformance, unwrapScaleInsightsPayload } from "./scale-insights-performance";

const params = { asin: "B0FG4H5C6W", country: "US", startDate: "2026-08-26", endDate: "2026-09-01" };

function adsPayload(overrides: Record<string, unknown> = {}) {
  return {
    agg: { Country: "US", StartDate: "2026-08-26", EndDate: "2026-09-01", Currency: "USD" },
    oppMeta: {
      total_count: 1,
      data_as_of: "synced 2026-09-03 21:34 UTC",
      totals: { total_spend: 81.75, total_sales: 481.75, total_orders: 23, total_clicks: 48 },
      ...overrides,
    },
  };
}

function salesPayload(overrides: Record<string, unknown> = {}) {
  return {
    Country: "US",
    StartDate: "2026-08-26",
    EndDate: "2026-09-01",
    Meta: { total_count: 1, data_as_of: "synced 2026-09-04 00:26 UTC", data_through: "2026-09-01" },
    Summary: { TotalSales: 1317.35, TotalOrders: 59, TotalSessions: 122, TotalPPCCost: 81.75, TotalPPCSales: 481.75 },
    ...overrides,
  };
}

describe("Scale Insights weekly performance", () => {
  it("unwraps JSON text from an MCP tool response", () => {
    expect(unwrapScaleInsightsPayload({ content: [{ type: "text", text: JSON.stringify({ ok: true }) }] })).toEqual({ ok: true });
  });

  it("loads exact paid and total metrics concurrently and calculates the derived values", async () => {
    const callTool = vi.fn(async (name: string) => name === "get_ads_performance" ? adsPayload() : salesPayload());

    await expect(loadScaleInsightsWeeklyPerformance(params, callTool)).resolves.toEqual({
      ...params,
      currency: "USD",
      metrics: {
        spend: 81.75,
        ppcSales: 481.75,
        ppcOrders: 23,
        ppcClicks: 48,
        totalSales: 1317.35,
        totalOrders: 59,
        totalSessions: 122,
        organicSales: 835.6,
        organicOrders: 36,
        acos: 16.97,
        tacos: 6.21,
        conversionRate: 47.92,
      },
      freshness: {
        adsDataAsOf: "synced 2026-09-03 21:34 UTC",
        salesDataAsOf: "synced 2026-09-04 00:26 UTC",
        salesDataThrough: "2026-09-01",
      },
      warnings: [],
    });
    expect(callTool).toHaveBeenCalledTimes(2);
    expect(callTool).toHaveBeenCalledWith("get_ads_performance", expect.objectContaining({
      asin_list: [params.asin], country: "US", start_date: params.startDate, end_date: params.endDate, summary_only: false, count: 1, page: 1,
    }));
    expect(callTool).toHaveBeenCalledWith("get_sales_data", expect.objectContaining({ group_by: "total", include_growth: false }));
  });

  it("reads exact PPC Clicks automatically from the single-ASIN advertising row", async () => {
    const callTool = vi.fn(async (name: string) => name === "get_ads_performance"
      ? {
        ...adsPayload({ totals: { total_spend: 81.75, total_sales: 481.75, total_orders: 23 } }),
        rows: [{ ASIN: params.asin, Clicks: "48" }],
      }
      : salesPayload());

    const result = await loadScaleInsightsWeeklyPerformance(params, callTool);
    expect(result.metrics.ppcClicks).toBe(48);
    expect(result.metrics.conversionRate).toBe(47.92);
    expect(result.warnings).not.toContain(expect.stringContaining("PPC Clicks"));
  });

  it("reads the exact single-ASIN click value from the provider text table", async () => {
    const callTool = vi.fn(async (name: string) => name === "get_ads_performance"
      ? {
        structuredContent: adsPayload({ totals: { total_spend: 81.75, total_sales: 481.75, total_orders: 23 } }),
        content: [{ type: "text", text: `| ASIN | Clicks |\n| --- | --- |\n| ${params.asin} | 48 |` }],
      }
      : salesPayload());

    const result = await loadScaleInsightsWeeklyPerformance(params, callTool);
    expect(result.metrics.ppcClicks).toBe(48);
    expect(result.metrics.conversionRate).toBe(47.92);
  });

  it("warns when the independently synced paid totals disagree", async () => {
    const callTool = vi.fn(async (name: string) => name === "get_ads_performance"
      ? adsPayload()
      : salesPayload({ Summary: { TotalSales: 1317.35, TotalOrders: 59, TotalSessions: 122, TotalPPCCost: 82, TotalPPCSales: 482 } }));

    const result = await loadScaleInsightsWeeklyPerformance(params, callTool);
    expect(result.warnings).toEqual([expect.stringContaining("synced at different times")]);
  });

  it("does not substitute overall sessions when exact PPC Clicks are absent", async () => {
    const callTool = vi.fn(async (name: string) => name === "get_ads_performance"
      ? adsPayload({ totals: { total_spend: 81.75, total_sales: 481.75, total_orders: 23 } })
      : salesPayload());

    const result = await loadScaleInsightsWeeklyPerformance(params, callTool);
    expect(result.metrics.totalSessions).toBe(122);
    expect(result.metrics.conversionRate).toBeUndefined();
    expect(result.warnings).toContain("Scale Insights did not include PPC Clicks for this reporting period; PPC Conversion Rate is unavailable.");
  });

  it("fails closed when Scale Insights returns a different scope", async () => {
    const callTool = vi.fn(async (name: string) => name === "get_ads_performance"
      ? adsPayload()
      : salesPayload({ EndDate: "2026-09-02" }));

    await expect(loadScaleInsightsWeeklyPerformance(params, callTool)).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
});
