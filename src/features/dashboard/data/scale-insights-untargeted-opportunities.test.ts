import type { Tool } from "@modelcontextprotocol/client";
import { describe, expect, it, vi } from "vitest";
import { buildOpportunityToolArgs, loadUntargetedSalesOpportunities, ScaleInsightsOpportunityProviderError } from "./scale-insights-untargeted-opportunities";

const params = { asin: "B012345678", country: "US", startDate: "2026-09-02", endDate: "2026-09-08", dataState: "Final" as const };
const definitions = [
  { name: "get_search_query_data", inputSchema: { type: "object", properties: { asin_list: {}, country: {}, start_date: {}, end_date: {}, mode: {}, count: {} } } },
  { name: "get_ppc_exact_coverage", inputSchema: { type: "object", properties: { asin: {}, marketplace: {}, fromDate: {}, toDate: {}, query_list: {}, limit: {} } } },
] as Tool[];

describe("Scale Insights untargeted sales opportunity adapter", () => {
  it("builds only arguments advertised by each tool", () => {
    expect(buildOpportunityToolArgs(definitions[0], params)).toEqual({
      asin_list: ["B012345678"], country: "US", start_date: "2026-09-02", end_date: "2026-09-08", mode: "raw", count: 500,
    });
    expect(buildOpportunityToolArgs(definitions[1], params)).toEqual({
      asin: "B012345678", marketplace: "US", fromDate: "2026-09-02", toDate: "2026-09-08", limit: 500,
    });
  });

  it("joins every query to explicit uncovered results, including rows without sales, and classifies product ASINs", async () => {
    const callTool = vi.fn(async (name: string) => name === "get_search_query_data" ? {
      structuredContent: {
        agg: { Currency: "USD" },
        rows: [
          { SearchTerm: "glass cutter", Impressions: "1,200", Sales: "$100.00", Orders: "2", Spend: "$20", Clicks: "10" },
          { SearchTerm: "B0ABCDEF12", Impressions: 800, Sales: 80, Orders: 1, Spend: 8, Clicks: 4, ACOS: "10%" },
          { SearchTerm: "already targeted", Impressions: 500, Sales: 50, Orders: 1, Spend: 5, Clicks: 2 },
          { SearchTerm: "no sale", Impressions: 300, Sales: 0, Orders: 0, Spend: 1, Clicks: 1 },
          { identity: { search_query: "nested metrics" }, metrics: { Impression: 200, Sales: 0, Orders: 0, Spend: 0, Clicks: 0 } },
        ],
        oppMeta: { total_count: 5, data_as_of: "2026-09-09" },
      },
    } : {
      structuredContent: {
        uncovered: [{ SearchTerm: "glass cutter" }, { SearchTerm: "B0ABCDEF12" }, { SearchTerm: "no sale" }, { query: { value: "nested metrics" }, coverage: { is_exact_covered: false } }],
        covered: [{ SearchTerm: "already targeted" }],
        oppMeta: { total_count: 5, data_as_of: "2026-09-09" },
      },
    });

    const report = await loadUntargetedSalesOpportunities(params, definitions, callTool);
    expect(callTool).toHaveBeenCalledTimes(2);
    expect(callTool).toHaveBeenNthCalledWith(2, "get_ppc_exact_coverage", expect.objectContaining({
      asin: "B012345678", query_list: ["glass cutter", "B0ABCDEF12", "already targeted", "no sale", "nested metrics"],
    }));
    expect(report).toMatchObject({
      asin: "B012345678", country: "US", currency: "USD", dataState: "Final",
      period: { startDate: "2026-09-02", endDate: "2026-09-08" },
      freshness: { searchDataAsOf: "2026-09-09", coverageDataAsOf: "2026-09-09" },
      opportunities: [
        { term: "glass cutter", type: "Search term", sales: 100, orders: 2, spend: 20, impressions: 1200, clicks: 10, acos: 20 },
        { term: "B0ABCDEF12", type: "Product ASIN", sales: 80, orders: 1, spend: 8, impressions: 800, clicks: 4, acos: 10 },
        { term: "nested metrics", type: "Search term", sales: 0, orders: 0, spend: 0, impressions: 200, clicks: 0, acos: null },
        { term: "no sale", type: "Search term", sales: 0, orders: 0, spend: 1, impressions: 300, clicks: 1, acos: null },
      ],
    });
  });

  it("reads Markdown tables and never treats unknown coverage as untargeted", async () => {
    const callTool = vi.fn(async (name: string) => ({ content: [{ type: "text", text: name === "get_search_query_data"
      ? "| Search Term | Impressions | PPC Sales | PPC Orders | PPC Cost | Clicks |\n| --- | --- | --- | --- | --- | --- |\n| lead knife | 100 | $25 | 1 | $5 | 3 |"
      : "| Search Term | Targeted |\n| --- | --- |\n| lead knife | unknown |" }] }));
    await expect(loadUntargetedSalesOpportunities(params, definitions, callTool)).resolves.toMatchObject({ opportunities: [] });
  });

  it("fails safely for missing capabilities and unreadable positive result sets", async () => {
    await expect(loadUntargetedSalesOpportunities(params, [], vi.fn())).rejects.toMatchObject({ providerCode: "opportunity_capability_missing" });
    const callTool = vi.fn(async (name: string) => ({ structuredContent: { rows: [{ private_value: name }], oppMeta: { total_count: 1 } } }));
    await expect(loadUntargetedSalesOpportunities(params, definitions, callTool)).rejects.toBeInstanceOf(ScaleInsightsOpportunityProviderError);
  });

  it("does not spend a coverage call when the search report has no rows", async () => {
    const callTool = vi.fn(async () => ({ structuredContent: { rows: [], oppMeta: { total_count: 0 } } }));
    await expect(loadUntargetedSalesOpportunities(params, definitions, callTool)).resolves.toMatchObject({ opportunities: [] });
    expect(callTool).toHaveBeenCalledTimes(1);
  });
});
