import type { Tool } from "@modelcontextprotocol/client";
import { unwrapScaleInsightsPayload, type ScaleInsightsToolCaller } from "./scale-insights-performance";
import { getScaleInsightsCampaignToolCapabilities } from "./scale-insights-campaign-comparison";
import type {
  PerformanceOverviewData,
  PerformanceOverviewMetrics,
  PerformanceOverviewRow,
  PerformanceOverviewSection,
} from "../domain/performance-overview";

export type PerformanceOverviewParams = {
  asins: string[];
  country: string;
  requestedStartDate: string;
  requestedEndDate: string;
  actualStartDate: string;
  actualEndDate: string;
  yesterday: string;
  sevenDayStart: string;
  fourteenDayStart: string;
};

const NAME_KEYS = ["search_term", "searchTerm", "SearchTerm", "customer_search_term", "searchQuery", "keyword", "Keyword", "keyword_text", "target", "Target", "target_asin", "TargetASIN", "entity", "Entity", "campaign_name", "campaignName", "CampaignName", "campaign", "Campaign", "name", "Name"];
const CAMPAIGN_KEYS = ["campaign_name", "campaignName", "CampaignName", "campaign", "Campaign"];
const ASIN_KEYS = ["advertised_asin", "advertisedAsin", "AdvertisedASIN", "product_asin", "productAsin", "ProductASIN", "asin", "ASIN"];
const MATCH_KEYS = ["match_type", "matchType", "MatchType", "keyword_match_type", "KeywordMatchType"];
const TARGET_TYPE_KEYS = ["target_type", "targetType", "TargetType", "targeting_type", "TargetingType"];
const ID_KEYS = ["campaign_id", "campaignId", "CampaignId", "keyword_id", "keywordId", "KeywordId", "target_id", "targetId", "TargetId", "search_term_id", "searchTermId", "id", "Id"];
const IMPRESSION_KEYS = ["impressions", "Impressions", "total_impressions", "totalImpressions", "PPCImpressions"];
const CLICK_KEYS = ["clicks", "Clicks", "total_clicks", "totalClicks", "PPCClicks"];
const SPEND_KEYS = ["spend", "Spend", "total_spend", "totalSpend", "PPCSpend", "PPCCost", "cost", "Cost"];
const SALES_KEYS = ["sales", "Sales", "total_sales", "totalSales", "PPCSales", "attributed_sales", "attributedSales"];
const ORDER_KEYS = ["orders", "Orders", "total_orders", "totalOrders", "PPCOrders", "attributed_orders", "attributedOrders"];
const TOTAL_SALES_KEYS = ["total_revenue", "totalRevenue", "TotalRevenue", "total_sales", "totalSales", "TotalSales", "sales", "Sales"];
const TOTAL_ORDER_KEYS = ["total_orders", "totalOrders", "TotalOrders", "orders", "Orders"];
const PAGE_SIZE = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedKey(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function directValue(record: Record<string, unknown>, keys: string[]) {
  const accepted = new Set(keys.map(normalizedKey));
  return Object.entries(record).find(([key, value]) => accepted.has(normalizedKey(key)) && value != null && !isRecord(value) && !Array.isArray(value))?.[1];
}

function nestedValue(record: Record<string, unknown>, keys: string[], depth = 0): unknown {
  const direct = directValue(record, keys);
  if (direct !== undefined || depth >= 2) return direct;
  for (const value of Object.values(record)) {
    if (!isRecord(value)) continue;
    const nested = nestedValue(value, keys, depth + 1);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

function textValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/[$,£€¥%x]/gi, "");
  const parsed = Number(normalized);
  return normalized && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function resultPayloads(result: unknown) {
  const payloads: unknown[] = [];
  try { payloads.push(unwrapScaleInsightsPayload(result)); } catch { /* Content rows can still be readable. */ }
  if (isRecord(result) && Array.isArray(result.content)) {
    for (const block of result.content) {
      if (!isRecord(block) || block.type !== "text" || typeof block.text !== "string") continue;
      try { payloads.push(JSON.parse(block.text)); } catch {
        const lines = block.text.split(/\r?\n/).map(line => line.trim()).filter(line => line.includes("|"));
        for (let index = 0; index < lines.length - 2; index += 1) {
          const headers = lines[index].replace(/^\||\|$/g, "").split("|").map(cell => cell.trim());
          const separators = lines[index + 1].replace(/^\||\|$/g, "").split("|").map(cell => cell.trim());
          if (headers.length < 2 || separators.length !== headers.length || !separators.every(cell => /^:?-{3,}:?$/.test(cell))) continue;
          payloads.push(lines.slice(index + 2).flatMap(line => {
            const cells = line.replace(/^\||\|$/g, "").split("|").map(cell => cell.trim());
            return cells.length === headers.length ? [Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex]]))] : [];
          }));
          break;
        }
      }
    }
  }
  return payloads;
}

function rowFromRecord(record: Record<string, unknown>, kind: "campaign" | "target" | "search"): PerformanceOverviewRow | null {
  const campaign = textValue(directValue(record, CAMPAIGN_KEYS));
  const targetType = textValue(directValue(record, TARGET_TYPE_KEYS));
  const matchType = textValue(directValue(record, MATCH_KEYS));
  const name = kind === "campaign" ? campaign : textValue(directValue(record, NAME_KEYS));
  if (!name) return null;
  const values = {
    impressions: numberValue(nestedValue(record, IMPRESSION_KEYS)),
    clicks: numberValue(nestedValue(record, CLICK_KEYS)),
    spend: numberValue(nestedValue(record, SPEND_KEYS)),
    sales: numberValue(nestedValue(record, SALES_KEYS)),
    orders: numberValue(nestedValue(record, ORDER_KEYS)),
  };
  if (Object.values(values).every(value => value == null)) return null;
  const impressions = values.impressions ?? 0;
  const clicks = values.clicks ?? 0;
  const spend = values.spend ?? 0;
  const sales = values.sales ?? 0;
  const orders = values.orders ?? 0;
  const providerId = textValue(directValue(record, ID_KEYS));
  const asin = textValue(directValue(record, ASIN_KEYS)).toUpperCase();
  return {
    id: providerId || `${kind}:${normalizedKey(name)}:${normalizedKey(campaign)}:${normalizedKey(matchType)}`,
    name,
    campaign: kind === "campaign" ? name : campaign,
    asin,
    matchType,
    targetType,
    impressions,
    clicks,
    spend,
    sales,
    orders,
    acos: sales > 0 ? (spend / sales) * 100 : null,
    roas: spend > 0 ? sales / spend : null,
    conversionRate: clicks > 0 ? (orders / clicks) * 100 : null,
  };
}

function collectRows(value: unknown, kind: "campaign" | "target" | "search", depth = 0): PerformanceOverviewRow[] {
  if (depth > 6) return [];
  if (Array.isArray(value)) return value.flatMap(item => collectRows(item, kind, depth + 1));
  if (!isRecord(value)) return [];
  const row = rowFromRecord(value, kind);
  if (row) return [row];
  return Object.values(value).flatMap(item => collectRows(item, kind, depth + 1));
}

function uniqueRows(result: unknown, kind: "campaign" | "target" | "search") {
  const rows = new Map<string, PerformanceOverviewRow>();
  for (const payload of resultPayloads(result)) {
    for (const row of collectRows(payload, kind)) {
      const key = `${row.id}:${normalizedKey(row.name)}:${normalizedKey(row.campaign)}:${normalizedKey(row.matchType)}`;
      const existing = rows.get(key);
      if (!existing || row.sales > existing.sales || (row.sales === existing.sales && row.spend > existing.spend)) rows.set(key, row);
    }
  }
  return [...rows.values()].toSorted((first, second) => second.sales - first.sales || second.spend - first.spend || first.name.localeCompare(second.name));
}

function toolProperties(tool: Tool) {
  return isRecord(tool.inputSchema) && isRecord(tool.inputSchema.properties) ? tool.inputSchema.properties : {};
}

function buildArgs(tool: Tool, asins: string[], country: string, startDate: string, endDate: string, grouping?: string) {
  const properties = toolProperties(tool);
  const args: Record<string, unknown> = {};
  const set = (keys: string[], value: unknown) => {
    const key = keys.find(candidate => Object.prototype.hasOwnProperty.call(properties, candidate));
    if (key) args[key] = value;
  };
  const asinListKey = ["asin_list", "asinList", "asins"].find(key => Object.prototype.hasOwnProperty.call(properties, key));
  const asinKey = Object.prototype.hasOwnProperty.call(properties, "asin") ? "asin" : "";
  if (asinListKey) args[asinListKey] = asins;
  else if (asinKey && asins.length === 1) args[asinKey] = asins[0];
  else return null;
  set(["country", "country_code", "countryCode", "marketplace"], country);
  set(["start_date", "startDate", "from_date", "fromDate"], startDate);
  set(["end_date", "endDate", "to_date", "toDate"], endDate);
  set(["mode", "result_mode", "resultMode"], "raw");
  set(["summary_only", "summaryOnly"], false);
  set(["waste_only", "wasteOnly"], false);
  set(["sort_by", "sortBy"], "sales");
  set(["sort_direction", "sortDirection"], "desc");
  set(["count", "limit", "page_size", "pageSize"], PAGE_SIZE);
  set(["page", "page_number", "pageNumber"], 1);
  if (grouping === "campaign" && tool.name === "get_ads_performance") {
    const capability = getScaleInsightsCampaignToolCapabilities(tool.inputSchema);
    if (capability.grouping) args[capability.grouping.key] = capability.grouping.value;
  }
  return args;
}

function metadata(result: unknown) {
  const payload = resultPayloads(result).find(isRecord) ?? {};
  return [payload.oppMeta, payload.meta, payload.Meta, payload.metadata].find(isRecord) ?? {};
}

function freshness(result: unknown) {
  return textValue(directValue(metadata(result), ["data_as_of", "dataAsOf", "DataAsOf"]));
}

function currency(result: unknown) {
  const payload = resultPayloads(result).find(isRecord) ?? {};
  const scope = isRecord(payload.agg) ? payload.agg : payload;
  return textValue(directValue(scope, ["currency", "Currency"])) || "USD";
}

function extractSummary(adsResult: unknown, salesResult: unknown): PerformanceOverviewMetrics {
  const adsPayload = resultPayloads(adsResult).find(isRecord) ?? {};
  const adsMeta = [adsPayload.oppMeta, adsPayload.meta, adsPayload.Meta, adsPayload.metadata].find(isRecord);
  const adsTotals = adsMeta && [adsMeta.totals, adsMeta.Totals].find(isRecord);
  const adsScope = adsTotals || (isRecord(adsPayload.agg) ? adsPayload.agg : adsPayload);
  const salesPayload = resultPayloads(salesResult).find(isRecord) ?? {};
  const salesScope = isRecord(salesPayload.Summary) ? salesPayload.Summary : salesPayload;
  const number = (record: Record<string, unknown>, keys: string[]) => numberValue(nestedValue(record, keys)) ?? 0;
  return {
    totalSales: number(salesScope, TOTAL_SALES_KEYS),
    ppcSales: number(adsScope, SALES_KEYS),
    spend: number(adsScope, SPEND_KEYS),
    totalOrders: number(salesScope, TOTAL_ORDER_KEYS),
    ppcOrders: number(adsScope, ORDER_KEYS),
    clicks: number(adsScope, CLICK_KEYS),
  };
}

function section(rows: PerformanceOverviewRow[], available: boolean, unavailableMessage: string): PerformanceOverviewSection {
  return available
    ? { status: "ready", message: rows.length ? `${rows.length} rows from Scale Insights.` : "Scale Insights returned no rows for this scope.", rows }
    : { status: "unavailable", message: unavailableMessage, rows: [] };
}

export async function loadScaleInsightsPerformanceOverview(
  params: PerformanceOverviewParams,
  definitions: Tool[],
  callTool: ScaleInsightsToolCaller,
): Promise<PerformanceOverviewData> {
  const adsTool = definitions.find(tool => tool.name === "get_ads_performance");
  const salesTool = definitions.find(tool => tool.name === "get_sales_data");
  const targetTool = definitions.find(tool => tool.name === "get_target_performance" || tool.name === "get_keyword_performance");
  const searchTool = definitions.find(tool => tool.name === "get_search_term_performance");
  const ranges = {
    yesterday: { start: params.yesterday, end: params.yesterday },
    sevenDays: { start: params.sevenDayStart, end: params.yesterday },
    fourteenDays: { start: params.fourteenDayStart, end: params.yesterday },
    selectedRange: { start: params.actualStartDate, end: params.actualEndDate },
  };

  const selectedAdsArgs = adsTool && buildArgs(adsTool, params.asins, params.country, ranges.selectedRange.start, ranges.selectedRange.end, "campaign");
  const targetArgs = targetTool && buildArgs(targetTool, params.asins, params.country, ranges.selectedRange.start, ranges.selectedRange.end);
  const searchArgs = searchTool && buildArgs(searchTool, params.asins, params.country, ranges.selectedRange.start, ranges.selectedRange.end);
  const periodEntries = await Promise.all(Object.entries(ranges).map(async ([key, range]) => {
    const adsArgs = key === "selectedRange" ? selectedAdsArgs : adsTool && buildArgs(adsTool, params.asins, params.country, range.start, range.end, "total");
    const salesArgs = salesTool && buildArgs(salesTool, params.asins, params.country, range.start, range.end, "total");
    if (!adsTool || !salesTool || !adsArgs || !salesArgs) return [key, null, null, null] as const;
    const [adsResult, salesResult] = await Promise.all([callTool(adsTool.name, adsArgs), callTool(salesTool.name, salesArgs)]);
    return [key, extractSummary(adsResult, salesResult), adsResult, salesResult] as const;
  }));
  const selectedAdsResult = periodEntries.find(([key]) => key === "selectedRange")?.[2];
  const [targetResult, searchResult] = await Promise.all([
    targetTool && targetArgs ? callTool(targetTool.name, targetArgs) : Promise.resolve(null),
    searchTool && searchArgs ? callTool(searchTool.name, searchArgs) : Promise.resolve(null),
  ]);

  const campaignRows = selectedAdsResult ? uniqueRows(selectedAdsResult, "campaign") : [];
  const targetRows = targetResult ? uniqueRows(targetResult, "target") : [];
  const keywordRows = targetRows.filter(row => row.targetType.toLowerCase() !== "product" && !/^[A-Z0-9]{10}$/i.test(row.name));
  const productTargetRows = targetRows.filter(row => row.targetType.toLowerCase() === "product" || /^[A-Z0-9]{10}$/i.test(row.name));
  const searchRows = searchResult ? uniqueRows(searchResult, "search") : [];
  const scalarScopeMessage = params.asins.length > 1 ? "This Scale Insights tool accepts one ASIN at a time. Filter the dashboard to one ASIN." : "The connected Scale Insights integration does not expose this report.";
  const periods = Object.fromEntries(periodEntries.map(([key, metrics]) => [key, metrics])) as PerformanceOverviewData["periods"];
  const results = [selectedAdsResult, targetResult, searchResult].filter(Boolean);
  return {
    asins: params.asins,
    country: params.country,
    currency: results.map(currency).find(Boolean) || "USD",
    requestedPeriod: { startDate: params.requestedStartDate, endDate: params.requestedEndDate },
    actualPeriod: { startDate: params.actualStartDate, endDate: params.actualEndDate },
    freshness: results.map(freshness).filter(Boolean).toSorted().at(-1) || "",
    periods,
    sections: {
      keywords: section(keywordRows, Boolean(targetTool && targetArgs), scalarScopeMessage),
      campaigns: section(campaignRows, Boolean(adsTool && selectedAdsArgs), scalarScopeMessage),
      productTargets: section(productTargetRows, Boolean(targetTool && targetArgs), scalarScopeMessage),
      searchTerms: section(searchRows, Boolean(searchTool && searchArgs), scalarScopeMessage),
    },
    warnings: params.requestedEndDate !== params.actualEndDate ? [`Scale Insights excludes today and future dates. Actual data ends ${params.actualEndDate}.`] : [],
  };
}
