import { calculateWeeklyPerformance } from "./ppc-dashboard-state";
import type { ScaleInsightsWeeklyPerformance } from "../data/scale-insights-performance";

export const PPC_PERFORMANCE_CACHE_KEY = "glassco.ppcPerformanceCache.v1";
export type PerformanceCache = Record<string, ScaleInsightsWeeklyPerformance>;
export const performanceCacheKey = (asin: string, weekStart: string) => `US:${asin.trim().toUpperCase()}:${weekStart}`;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown) => typeof value === "string" ? value.slice(0, 500) : "";

export function parsePerformanceSnapshot(value: unknown): ScaleInsightsWeeklyPerformance | null {
  if (!record(value) || !record(value.metrics) || !record(value.freshness)) return null;
  const { asin, country, startDate, endDate, metrics } = value;
  if (typeof asin !== "string" || !/^[A-Z0-9]{10}$/.test(asin) || country !== "US") return null;
  if (typeof startDate !== "string" || typeof endDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate) return null;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start.toISOString().slice(0, 10) !== startDate || end.toISOString().slice(0, 10) !== endDate || start.getUTCDay() !== 3 || end.getTime() - start.getTime() > 6 * 86_400_000) return null;
  const { spend, ppcSales, ppcOrders, totalSales, totalOrders } = metrics;
  if (![spend, ppcSales, ppcOrders, totalSales, totalOrders].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0) || !Number.isInteger(ppcOrders) || !Number.isInteger(totalOrders)) return null;
  return {
    asin, country, startDate, endDate, currency: text(value.currency),
    metrics: calculateWeeklyPerformance({ spend: spend as number, ppcSales: ppcSales as number, ppcOrders: ppcOrders as number, totalSales: totalSales as number, totalOrders: totalOrders as number }),
    freshness: { adsDataAsOf: text(value.freshness.adsDataAsOf), salesDataAsOf: text(value.freshness.salesDataAsOf), salesDataThrough: text(value.freshness.salesDataThrough) },
    warnings: Array.isArray(value.warnings) ? value.warnings.filter((warning): warning is string => typeof warning === "string").slice(0, 10).map(text) : [],
  };
}

export function parsePerformanceCache(raw: string | null): PerformanceCache {
  try {
    const value: unknown = JSON.parse(raw || "null");
    if (!record(value) || value.version !== 1 || !record(value.entries)) return {};
    return Object.fromEntries(Object.values(value.entries).flatMap(candidate => {
      const snapshot = parsePerformanceSnapshot(candidate);
      return snapshot ? [[performanceCacheKey(snapshot.asin, snapshot.startDate), snapshot]] : [];
    }));
  } catch { return {}; }
}
