import type { Tool } from "@modelcontextprotocol/client";
import { describe, expect, it, vi } from "vitest";
import { buildOpportunityToolArgs, loadUntargetedSalesOpportunities, ScaleInsightsOpportunityProviderError } from "./scale-insights-untargeted-opportunities";

const params = { asin: "B012345678", country: "US", startDate: "2026-09-02", endDate: "2026-09-08", dataState: "Final" as const };
const definitions = [
  { name: "get_search_term_performance", inputSchema: { type: "object", properties: { asin_list: {}, country: {}, start_date: {}, end_date: {}, mode: {}, count: {}, page: {}, waste_only: {}, sort_by: {}, sort_direction: {} } } },
  { name: "get_search_term_keyword_analysis", inputSchema: { type: "object", properties: { asin_list: {}, country: {}, start_date: {}, end_date: {}, mode: {}, result_mode: {}, count: {}, page: {}, sort_by: {}, sort_direction: {} } } },
] as Tool[];

describe("Scale Insights untargeted sales opportunity adapter", () => {
  it("builds only arguments advertised by each tool", () => {
    expect(buildOpportunityToolArgs(definitions[0], params)).toEqual({
      asin_list: ["B012345678"], country: "US", start_date: "2026-09-02", end_date: "2026-09-08", mode: "raw", waste_only: false, sort_by: "sales", sort_direction: "desc", count: 500, page: 1,
    });
    expect(buildOpportunityToolArgs(definitions[1], params)).toEqual({
      asin_list: ["B012345678"], country: "US", start_date: "2026-09-02", end_date: "2026-09-08", mode: "harvest", result_mode: "raw", sort_by: "sales", sort_direction: "desc", count: 500, page: 1,
    });
  });

  it("joins converting PPC terms to their strongest uncovered campaign source and classifies product ASINs", async () => {
    const callTool = vi.fn(async (name: string) => name === "get_search_term_performance" ? {
      structuredContent: {
        agg: { Currency: "USD" },
        opps: [
          { entity: "glass cutter (B012345678)", metrics: { Impressions: "1,200", Sales: "$100.00", Orders: "2", Spend: "$20", Clicks: "10" } },
          { SearchTerm: "B0ABCDEF12", Impressions: 800, Sales: 80, Orders: 1, Spend: 8, Clicks: 4, ACOS: "10%" },
          { SearchTerm: "already targeted", Impressions: 500, Sales: 50, Orders: 1, Spend: 5, Clicks: 2 },
          { SearchTerm: "no sale", Impressions: 300, Sales: 0, Orders: 0, Spend: 1, Clicks: 1 },
          { identity: { search_query: "nested metrics" }, metrics: { Impression: 200, Sales: 0, Orders: 0, Spend: 0, Clicks: 0 } },
        ],
        oppMeta: { total_count: 5, data_as_of: "2026-09-09" },
      },
    } : {
      structuredContent: {
        opps: [
          { entity: "glass cutter (B012345678)", metrics: { CampaignId: "campaign-low", AdGroupId: "ad-group-low", ParentKeyword: "glass", ParentMatchType: "broad", Sales: "$25", Orders: "1", Spend: "$4" } },
          { entity: "glass cutter (B012345678)", metrics: { CampaignId: "campaign-high", AdGroupId: "ad-group-high", ParentKeyword: "glass cutter", ParentMatchType: "phrase", Sales: "$75", Orders: "1", Spend: "$16" } },
          { entity: "B0ABCDEF12 (B012345678)", metrics: { CampaignId: "campaign-asin", AdGroupId: "ad-group-asin", ParentKeyword: "competitor", ParentMatchType: "exact", Sales: "$80", Orders: "1", Spend: "$8" } },
        ],
        oppMeta: { total_count: 3, data_as_of: "2026-09-09" },
      },
    });

    const report = await loadUntargetedSalesOpportunities(params, definitions, callTool);
    expect(callTool).toHaveBeenCalledTimes(2);
    expect(callTool).toHaveBeenNthCalledWith(2, "get_search_term_keyword_analysis", expect.objectContaining({
      asin_list: ["B012345678"], mode: "harvest", result_mode: "raw",
    }));
    expect(report).toMatchObject({
      asin: "B012345678", country: "US", currency: "USD", dataState: "Final",
      period: { startDate: "2026-09-02", endDate: "2026-09-08" },
      freshness: { searchDataAsOf: "2026-09-09", coverageDataAsOf: "2026-09-09" },
      opportunities: [
        { term: "glass cutter", type: "Search term", sourceCampaignId: "campaign-high", sourceAdGroupId: "ad-group-high", sourceKeyword: "glass cutter", sourceMatchType: "phrase", sales: 100, orders: 2, spend: 20, impressions: 1200, clicks: 10, acos: 20 },
        { term: "B0ABCDEF12", type: "Product ASIN", sourceCampaignId: "campaign-asin", sourceAdGroupId: "ad-group-asin", sourceKeyword: "competitor", sourceMatchType: "exact", sales: 80, orders: 1, spend: 8, impressions: 800, clicks: 4, acos: 10 },
      ],
    });
  });

  it("reads Markdown performance tables and excludes terms without campaign attribution", async () => {
    const callTool = vi.fn(async (name: string) => ({ content: [{ type: "text", text: name === "get_search_term_performance"
      ? "| Search Term | Impressions | PPC Sales | PPC Orders | PPC Cost | Clicks |\n| --- | --- | --- | --- | --- | --- |\n| lead knife | 100 | $25 | 1 | $5 | 3 |"
      : "| Search Term | CampaignId |\n| --- | --- |\n| another term | 123 |" }] }));
    await expect(loadUntargetedSalesOpportunities(params, definitions, callTool)).resolves.toMatchObject({ opportunities: [] });
  });

  it("fails safely for missing capabilities and unreadable positive result sets", async () => {
    await expect(loadUntargetedSalesOpportunities(params, [], vi.fn())).rejects.toMatchObject({ providerCode: "opportunity_capability_missing" });
    const callTool = vi.fn(async (name: string) => ({ structuredContent: { rows: [{ private_value: name }], oppMeta: { total_count: 1 } } }));
    await expect(loadUntargetedSalesOpportunities(params, definitions, callTool)).rejects.toBeInstanceOf(ScaleInsightsOpportunityProviderError);
  });

  it("does not spend a campaign-attribution call when the search report has no rows", async () => {
    const callTool = vi.fn(async () => ({ structuredContent: { rows: [], oppMeta: { total_count: 0 } } }));
    await expect(loadUntargetedSalesOpportunities(params, definitions, callTool)).resolves.toMatchObject({ opportunities: [] });
    expect(callTool).toHaveBeenCalledTimes(1);
  });
});
