import { calculateWeeklyPerformance, type WeeklyPerformanceCalculatedMetrics } from "../domain/ppc-dashboard-state";

export type ScaleInsightsToolCaller = (name: string, args: Record<string, unknown>) => Promise<unknown>;

export type ScaleInsightsWeeklyPerformanceParams = {
  asin: string;
  country: string;
  startDate: string;
  endDate: string;
};

export type ScaleInsightsWeeklyPerformance = ScaleInsightsWeeklyPerformanceParams & {
  currency: string;
  metrics: WeeklyPerformanceCalculatedMetrics;
  freshness: {
    adsDataAsOf: string;
    salesDataAsOf: string;
    salesDataThrough: string;
  };
  warnings: string[];
};

export class ScaleInsightsDataError extends Error {
  constructor(public readonly code: "invalid_response" | "no_data", message: string) {
    super(message);
    this.name = "ScaleInsightsDataError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordAt(value: unknown, key: string): Record<string, unknown> {
  if (!isRecord(value) || !isRecord(value[key])) throw new ScaleInsightsDataError("invalid_response", `Scale Insights omitted ${key}.`);
  return value[key];
}

function finiteNonNegative(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ScaleInsightsDataError("invalid_response", `Scale Insights returned an invalid ${field}.`);
  }
  return value;
}

function nonNegativeInteger(value: unknown, field: string): number {
  const number = finiteNonNegative(value, field);
  if (!Number.isInteger(number)) throw new ScaleInsightsDataError("invalid_response", `Scale Insights returned a non-integer ${field}.`);
  return number;
}

const PPC_CLICK_KEYS = [
  "total_clicks", "TotalClicks", "totalClicks", "PPCClicks", "ppcClicks", "TotalPPCClicks", "totalPpcClicks",
  "clicks", "Clicks", "click_count", "clickCount", "PPC_Clicks",
];
const ASIN_KEYS = ["asin", "ASIN", "product_asin", "productAsin", "ProductASIN"];

function normalizedKey(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function directPrimitive(record: Record<string, unknown>, keys: string[]) {
  const accepted = new Set(keys.map(normalizedKey));
  for (const [key, value] of Object.entries(record)) {
    if (accepted.has(normalizedKey(key)) && value != null && !isRecord(value) && !Array.isArray(value)) return value;
  }
  return undefined;
}

function numericInteger(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 && Number.isInteger(value) ? value : undefined;
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function collectScopedClickCounts(value: unknown, asin: string, depth = 0): number[] {
  if (depth > 5) return [];
  if (Array.isArray(value)) return value.flatMap(item => collectScopedClickCounts(item, asin, depth + 1));
  if (!isRecord(value)) return [];
  const rowAsin = String(directPrimitive(value, ASIN_KEYS) ?? "").trim().toUpperCase();
  const clickCount = numericInteger(directPrimitive(value, PPC_CLICK_KEYS));
  const current = rowAsin === asin && clickCount != null ? [clickCount] : [];
  return [...current, ...Object.values(value).flatMap(item => collectScopedClickCounts(item, asin, depth + 1))];
}

function collectTextClickCounts(result: unknown, asin: string) {
  if (!isRecord(result) || !Array.isArray(result.content)) return [];
  return result.content.flatMap(block => {
    if (!isRecord(block) || block.type !== "text" || typeof block.text !== "string") return [];
    const text = block.text.trim();
    try {
      const parsed: unknown = JSON.parse(text);
      const counts = collectScopedClickCounts(parsed, asin);
      if (counts.length) return counts;
    } catch {
      // Continue with a provider-rendered Markdown table.
    }
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.includes("|"));
    for (let index = 0; index < lines.length - 2; index += 1) {
      const headers = lines[index].replace(/^\||\|$/g, "").split("|").map(value => value.trim());
      const separator = lines[index + 1].replace(/^\||\|$/g, "").split("|").map(value => value.trim());
      if (separator.length !== headers.length || !separator.every(value => /^:?-{3,}:?$/.test(value))) continue;
      const asinIndex = headers.findIndex(header => ASIN_KEYS.map(normalizedKey).includes(normalizedKey(header)));
      const clickIndex = headers.findIndex(header => PPC_CLICK_KEYS.map(normalizedKey).includes(normalizedKey(header)));
      if (asinIndex < 0 || clickIndex < 0) continue;
      return lines.slice(index + 2).flatMap(line => {
        const cells = line.replace(/^\||\|$/g, "").split("|").map(value => value.trim());
        if (cells.length !== headers.length || cells[asinIndex].toUpperCase() !== asin) return [];
        const count = numericInteger(cells[clickIndex]);
        return count == null ? [] : [count];
      });
    }
    return [];
  });
}

function exactPpcClicks(result: unknown, payload: Record<string, unknown>, totals: Record<string, unknown>, aggregate: Record<string, unknown>, asin: string) {
  const direct = [
    directPrimitive(totals, PPC_CLICK_KEYS),
    directPrimitive(aggregate, PPC_CLICK_KEYS),
  ].map(numericInteger).find(value => value != null);
  if (direct != null) return direct;
  const candidates = [...new Set([...collectScopedClickCounts(payload, asin), ...collectTextClickCounts(result, asin)])];
  return candidates.length === 1 ? candidates[0] : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toolErrorMessage(result: Record<string, unknown>) {
  if (!Array.isArray(result.content)) return "Scale Insights rejected the request.";
  const message = result.content
    .filter(isRecord)
    .filter(block => block.type === "text")
    .map(block => stringValue(block.text))
    .find(Boolean);
  return message || "Scale Insights rejected the request.";
}

export function unwrapScaleInsightsPayload(result: unknown): Record<string, unknown> {
  if (!isRecord(result)) throw new ScaleInsightsDataError("invalid_response", "Scale Insights returned an unreadable response.");
  if (result.isError === true) throw new ScaleInsightsDataError("invalid_response", toolErrorMessage(result));
  if (isRecord(result.structuredContent)) return result.structuredContent;
  if (!Array.isArray(result.content)) return result;

  for (const block of result.content) {
    if (!isRecord(block) || block.type !== "text" || typeof block.text !== "string") continue;
    try {
      const parsed: unknown = JSON.parse(block.text);
      if (isRecord(parsed)) return parsed;
    } catch {
      continue;
    }
  }
  throw new ScaleInsightsDataError("invalid_response", "Scale Insights returned no structured performance data.");
}

function assertScope(payload: Record<string, unknown>, expected: ScaleInsightsWeeklyPerformanceParams, scope: Record<string, unknown>) {
  const country = stringValue(scope.Country ?? payload.Country).toUpperCase();
  const startDate = stringValue(scope.StartDate ?? payload.StartDate);
  const endDate = stringValue(scope.EndDate ?? payload.EndDate);
  if (country !== expected.country || startDate !== expected.startDate || endDate !== expected.endDate) {
    throw new ScaleInsightsDataError("invalid_response", "Scale Insights returned data for a different marketplace or date range.");
  }
}

function centsEqual(first: number, second: number) {
  return Math.round(first * 100) === Math.round(second * 100);
}

export async function loadScaleInsightsWeeklyPerformance(
  params: ScaleInsightsWeeklyPerformanceParams,
  callTool: ScaleInsightsToolCaller,
): Promise<ScaleInsightsWeeklyPerformance> {
  const commonArgs = {
    asin_list: [params.asin],
    country: params.country,
    start_date: params.startDate,
    end_date: params.endDate,
    mode: "raw",
  };
  const [adsResult, salesResult] = await Promise.all([
    callTool("get_ads_performance", { ...commonArgs, summary_only: false, count: 1, page: 1 }),
    callTool("get_sales_data", { ...commonArgs, summary_only: true, group_by: "total", include_growth: false }),
  ]);

  const ads = unwrapScaleInsightsPayload(adsResult);
  const sales = unwrapScaleInsightsPayload(salesResult);
  const adsAggregate = recordAt(ads, "agg");
  const adsMeta = recordAt(ads, "oppMeta");
  const adsTotals = recordAt(adsMeta, "totals");
  const salesSummary = recordAt(sales, "Summary");
  const salesMeta = recordAt(sales, "Meta");

  assertScope(ads, params, adsAggregate);
  assertScope(sales, params, sales);
  if (finiteNonNegative(adsMeta.total_count, "advertising result count") < 1 || finiteNonNegative(salesMeta.total_count, "sales result count") < 1) {
    throw new ScaleInsightsDataError("no_data", "Scale Insights has no data for this ASIN and reporting period.");
  }

  const spend = finiteNonNegative(adsTotals.total_spend, "Spend");
  const ppcSales = finiteNonNegative(adsTotals.total_sales, "PPC Sales");
  const ppcOrders = nonNegativeInteger(adsTotals.total_orders, "PPC Orders");
  const totalSales = finiteNonNegative(salesSummary.TotalSales, "Total Sales");
  const totalOrders = nonNegativeInteger(salesSummary.TotalOrders, "Total Orders");
  const totalSessions = nonNegativeInteger(salesSummary.TotalSessions, "Total Sessions");
  const ppcClicks = exactPpcClicks(adsResult, ads, adsTotals, adsAggregate, params.asin)
    ?? numericInteger(directPrimitive(salesSummary, PPC_CLICK_KEYS));
  const salesPpcCost = finiteNonNegative(salesSummary.TotalPPCCost, "sales-report PPC Cost");
  const salesPpcSales = finiteNonNegative(salesSummary.TotalPPCSales, "sales-report PPC Sales");
  const warnings: string[] = [];

  if (!centsEqual(spend, salesPpcCost) || !centsEqual(ppcSales, salesPpcSales)) {
    warnings.push("Scale Insights advertising and sales reports were synced at different times; paid totals do not yet match exactly.");
  }
  if (ppcSales > totalSales || ppcOrders > totalOrders) {
    warnings.push("Paid attribution exceeds the total-sales report for this period; organic values were clamped to zero.");
  }
  if (ppcClicks == null) {
    warnings.push("Scale Insights did not include PPC Clicks for this reporting period; PPC Conversion Rate is unavailable.");
  }

  return {
    ...params,
    currency: stringValue(adsAggregate.Currency) || "USD",
    metrics: calculateWeeklyPerformance({ spend, ppcSales, ppcOrders, totalSales, totalOrders, totalSessions, ...(ppcClicks == null ? {} : { ppcClicks }) }),
    freshness: {
      adsDataAsOf: stringValue(adsMeta.data_as_of),
      salesDataAsOf: stringValue(salesMeta.data_as_of),
      salesDataThrough: stringValue(salesMeta.data_through),
    },
    warnings,
  };
}
