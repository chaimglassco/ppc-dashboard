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
    summary_only: true,
  };
  const [adsResult, salesResult] = await Promise.all([
    callTool("get_ads_performance", commonArgs),
    callTool("get_sales_data", { ...commonArgs, group_by: "total", include_growth: false }),
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
  const salesPpcCost = finiteNonNegative(salesSummary.TotalPPCCost, "sales-report PPC Cost");
  const salesPpcSales = finiteNonNegative(salesSummary.TotalPPCSales, "sales-report PPC Sales");
  const warnings: string[] = [];

  if (!centsEqual(spend, salesPpcCost) || !centsEqual(ppcSales, salesPpcSales)) {
    warnings.push("Scale Insights advertising and sales reports were synced at different times; paid totals do not yet match exactly.");
  }
  if (ppcSales > totalSales || ppcOrders > totalOrders) {
    warnings.push("Paid attribution exceeds the total-sales report for this period; organic values were clamped to zero.");
  }

  return {
    ...params,
    currency: stringValue(adsAggregate.Currency) || "USD",
    metrics: calculateWeeklyPerformance({ spend, ppcSales, ppcOrders, totalSales, totalOrders }),
    freshness: {
      adsDataAsOf: stringValue(adsMeta.data_as_of),
      salesDataAsOf: stringValue(salesMeta.data_as_of),
      salesDataThrough: stringValue(salesMeta.data_through),
    },
    warnings,
  };
}
