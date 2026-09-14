import type { Tool } from "@modelcontextprotocol/client";
import { unwrapScaleInsightsPayload, type ScaleInsightsToolCaller } from "./scale-insights-performance";
import type { UntargetedSalesOpportunities, UntargetedSalesOpportunity } from "../domain/untargeted-sales-opportunities";

export type UntargetedOpportunityParams = {
  asin: string;
  country: string;
  startDate: string;
  endDate: string;
  dataState: "Final" | "Partial";
};

export type OpportunityProviderErrorCode = "opportunity_capability_missing" | "opportunity_rows_unreadable" | "source_rows_unreadable";

export class ScaleInsightsOpportunityProviderError extends Error {
  constructor(readonly providerCode: OpportunityProviderErrorCode, message: string) {
    super(message);
    this.name = "ScaleInsightsOpportunityProviderError";
  }
}

export type OpportunityDiagnosticReporter = (event: string, details: Record<string, unknown>) => void;

type ProviderMetrics = Omit<UntargetedSalesOpportunity, "type" | "sourceCampaignId" | "sourceAdGroupId" | "sourceKeyword" | "sourceMatchType">;
type SourceValue = Pick<UntargetedSalesOpportunity, "sourceCampaignId" | "sourceAdGroupId" | "sourceKeyword" | "sourceMatchType"> & { term: string; sales: number; orders: number; spend: number };

const TERM_KEYS = ["search_term", "searchTerm", "SearchTerm", "customer_search_term", "customerSearchTerm", "search_query", "searchQuery", "SearchQuery", "query", "Query", "keyword_text", "keywordText", "KeywordText", "keyword", "Keyword", "target_asin", "targetAsin", "TargetASIN", "target", "Target", "entity", "Entity"];
const SALES_KEYS = ["sales", "Sales", "total_sales", "totalSales", "TotalSales", "ppc_sales", "ppcSales", "PPCSales", "attributed_sales", "attributedSales"];
const ORDERS_KEYS = ["orders", "Orders", "order", "Order", "total_orders", "totalOrders", "TotalOrders", "ppc_orders", "ppcOrders", "PPCOrders", "attributed_orders", "attributedOrders"];
const SPEND_KEYS = ["spend", "Spend", "total_spend", "totalSpend", "TotalSpend", "cost", "Cost", "ppc_cost", "ppcCost", "PPCCost"];
const IMPRESSION_KEYS = ["impression", "Impression", "impressions", "Impressions", "total_impressions", "totalImpressions", "TotalImpressions", "ppc_impressions", "ppcImpressions", "PPCImpressions"];
const CLICK_KEYS = ["clicks", "Clicks", "total_clicks", "totalClicks", "TotalClicks", "ppc_clicks", "ppcClicks", "PPCClicks"];
const ACOS_KEYS = ["acos", "ACOS", "aCoS", "total_acos", "totalAcos", "TotalACOS"];
const CAMPAIGN_ID_KEYS = ["campaign_id", "campaignId", "CampaignId", "CampaignID"];
const AD_GROUP_ID_KEYS = ["ad_group_id", "adGroupId", "AdGroupId", "AdGroupID"];
const PARENT_KEYWORD_KEYS = ["parent_keyword", "parentKeyword", "ParentKeyword"];
const PARENT_MATCH_TYPE_KEYS = ["parent_match_type", "parentMatchType", "ParentMatchType"];
const TARGET_TYPE_KEYS = ["target_type", "targetType", "TargetType"];
const TARGET_ENTITY_KEYS = ["target_asin", "targetAsin", "TargetASIN", "target", "Target", "entity", "Entity"];
const PAGE_SIZE = 500;
const MAX_PAGES = 5;
const ASIN_INPUT_KEYS = ["asin_list", "asinList", "asins", "asin"];
const PERIOD_START_KEYS = ["start_date", "startDate", "from_date", "fromDate"];
const PERIOD_END_KEYS = ["end_date", "endDate", "to_date", "toDate"];
const PERIOD_DAYS_KEYS = ["days", "lookback_days", "lookbackDays"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedKey(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function fieldValue(record: Record<string, unknown>, keys: string[]) {
  const values = new Map(Object.entries(record).map(([key, value]) => [normalizedKey(key), value]));
  for (const key of keys) {
    const value = values.get(normalizedKey(key));
    if (value != null && !isRecord(value) && !Array.isArray(value)) return value;
  }
  return undefined;
}

function nestedFieldValue(record: Record<string, unknown>, keys: string[], depth = 0): unknown {
  const direct = fieldValue(record, keys);
  if (direct !== undefined || depth >= 2) return direct;
  for (const candidate of Object.values(record)) {
    if (!isRecord(candidate)) continue;
    const nested = nestedFieldValue(candidate, keys, depth + 1);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

function stringValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/[$,£€¥%]/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function integerValue(value: unknown) {
  const parsed = numberValue(value);
  return parsed != null && Number.isInteger(parsed) ? parsed : null;
}

function recordTerm(record: Record<string, unknown>): string {
  const normalizeTerm = (value: string) => value.trim().replace(/\s+\([A-Z0-9]{10}\)$/i, "").trim();
  const direct = normalizeTerm(stringValue(fieldValue(record, TERM_KEYS)));
  if (direct) return direct;
  const accepted = new Set(TERM_KEYS.map(normalizedKey));
  for (const [key, candidate] of Object.entries(record)) {
    if (!accepted.has(normalizedKey(key)) || !isRecord(candidate)) continue;
    const nested = normalizeTerm(stringValue(fieldValue(candidate, ["value", "text", "name", "term", "query"])));
    if (nested) return nested;
  }
  for (const key of ["identity", "Identity"]) {
    const candidate = record[key];
    if (!isRecord(candidate)) continue;
    const nested = normalizeTerm(stringValue(fieldValue(candidate, TERM_KEYS)));
    if (nested) return nested;
  }
  return "";
}

function metricsFromRecord(record: Record<string, unknown>): ProviderMetrics | null {
  const term = recordTerm(record);
  const salesValue = nestedFieldValue(record, SALES_KEYS);
  const ordersValue = nestedFieldValue(record, ORDERS_KEYS);
  const spendValue = nestedFieldValue(record, SPEND_KEYS);
  const impressionValue = nestedFieldValue(record, IMPRESSION_KEYS);
  const clickValue = nestedFieldValue(record, CLICK_KEYS);
  if (!term || [salesValue, ordersValue, spendValue, impressionValue, clickValue].every(value => value === undefined)) return null;
  const sales = numberValue(salesValue);
  const orders = integerValue(ordersValue);
  const spend = numberValue(spendValue);
  const impressions = integerValue(impressionValue);
  const clicks = integerValue(clickValue);
  if (sales == null || orders == null || spend == null || impressions == null || clicks == null) return null;
  const providerAcos = numberValue(nestedFieldValue(record, ACOS_KEYS));
  const acos = providerAcos ?? (sales > 0 ? Math.round((spend / sales) * 10_000) / 100 : null);
  return { term, sales, orders, spend, impressions, clicks, acos };
}

function collectMetricRows(value: unknown, depth = 0): ProviderMetrics[] {
  if (depth > 6) return [];
  if (Array.isArray(value)) return value.flatMap(candidate => collectMetricRows(candidate, depth + 1));
  if (!isRecord(value)) return [];
  const metric = metricsFromRecord(value);
  if (metric) return [metric];
  return Object.values(value).flatMap(candidate => collectMetricRows(candidate, depth + 1));
}

function collectSourceRows(value: unknown, depth = 0): SourceValue[] {
  if (depth > 6) return [];
  if (Array.isArray(value)) return value.flatMap(candidate => collectSourceRows(candidate, depth + 1));
  if (!isRecord(value)) return [];
  const term = recordTerm(value);
  const sourceCampaignId = stringValue(nestedFieldValue(value, CAMPAIGN_ID_KEYS));
  const sourceAdGroupId = stringValue(nestedFieldValue(value, AD_GROUP_ID_KEYS)) || undefined;
  const sourceKeyword = stringValue(nestedFieldValue(value, PARENT_KEYWORD_KEYS)) || undefined;
  const sourceMatchType = stringValue(nestedFieldValue(value, PARENT_MATCH_TYPE_KEYS)) || undefined;
  const sales = numberValue(nestedFieldValue(value, SALES_KEYS)) ?? 0;
  const orders = integerValue(nestedFieldValue(value, ORDERS_KEYS)) ?? 0;
  const spend = numberValue(nestedFieldValue(value, SPEND_KEYS)) ?? 0;
  const current: SourceValue[] = term && sourceCampaignId ? [{ term, sourceCampaignId, sourceAdGroupId, sourceKeyword, sourceMatchType, sales, orders, spend }] : [];
  return [...current, ...Object.values(value).flatMap(candidate => collectSourceRows(candidate, depth + 1))];
}

function parseMarkdownRecords(text: string) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.includes("|"));
  for (let index = 0; index < lines.length - 2; index += 1) {
    const headers = lines[index].replace(/^\||\|$/g, "").split("|").map(value => value.trim());
    const separator = lines[index + 1].replace(/^\||\|$/g, "").split("|").map(value => value.trim());
    if (headers.length < 2 || separator.length !== headers.length || !separator.every(value => /^:?-{3,}:?$/.test(value))) continue;
    return lines.slice(index + 2).flatMap(line => {
      const cells = line.replace(/^\||\|$/g, "").split("|").map(value => value.trim());
      return cells.length === headers.length ? [Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex]]))] : [];
    });
  }
  return [];
}

function contentRecords(result: unknown) {
  if (!isRecord(result) || !Array.isArray(result.content)) return [];
  return result.content.flatMap(block => {
    if (!isRecord(block) || block.type !== "text" || typeof block.text !== "string") return [];
    try {
      const parsed: unknown = JSON.parse(block.text);
      return [parsed];
    } catch {
      return parseMarkdownRecords(block.text);
    }
  });
}

function structuredPayload(result: unknown) {
  try {
    return unwrapScaleInsightsPayload(result);
  } catch {
    return {};
  }
}

function payloads(result: unknown) {
  const payload = structuredPayload(result);
  return [payload, ...contentRecords(result)];
}

function metadata(payload: Record<string, unknown>) {
  const candidate = [payload.Meta, payload.meta, payload.oppMeta, payload.metadata].find(isRecord) ?? {};
  return candidate;
}

function totalCount(result: unknown) {
  const payload = structuredPayload(result);
  const meta = metadata(payload);
  return numberValue(fieldValue(meta, ["total_count", "totalCount", "TotalCount"]));
}

function freshness(result: unknown) {
  const payload = structuredPayload(result);
  return stringValue(fieldValue(metadata(payload), ["data_as_of", "dataAsOf", "DataAsOf"]));
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = stringValue(value).toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function paginationHasNext(result: unknown) {
  const payload = structuredPayload(result);
  return booleanValue(fieldValue(metadata(payload), ["has_next_page", "hasNextPage", "HasNextPage"]));
}

function returnedCount(result: unknown) {
  const payload = structuredPayload(result);
  return numberValue(fieldValue(metadata(payload), ["returned_count", "returnedCount", "ReturnedCount"]));
}

function currency(result: unknown) {
  const payload = structuredPayload(result);
  const scope = isRecord(payload.agg) ? payload.agg : payload;
  return stringValue(fieldValue(scope, ["currency", "Currency"])) || "USD";
}

function properties(tool: Tool) {
  return isRecord(tool.inputSchema) && isRecord(tool.inputSchema.properties) ? tool.inputSchema.properties : {};
}

export function buildOpportunityToolArgs(tool: Tool, params: UntargetedOpportunityParams, page = 1) {
  const available = properties(tool);
  const args: Record<string, unknown> = {};
  const set = (keys: string[], value: unknown) => {
    const key = keys.find(candidate => Object.prototype.hasOwnProperty.call(available, candidate));
    if (key) args[key] = value;
  };
  const days = Math.round((Date.parse(params.endDate) - Date.parse(params.startDate)) / 86_400_000) + 1;
  set(["asin_list", "asinList", "asins"], [params.asin]);
  set(["asin"], params.asin);
  set(["country", "country_code", "countryCode", "marketplace"], params.country);
  set(["start_date", "startDate", "from_date", "fromDate"], params.startDate);
  set(["end_date", "endDate", "to_date", "toDate"], params.endDate);
  set(["days", "lookback_days", "lookbackDays"], days);
  if (tool.name === "get_search_term_keyword_analysis") {
    set(["mode"], "harvest");
    set(["result_mode", "resultMode"], "raw");
  } else {
    set(["mode"], "raw");
    set(["waste_only", "wasteOnly"], false);
  }
  set(["sort_by", "sortBy"], "sales");
  set(["sort_direction", "sortDirection"], "desc");
  set(["summary_only", "summaryOnly"], false);
  set(["count", "limit", "page_size", "pageSize"], PAGE_SIZE);
  set(["page", "page_number", "pageNumber"], page);
  return args;
}

function hasAnyProperty(tool: Tool, keys: string[]) {
  const available = properties(tool);
  return keys.some(key => Object.prototype.hasOwnProperty.call(available, key));
}

function supportsSearchScope(tool: Tool) {
  return hasAnyProperty(tool, ASIN_INPUT_KEYS)
    && ((hasAnyProperty(tool, PERIOD_START_KEYS) && hasAnyProperty(tool, PERIOD_END_KEYS)) || hasAnyProperty(tool, PERIOD_DAYS_KEYS));
}

async function loadPages(tool: Tool, params: UntargetedOpportunityParams, callTool: ScaleInsightsToolCaller) {
  const results: unknown[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await callTool(tool.name, buildOpportunityToolArgs(tool, params, page));
    results.push(result);
    const hasNextPage = paginationHasNext(result);
    if (hasNextPage === false) break;
    if (hasNextPage === true) continue;
    const count = totalCount(result);
    const hasPage = Object.keys(properties(tool)).some(key => ["page", "page_number", "pageNumber"].includes(key));
    const pageSize = numberValue(fieldValue(metadata(structuredPayload(result)), ["page_size", "pageSize", "PageSize"])) ?? PAGE_SIZE;
    if (!hasPage || count == null || count <= page * pageSize) break;
  }
  return results;
}

function uniqueMetrics(results: unknown[]) {
  const map = new Map<string, ProviderMetrics>();
  for (const result of results) {
    for (const payload of payloads(result)) {
      for (const row of collectMetricRows(payload)) {
        const key = normalizedKey(row.term);
        const existing = map.get(key);
        if (!existing || row.sales > existing.sales) map.set(key, row);
      }
    }
  }
  return map;
}

function uniqueSources(results: unknown[]) {
  const map = new Map<string, SourceValue>();
  for (const result of results) {
    for (const payload of payloads(result)) {
      for (const row of collectSourceRows(payload)) {
        const key = normalizedKey(row.term);
        const existing = map.get(key);
        if (!existing || row.sales > existing.sales || (row.sales === existing.sales && (row.orders > existing.orders || (row.orders === existing.orders && row.spend > existing.spend)))) map.set(key, row);
      }
    }
  }
  return map;
}

function productTargetAsin(record: Record<string, unknown>) {
  if (stringValue(nestedFieldValue(record, TARGET_TYPE_KEYS)).toLowerCase() !== "product") return "";
  const raw = stringValue(fieldValue(record, TARGET_ENTITY_KEYS));
  const match = raw.match(/^([A-Z0-9]{10})(?:\s+\(product\))?$/i);
  return match?.[1].toUpperCase() ?? "";
}

function collectProductTargets(value: unknown, depth = 0): string[] {
  if (depth > 6) return [];
  if (Array.isArray(value)) return value.flatMap(candidate => collectProductTargets(candidate, depth + 1));
  if (!isRecord(value)) return [];
  const asin = productTargetAsin(value);
  return [...(asin ? [asin] : []), ...Object.values(value).flatMap(candidate => collectProductTargets(candidate, depth + 1))];
}

function uniqueProductTargets(results: unknown[]) {
  return new Set(results.flatMap(result => payloads(result).flatMap(payload => collectProductTargets(payload))).map(normalizedKey));
}

function resultSetIsComplete(results: unknown[]) {
  if (!results.length) return false;
  if (paginationHasNext(results.at(-1)) === false) return true;
  const count = totalCount(results[0]);
  if (count === 0) return true;
  const returned = results.reduce<number>((sum, result) => sum + (returnedCount(result) ?? 0), 0);
  return count != null && returned >= count;
}

export async function loadUntargetedSalesOpportunities(
  params: UntargetedOpportunityParams,
  definitions: Tool[],
  callTool: ScaleInsightsToolCaller,
  reportDiagnostic?: OpportunityDiagnosticReporter,
): Promise<UntargetedSalesOpportunities> {
  const searchTool = definitions.find(tool => tool.name === "get_search_term_performance");
  const sourceTool = definitions.find(tool => tool.name === "get_search_term_keyword_analysis");
  if (!searchTool || !sourceTool || !supportsSearchScope(searchTool) || !supportsSearchScope(sourceTool)) {
    throw new ScaleInsightsOpportunityProviderError("opportunity_capability_missing", "The connected Scale Insights tools do not expose safely scoped PPC search-term performance and campaign-attribution reporting.");
  }

  reportDiagnostic?.("opportunity_tool_contract", {
    searchTool: searchTool.name,
    searchProperties: Object.keys(properties(searchTool)).toSorted(),
    sourceTool: sourceTool.name,
    sourceProperties: Object.keys(properties(sourceTool)).toSorted(),
    period: { startDate: params.startDate, endDate: params.endDate },
  });
  const searchResults = await loadPages(searchTool, params, callTool);
  const metrics = uniqueMetrics(searchResults);
  const convertingMetrics = new Map([...metrics].filter(([, row]) => row.orders >= 1));
  reportDiagnostic?.("opportunity_search_result", { providerResultCount: totalCount(searchResults[0]), parsedRowCount: metrics.size, convertingRowCount: convertingMetrics.size });
  if (!metrics.size) {
    reportDiagnostic?.("opportunity_rows_unreadable", { resultCount: totalCount(searchResults[0]), tool: searchTool.name });
    if ((totalCount(searchResults[0]) ?? 0) > 0) throw new ScaleInsightsOpportunityProviderError("opportunity_rows_unreadable", "Scale Insights returned a PPC search-term format this version cannot read.");
  }
  const sourceResults = convertingMetrics.size
    ? await loadPages(sourceTool, params, callTool)
    : [];
  const sources = uniqueSources(sourceResults);
  reportDiagnostic?.("opportunity_source_result", { providerResultCount: totalCount(sourceResults[0]), parsedRowCount: sources.size });
  if (convertingMetrics.size > 0 && !sources.size) {
    reportDiagnostic?.("source_rows_unreadable", { resultCount: totalCount(sourceResults[0]), tool: sourceTool.name });
    if ((totalCount(sourceResults[0]) ?? 0) > 0) throw new ScaleInsightsOpportunityProviderError("source_rows_unreadable", "Scale Insights returned a campaign-attribution format this version cannot read.");
  }

  const productCandidateKeys = new Set([...convertingMetrics.entries()]
    .filter(([key]) => sources.has(key))
    .filter(([, row]) => /^[A-Z0-9]{10}$/i.test(row.term.trim()))
    .map(([key]) => key));
  const targetTool = definitions.find(tool => tool.name === "get_target_performance");
  const targetResults = productCandidateKeys.size && targetTool && supportsSearchScope(targetTool)
    ? await loadPages(targetTool, params, callTool)
    : [];
  const targetedProductAsins = uniqueProductTargets(targetResults);
  const productCoverageComplete = productCandidateKeys.size === 0 || resultSetIsComplete(targetResults);
  reportDiagnostic?.("opportunity_product_target_result", {
    candidateCount: productCandidateKeys.size,
    targetTool: targetTool?.name ?? null,
    targetProperties: targetTool ? Object.keys(properties(targetTool)).toSorted() : [],
    providerResultCount: totalCount(targetResults[0]),
    parsedProductTargetCount: targetedProductAsins.size,
    complete: productCoverageComplete,
  });

  const opportunities = [...convertingMetrics.entries()].flatMap(([key, row]): UntargetedSalesOpportunity[] => {
    const source = sources.get(key);
    if (!source) return [];
    const normalizedTerm = row.term.trim();
    const productAsin = /^[A-Z0-9]{10}$/i.test(normalizedTerm);
    if (productAsin && (!productCoverageComplete || targetedProductAsins.has(key))) return [];
    return [{
      ...row,
      term: productAsin ? normalizedTerm.toUpperCase() : normalizedTerm,
      type: productAsin ? "Product ASIN" : "Search term",
      sourceCampaignId: source.sourceCampaignId,
      sourceAdGroupId: source.sourceAdGroupId,
      sourceKeyword: source.sourceKeyword,
      sourceMatchType: source.sourceMatchType,
    }];
  }).toSorted((first, second) => second.sales - first.sales || second.orders - first.orders || first.term.localeCompare(second.term));

  const warnings: string[] = [];
  if (searchResults.length === MAX_PAGES && (totalCount(searchResults.at(-1)) ?? 0) > MAX_PAGES * PAGE_SIZE) warnings.push(`Search-query results were limited to ${MAX_PAGES * PAGE_SIZE} rows.`);
  if (sourceResults.length === MAX_PAGES && (totalCount(sourceResults.at(-1)) ?? 0) > MAX_PAGES * PAGE_SIZE) warnings.push(`Campaign-attribution results were limited to ${MAX_PAGES * PAGE_SIZE} rows.`);
  if (productCandidateKeys.size > 0 && !productCoverageComplete) warnings.push("Product ASIN opportunities were omitted because complete product-target coverage was unavailable.");
  return {
    asin: params.asin,
    country: params.country,
    dataState: params.dataState,
    period: { startDate: params.startDate, endDate: params.endDate },
    currency: currency(searchResults[0]),
    freshness: { searchDataAsOf: freshness(searchResults[0]), coverageDataAsOf: freshness(sourceResults[0]) },
    opportunities,
    warnings,
  };
}
