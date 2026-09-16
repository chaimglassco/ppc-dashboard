import type { Tool } from "@modelcontextprotocol/client";
import { describe, expect, it, vi } from "vitest";
import { loadScaleInsightsPerformanceOverview } from "./scale-insights-performance-overview";

const params = {
  asins: ["B012345678"], country: "US", requestedStartDate: "2026-08-01", requestedEndDate: "2026-09-15",
  actualStartDate: "2026-08-01", actualEndDate: "2026-09-14", yesterday: "2026-09-14", sevenDayStart: "2026-09-08", fourteenDayStart: "2026-09-01",
  previousStartDate: "2026-06-17", previousEndDate: "2026-07-31",
};

function tool(name: string, extra: Record<string, unknown> = {}): Tool {
  return { name, description: name, inputSchema: { type: "object", properties: { asin_list: { type: "array" }, country: { type: "string" }, start_date: { type: "string" }, end_date: { type: "string" }, summary_only: { type: "boolean" }, count: { type: "number" }, page: { type: "number" }, ...extra } } };
}

function accountTool(name: string): Tool {
  return { name, description: name, inputSchema: { type: "object", properties: { country: { type: "string" }, start_date: { type: "string" }, end_date: { type: "string" }, mode: { type: "string" }, count: { type: "number" }, page: { type: "number" }, sort_by: { type: "string" }, sort_direction: { type: "string" } } } };
}

describe("Scale Insights performance overview adapter", () => {
  it("loads timeframe totals and normalizes campaign, keyword, product-target, and search-term rows", async () => {
    const definitions = [
      tool("get_ads_performance", { group_by: { type: "string", enum: ["product"] } }), accountTool("get_campaign_performance"),
      tool("get_sales_data", { group_by: { type: "string", enum: ["total", "product"] } }), tool("get_target_performance"), tool("get_search_term_performance"),
    ];
    const callTool = vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === "get_sales_data") {
        const totalSales = args.start_date === params.previousStartDate ? 800 : 1000;
        return { Summary: { TotalSales: totalSales, TotalOrders: 40 }, ASINs: [{ ASIN: "B012345678", TotalSales: totalSales, TotalOrders: 40 }] };
      }
      if (name === "get_ads_performance") return {
        agg: { Currency: "USD" }, oppMeta: { data_as_of: "2026-09-15", totals: { total_spend: 100, total_sales: 500, total_orders: 20, total_clicks: 50 } },
        opps: args.group_by === "product" ? [{ entity: "B012345678", entityType: "ASIN", metrics: { TotalSpend: 100, TotalAdSales: 500, TotalOrders: 20 } }] : undefined,
      };
      if (name === "get_campaign_performance") return args.page === 2
        ? { oppMeta: { total_count: 2, total_pages: 2 }, opps: [{ entity: "Auto Campaign", entityType: "Campaign", metrics: { AdType: "SP", State: "enabled", Spend: "$20.00", Sales: "$50.00", Orders: "3", ACOS: "40%", ROAS: "2.5", CPC: "$1.00", CTR: "2%", CVR: "15%", DailyBudget: "$25.00" } }] }
        : { oppMeta: { total_count: 2, total_pages: 2 }, opps: [{ entity: "Exact Campaign", entityType: "Campaign", metrics: { AdType: "SP", State: "enabled", Spend: "$100.00", Sales: "$500.00", Orders: "20", ACOS: "20%", ROAS: "5", CPC: "$2.00", CTR: "5%", CVR: "40%", DailyBudget: "$75.00" } }] };
      if (name === "get_target_performance") return { rows: [
        { TargetId: "keyword-1", Target: "stained glass came", CampaignName: "Exact Campaign", AdvertisedASIN: "B012345678", TargetType: "keyword", MatchType: "exact", Impressions: 800, Clicks: 40, Spend: 50, Sales: 300, Orders: 12 },
        { TargetId: "product-1", Target: "B099999999", CampaignName: "Product Campaign", AdvertisedASIN: "B012345678", TargetType: "product", Impressions: 200, Clicks: 10, Spend: 20, Sales: 80, Orders: 4 },
      ] };
      expect(args.start_date).toBe("2026-08-01");
      return { rows: [{ SearchTermId: "search-1", SearchTerm: "round u lead came", CampaignName: "Exact Campaign", AdvertisedASIN: "B012345678", MatchType: "exact", Impressions: 600, Clicks: 30, Spend: 25, Sales: 200, Orders: 10 }] };
    });

    const result = await loadScaleInsightsPerformanceOverview(params, definitions, callTool);
    expect(result.periods.yesterday).toEqual({ totalSales: 1000, ppcSales: 500, spend: 100, totalOrders: 40, ppcOrders: 20, clicks: 50 });
    expect(result.asinRanking.rows[0]).toEqual({ asin: "B012345678", spend: 100, ppcSales: 500, ppcOrders: 20, clicks: 0, totalSales: 1000, totalOrders: 40, previousTotalSales: 800 });
    expect(result.sections.campaigns.rows[0]).toMatchObject({ name: "Exact Campaign", targetType: "SP", state: "enabled", spend: 100, sales: 500, orders: 20, acos: 20, roas: 5, cpc: 2, ctr: 5, conversionRate: 40, dailyBudget: 75 });
    expect(result.sections.campaigns.rows[1]).toMatchObject({ name: "Auto Campaign", spend: 20, sales: 50 });
    expect(result.sections.keywords.rows[0]).toMatchObject({ name: "stained glass came", matchType: "exact" });
    expect(result.sections.productTargets.rows[0]).toMatchObject({ name: "B099999999", targetType: "product" });
    expect(result.sections.searchTerms.rows[0]).toMatchObject({ name: "round u lead came", conversionRate: 33.33333333333333 });
    expect(result.warnings).toEqual(["Scale Insights excludes today and future dates. Actual data ends 2026-09-14."]);
    expect(callTool).toHaveBeenCalledTimes(15);
    expect(callTool).toHaveBeenCalledWith("get_campaign_performance", expect.objectContaining({ mode: "raw", count: 500, page: 1, sort_by: "sales", sort_direction: "desc" }));
    expect(callTool).toHaveBeenCalledWith("get_sales_data", expect.objectContaining({ group_by: "total", count: 100, summary_only: false }));
  });

  it("reports an unavailable account scope when a provider tool only accepts one ASIN", async () => {
    const scalarTool = (name: string): Tool => ({ name, description: name, inputSchema: { type: "object", properties: { asin: { type: "string" }, country: { type: "string" }, start_date: { type: "string" }, end_date: { type: "string" } } } });
    const result = await loadScaleInsightsPerformanceOverview({ ...params, asins: ["B012345678", "B087654321"] }, [scalarTool("get_ads_performance"), scalarTool("get_sales_data")], vi.fn());
    expect(result.periods.selectedRange).toBeNull();
    expect(result.asinRanking).toMatchObject({ status: "unavailable", rows: [] });
    expect(result.sections.campaigns).toMatchObject({ status: "unavailable", rows: [], message: expect.stringContaining("campaign performance") });
  });
});
