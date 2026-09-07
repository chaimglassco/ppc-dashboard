import { expect, it } from "vitest";
import { parsePerformanceCache, parsePerformanceSnapshot, performanceCacheKey } from "./ppc-performance-cache";

const snapshot = {
  asin: "B0FG4H5C6W", country: "US", startDate: "2026-08-26", endDate: "2026-09-01", currency: "USD",
  metrics: { spend: 0, ppcSales: 0, ppcOrders: 0, totalSales: 0, totalOrders: 0, acos: 999 },
  freshness: { adsDataAsOf: "ads", salesDataAsOf: "sales", salesDataThrough: "2026-09-01" }, warnings: [],
};
it("restores genuine zero-valued snapshots and recalculates derived metrics", () => {
  const entries = parsePerformanceCache(JSON.stringify({ version: 1, entries: { wrongKey: snapshot } }));
  expect(entries[performanceCacheKey(snapshot.asin, snapshot.startDate)].metrics.acos).toBe(0);
  expect(Object.keys(entries)).toEqual(["US:B0FG4H5C6W:2026-08-26"]);
});
it("rejects invalid metrics, dates, marketplace, and malformed storage", () => {
  expect(parsePerformanceCache("invalid")).toEqual({});
  expect(parsePerformanceSnapshot({ ...snapshot, country: "CA" })).toBeNull();
  expect(parsePerformanceSnapshot({ ...snapshot, endDate: "2026-09-12" })).toBeNull();
  expect(parsePerformanceSnapshot({ ...snapshot, endDate: "2026-08-32" })).toBeNull();
  expect(parsePerformanceSnapshot({ ...snapshot, metrics: { ...snapshot.metrics, spend: -1 } })).toBeNull();
  expect(parsePerformanceSnapshot({ ...snapshot, metrics: { ...snapshot.metrics, ppcOrders: 1.5 } })).toBeNull();
});
