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

export type OpportunityProviderErrorCode = "opportunity_capability_missing" | "opportunity_rows_unreadable" | "coverage_rows_unreadable";

export class ScaleInsightsOpportunityProviderError extends Error {
  constructor(readonly providerCode: OpportunityProviderErrorCode, message: string) {
    super(message);
    this.name = "ScaleInsightsOpportunityProviderError";
  }
}

export type OpportunityDiagnosticReporter = (event: string, details: Record<string, unknown>) => void;

type ProviderMetrics = Omit<UntargetedSalesOpportunity, "type">;
type CoverageValue = { term: string; targeted: boolean };

const TERM_KEYS = ["search_term", "searchTerm", "SearchTerm", "customer_search_term", "customerSearchTerm", "search_query", "searchQuery", "SearchQuery", "query", "Query", "keyword_text", "keywordText", "KeywordText", "keyword", "Keyword", "target_asin", "targetAsin", "TargetASIN", "target", "Target"];
const SALES_KEYS = ["sales", "Sales", "total_sales", "totalSales", "TotalSales", "ppc_sales", "ppcSales", "PPCSales", "attributed_sales", "attributedSales"];
const ORDERS_KEYS = ["orders", "Orders", "order", "Order", "total_orders", "totalOrders", "TotalOrders", "ppc_orders", "ppcOrders", "PPCOrders", "attributed_orders", "attributedOrders"];
const SPEND_KEYS = ["spend", "Spend", "total_spend", "totalSpend", "TotalSpend", "cost", "Cost", "ppc_cost", "ppcCost", "PPCCost"];
const IMPRESSION_KEYS = ["impression", "Impression", "impressions", "Impressions", "total_impressions", "totalImpressions", "TotalImpressions", "ppc_impressions", "ppcImpressions", "PPCImpressions"];
const CLICK_KEYS = ["clicks", "Clicks", "total_clicks", "totalClicks", "TotalClicks", "ppc_clicks", "ppcClicks", "PPCClicks"];
const ACOS_KEYS = ["acos", "ACOS", "aCoS", "total_acos", "totalAcos", "TotalACOS"];
const TARGETED_KEYS = ["is_exact_targeted", "isExactTargeted", "exact_targeted", "exactTargeted", "is_exact_covered", "isExactCovered", "exact_covered", "exactCovered", "is_targeted", "isTargeted", "targeted", "Targeted", "has_exact_target", "hasExactTarget", "has_exact_match", "hasExactMatch", "exact_coverage", "exactCoverage", "covered", "Covered", "coverage_status", "coverageStatus", "CoverageStatus", "status", "Status"];
const PAGE_SIZE = 500;
const MAX_PAGES = 5;
const ASIN_INPUT_KEYS = ["asin_list", "asinList", "asins", "asin"];
const PERIOD_START_KEYS = ["start_date", "startDate", "from_date", "fromDate"];
const PERIOD_END_KEYS = ["end_date", "endDate", "to_date", "toDate"];
const PERIOD_DAYS_KEYS = ["days", "lookback_days", "lookbackDays"];
const TERM_LIST_INPUT_KEYS = ["query_list", "queryList", "search_terms", "searchTerms", "search_queries", "searchQueries", "queries", "keywords", "targets"];

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
  return parsed != null && Number.isInteger(parsed) ? parsed : 0;
}

function parseTargeted(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value > 0;
  const normalized = stringValue(value).toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ");
  if (!normalized) return null;
  if (/^(false|no|none|missing|uncovered|untargeted|not targeted|not covered|0)$/.test(normalized)) return false;
  if (/^(true|yes|covered|targeted|exact|1)$/.test(normalized)) return true;
  return null;
}

function recordTerm(record: Record<string, unknown>): string {
  const direct = stringValue(fieldValue(record, TERM_KEYS)).trim();
  if (direct) return direct;
  const accepted = new Set(TERM_KEYS.map(normalizedKey));
  for (const [key, candidate] of Object.entries(record)) {
    if (!accepted.has(normalizedKey(key)) || !isRecord(candidate)) continue;
    const nested = stringValue(fieldValue(candidate, ["value", "text", "name", "term", "query"])).trim();
    if (nested) return nested;
  }
  for (const candidate of Object.values(record)) {
    if (!isRecord(candidate)) continue;
    const nested: string = recordTerm(candidate);
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
  const sales = numberValue(salesValue) ?? 0;
  const orders = integerValue(ordersValue);
  const spend = numberValue(spendValue) ?? 0;
  const impressions = integerValue(impressionValue);
  const clicks = integerValue(clickValue);
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

function collectCoverageRows(value: unknown, path = "$", depth = 0): CoverageValue[] {
  if (depth > 6) return [];
  if (Array.isArray(value)) return value.flatMap(candidate => collectCoverageRows(candidate, path, depth + 1));
  if (!isRecord(value)) return [];
  const term = recordTerm(value);
  let targeted = parseTargeted(nestedFieldValue(value, TARGETED_KEYS));
  const normalizedPath = path.toLowerCase();
  if (targeted == null && term && /(uncovered|missing|untargeted|opportunit)/.test(normalizedPath)) targeted = false;
  if (targeted == null && term && /(covered|targeted)/.test(normalizedPath)) targeted = true;
  const current = term && targeted != null ? [{ term, targeted }] : [];
  return [...current, ...Object.entries(value).flatMap(([key, candidate]) => collectCoverageRows(candidate, `${path}.${key}`, depth + 1))];
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

function currency(result: unknown) {
  const payload = structuredPayload(result);
  const scope = isRecord(payload.agg) ? payload.agg : payload;
  return stringValue(fieldValue(scope, ["currency", "Currency"])) || "USD";
}

function properties(tool: Tool) {
  return isRecord(tool.inputSchema) && isRecord(tool.inputSchema.properties) ? tool.inputSchema.properties : {};
}

export function buildOpportunityToolArgs(tool: Tool, params: UntargetedOpportunityParams, page = 1, terms: string[] = []) {
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
  if (terms.length) set(TERM_LIST_INPUT_KEYS, terms);
  set(["mode"], "raw");
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

function supportsCoverageScope(tool: Tool) {
  return hasAnyProperty(tool, ASIN_INPUT_KEYS) || hasAnyProperty(tool, TERM_LIST_INPUT_KEYS);
}

async function loadPages(tool: Tool, params: UntargetedOpportunityParams, callTool: ScaleInsightsToolCaller, terms: string[] = []) {
  const results: unknown[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await callTool(tool.name, buildOpportunityToolArgs(tool, params, page, terms));
    results.push(result);
    const count = totalCount(result);
    const hasPage = Object.keys(properties(tool)).some(key => ["page", "page_number", "pageNumber"].includes(key));
    if (!hasPage || count == null || count <= page * PAGE_SIZE) break;
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

function uniqueCoverage(results: unknown[]) {
  const map = new Map<string, boolean>();
  for (const result of results) {
    for (const payload of payloads(result)) {
      for (const row of collectCoverageRows(payload)) map.set(normalizedKey(row.term), row.targeted);
    }
  }
  return map;
}

export async function loadUntargetedSalesOpportunities(
  params: UntargetedOpportunityParams,
  definitions: Tool[],
  callTool: ScaleInsightsToolCaller,
  reportDiagnostic?: OpportunityDiagnosticReporter,
): Promise<UntargetedSalesOpportunities> {
  const searchTool = definitions.find(tool => tool.name === "get_search_query_data");
  const coverageTool = definitions.find(tool => tool.name === "get_ppc_exact_coverage");
  if (!searchTool || !coverageTool || !supportsSearchScope(searchTool) || !supportsCoverageScope(coverageTool)) {
    throw new ScaleInsightsOpportunityProviderError("opportunity_capability_missing", "The connected Scale Insights tools do not expose safely scoped search-query and exact-coverage reporting.");
  }

  reportDiagnostic?.("opportunity_tool_contract", {
    searchTool: searchTool.name,
    searchProperties: Object.keys(properties(searchTool)).toSorted(),
    coverageTool: coverageTool.name,
    coverageProperties: Object.keys(properties(coverageTool)).toSorted(),
    period: { startDate: params.startDate, endDate: params.endDate },
  });
  const searchResults = await loadPages(searchTool, params, callTool);
  const metrics = uniqueMetrics(searchResults);
  reportDiagnostic?.("opportunity_search_result", { providerResultCount: totalCount(searchResults[0]), parsedRowCount: metrics.size });
  if (!metrics.size) {
    reportDiagnostic?.("opportunity_rows_unreadable", { resultCount: totalCount(searchResults[0]), tool: searchTool.name });
    if ((totalCount(searchResults[0]) ?? 0) > 0) throw new ScaleInsightsOpportunityProviderError("opportunity_rows_unreadable", "Scale Insights returned a search-query format this version cannot read.");
  }
  const coverageResults = metrics.size
    ? await loadPages(coverageTool, params, callTool, [...metrics.values()].map(row => row.term))
    : [];
  const coverage = uniqueCoverage(coverageResults);
  reportDiagnostic?.("opportunity_coverage_result", { providerResultCount: totalCount(coverageResults[0]), parsedRowCount: coverage.size });
  if (!coverage.size) {
    reportDiagnostic?.("coverage_rows_unreadable", { resultCount: totalCount(coverageResults[0]), tool: coverageTool.name });
    if ((totalCount(coverageResults[0]) ?? 0) > 0) throw new ScaleInsightsOpportunityProviderError("coverage_rows_unreadable", "Scale Insights returned an exact-coverage format this version cannot read.");
  }

  const opportunities = [...metrics.entries()].flatMap(([key, row]): UntargetedSalesOpportunity[] => {
    if (coverage.get(key) !== false) return [];
    const normalizedTerm = row.term.trim();
    const productAsin = /^[A-Z0-9]{10}$/i.test(normalizedTerm);
    return [{ ...row, term: productAsin ? normalizedTerm.toUpperCase() : normalizedTerm, type: productAsin ? "Product ASIN" : "Search term" }];
  }).toSorted((first, second) => second.sales - first.sales || second.orders - first.orders || first.term.localeCompare(second.term));

  const warnings: string[] = [];
  if (searchResults.length === MAX_PAGES && (totalCount(searchResults.at(-1)) ?? 0) > MAX_PAGES * PAGE_SIZE) warnings.push(`Search-query results were limited to ${MAX_PAGES * PAGE_SIZE} rows.`);
  if (coverageResults.length === MAX_PAGES && (totalCount(coverageResults.at(-1)) ?? 0) > MAX_PAGES * PAGE_SIZE) warnings.push(`Exact-coverage results were limited to ${MAX_PAGES * PAGE_SIZE} rows.`);
  return {
    asin: params.asin,
    country: params.country,
    dataState: params.dataState,
    period: { startDate: params.startDate, endDate: params.endDate },
    currency: currency(searchResults[0]),
    freshness: { searchDataAsOf: freshness(searchResults[0]), coverageDataAsOf: freshness(coverageResults[0]) },
    opportunities,
    warnings,
  };
}
