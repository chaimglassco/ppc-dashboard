import { describe, expect, it } from "vitest";
import { addDaysIso, calculateWeeklyPerformance, createWeeklyPpcReport, formatReportingMonthRange, formatWeekRange, formatWeeklyGoalTarget, formatWeeklyGoalValue, getMonthWeekStarts, getSelectedMonthWeekStarts, parsePpcDashboardStore, reportKey, startOfWeekIso, weeklyGoalActualValue, weeklyGoalUnit, withCalculatedPerformance } from "./ppc-dashboard-state";

describe("PPC dashboard state", () => {
  it("creates stable product/week report keys for Wednesday through Tuesday periods", () => {
    expect(startOfWeekIso("2026-08-26")).toBe("2026-08-26");
    expect(startOfWeekIso("2026-09-01")).toBe("2026-08-26");
    expect(startOfWeekIso("2026-09-02")).toBe("2026-09-02");
    expect(addDaysIso("2026-08-26", 6)).toBe("2026-09-01");
    expect(reportKey("product-1", "2026-08-26")).toBe("product-1:2026-08-26");
    expect(formatWeekRange("2026-08-26")).toBe("August 26 to September 1");
    expect(formatWeekRange("2026-09-02")).toBe("September 2 to September 8");
    expect(getMonthWeekStarts("2026-08-28")).toContain("2026-08-26");
  });

  it("validates browser drafts, migrates legacy Monday keys, and discards malformed records", () => {
    const report = { ...createWeeklyPpcReport("product-1", "2026-08-24"), weeklyBudget: 2000, notes: "Keep this" };
    const parsed = parsePpcDashboardStore(JSON.stringify({ version: 1, reports: { anything: report, bad: { productId: "" } } }));
    expect(Object.keys(parsed.reports)).toEqual(["product-1:2026-08-26"]);
    expect(parsed.reports["product-1:2026-08-26"].weekStart).toBe("2026-08-26");
    expect(parsed.reports["product-1:2026-08-26"].weeklyBudget).toBe(2000);
    expect(parsed.reports["product-1:2026-08-26"].targetAcos).toBe(0);
    expect(parsed.reports["product-1:2026-08-26"].notes).toBe("Keep this");
    expect(parsePpcDashboardStore("not json")).toEqual({ version: 1, reports: {} });
  });

  it("validates budget history while keeping older reports backward compatible", () => {
    const parsed = parsePpcDashboardStore(JSON.stringify({ version: 1, reports: { report: {
      ...createWeeklyPpcReport("product-1", "2026-08-26"),
      budgetHistory: [
        { id: "valid", changedAt: "2026-09-08T01:00:00.000Z", from: 30, to: 50 },
        { id: "same", changedAt: "2026-09-08T01:00:00.000Z", from: 50, to: 50 },
        { id: "invalid", changedAt: "not-a-date", from: 50, to: 80 },
      ],
    } } }));

    expect(parsed.reports["product-1:2026-08-26"].budgetHistory).toEqual([
      { id: "valid", changedAt: "2026-09-08T01:00:00.000Z", from: 30, to: 50 },
    ]);
    expect(parsePpcDashboardStore(JSON.stringify({ version: 1, reports: { legacy: {
      productId: "legacy-product", weekStart: "2026-08-26",
    } } })).reports["legacy-product:2026-08-26"].budgetHistory).toEqual([]);
  });

  it("validates goal history and migrates terminal legacy goals out of the active list", () => {
    const parsed = parsePpcDashboardStore(JSON.stringify({ version: 1, reports: { report: {
      ...createWeeklyPpcReport("product-1", "2026-08-26"),
      updatedAt: "2026-09-02T01:00:00.000Z",
      goals: [
        { id: "active", title: "Active goal", target: "10", actual: "8", status: "At Risk" },
        { id: "legacy-done", title: "Legacy completed goal", target: "10", actual: "10", status: "Achieved" },
      ],
      goalHistory: [
        { id: "missed", title: "Missed goal", target: "20", actual: "12", status: "Missed", resolvedAt: "2026-09-01T01:00:00.000Z" },
        { id: "invalid", title: "Invalid history", target: "", actual: "", status: "On Track", resolvedAt: "not-a-date" },
      ],
    } } }));

    const report = parsed.reports["product-1:2026-08-26"];
    expect(report.goals.map(goal => goal.id)).toEqual(["active"]);
    expect(report.goalHistory).toEqual([
      { id: "missed", title: "Missed goal", target: "20", actual: "12", status: "Missed", resolvedAt: "2026-09-01T01:00:00.000Z" },
      { id: "legacy-done", title: "Legacy completed goal", target: "10", actual: "10", status: "Achieved", resolvedAt: "2026-09-02T01:00:00.000Z" },
    ]);
    expect(parsePpcDashboardStore(JSON.stringify({ version: 1, reports: { legacy: {
      productId: "legacy-product", weekStart: "2026-08-26",
    } } })).reports["legacy-product:2026-08-26"].goalHistory).toEqual([]);
  });

  it("validates structured goal metrics and derives their actual values from weekly performance", () => {
    const report = withCalculatedPerformance({
      ...createWeeklyPpcReport("product-1", "2026-08-26"),
      spend: 82.4, ppcSales: 500, totalSales: 1200, ppcOrders: 20, totalOrders: 50,
    });
    const organicGoal = { id: "organic", title: "Organic Order", metric: "organicOrders" as const, unit: "percentage" as const, target: "65", actual: "", status: "On Track" as const };

    expect(formatWeeklyGoalValue(report.goals[0], weeklyGoalActualValue(report.goals[0], report))).toBe("16%");
    expect(formatWeeklyGoalValue(report.goals[1], weeklyGoalActualValue(report.goals[1], report))).toBe("$500");
    expect(formatWeeklyGoalValue(organicGoal, weeklyGoalActualValue(organicGoal, report))).toBe("60%");
    expect(weeklyGoalUnit("organicOrders", "number")).toBe("number");
    expect(formatWeeklyGoalTarget({ ...report.goals[1], target: "2000" })).toBe("$2,000.00");
    expect(formatWeeklyGoalTarget({ ...report.goals[0], target: "25" })).toBe("25.00%");
    expect(formatWeeklyGoalTarget({ id: "legacy", title: "Legacy", target: "$500", actual: "", status: "On Track" })).toBe("$500");
    expect(weeklyGoalActualValue({ ...report.goals[1], metric: "totalSales" }, report)).toBe(1200);
    expect(weeklyGoalActualValue({ ...report.goals[0], metric: "tacos" }, report)).toBe(6.87);

    const parsed = parsePpcDashboardStore(JSON.stringify({ version: 1, reports: { report: {
      ...report,
      goals: [
        { id: "legacy-acos", title: "Reduce ACOS", target: "25%", actual: "", status: "On Track" },
        { id: "bad-unit", title: "Spend", metric: "spend", unit: "percentage", target: "100", actual: "", status: "On Track" },
        { id: "legacy-sales", title: "Sales", metric: "sales", unit: "currency", target: "500", actual: "", status: "On Track" },
        { id: "total-orders", title: "Total Orders", target: "50", actual: "", status: "On Track" },
        { id: "tacos", title: "TACOS", target: "10", actual: "", status: "On Track" },
      ],
    } } }));
    expect(parsed.reports["product-1:2026-08-26"].goals).toEqual([
      expect.objectContaining({ id: "legacy-acos", metric: "acos", unit: "percentage" }),
      expect.objectContaining({ id: "bad-unit", metric: "decreaseSpend", unit: "currency" }),
      expect.objectContaining({ id: "legacy-sales", metric: "ppcSales", unit: "currency" }),
      expect.objectContaining({ id: "total-orders", metric: "totalOrders", unit: "number" }),
      expect.objectContaining({ id: "tacos", metric: "tacos", unit: "percentage" }),
    ]);
  });

  it("unions selected months, includes boundary weeks, and describes their full coverage", () => {
    expect(getSelectedMonthWeekStarts(["2026-09"], "2026-09-02")).toEqual(["2026-09-02", "2026-08-26"]);
    expect(formatReportingMonthRange(["2026-09-02", "2026-08-26"])).toBe("August & September 2026");

    const augustAndSeptember = getSelectedMonthWeekStarts(["2026-08", "2026-09"], "2026-09-02");
    expect(augustAndSeptember).toEqual(["2026-09-02", "2026-08-26", "2026-08-19", "2026-08-12", "2026-08-05", "2026-07-29"]);
    expect(formatReportingMonthRange(augustAndSeptember)).toBe("July–September 2026");
    expect(getSelectedMonthWeekStarts(["invalid", "2026-13"], "2026-09-02")).toEqual([]);
  });

  it("migrates legacy sales and order metrics into the expanded performance report", () => {
    const legacyReport = {
      productId: "product-1", weekStart: "2026-08-26", status: "Draft", sales: 320, orders: 8,
    };
    const parsed = parsePpcDashboardStore(JSON.stringify({ version: 1, reports: { legacy: legacyReport } }));

    expect(parsed.reports["product-1:2026-08-26"]).toMatchObject({
      ppcSales: 320, organicSales: 0, totalSales: 320,
      ppcOrders: 8, organicOrders: 0, totalOrders: 8,
    });
  });

  it("calculates organic results and efficiency metrics from verified totals", () => {
    const calculated = withCalculatedPerformance({
      ...createWeeklyPpcReport("product-1", "2026-08-26"),
      spend: 75, ppcSales: 100, totalSales: 300, ppcOrders: 3, totalOrders: 8,
    });

    expect(calculated).toMatchObject({ organicSales: 200, organicOrders: 5, acos: 75, tacos: 25 });
  });

  it("validates and preserves a weekly Target ACOS", () => {
    const report = { ...createWeeklyPpcReport("product-1", "2026-08-26"), targetAcos: 24.5 };
    const parsed = parsePpcDashboardStore(JSON.stringify({ version: 1, reports: { report } }));
    expect(parsed.reports["product-1:2026-08-26"].targetAcos).toBe(24.5);

    const invalid = parsePpcDashboardStore(JSON.stringify({ version: 1, reports: { report: { ...report, targetAcos: -1 } } }));
    expect(invalid.reports["product-1:2026-08-26"].targetAcos).toBe(0);
  });

  it("rounds currency differences and handles zero denominators without invalid percentages", () => {
    expect(calculateWeeklyPerformance({
      spend: 12.34, ppcSales: 0, totalSales: 20.1, ppcOrders: 4, totalOrders: 3,
    })).toEqual({
      spend: 12.34, ppcSales: 0, totalSales: 20.1, ppcOrders: 4, totalOrders: 3,
      organicSales: 20.1, organicOrders: 0, acos: 0, tacos: 61.39,
    });
  });

  it("carries unfinished goals into the following week and resets their progress", () => {
    const previous = {
      ...createWeeklyPpcReport("product-1", "2026-08-26"),
      goals: [
        { id: "done", title: "Completed goal", target: "10", actual: "10", status: "Achieved" as const },
        { id: "risk", title: "Improve ACOS", target: "25%", actual: "32%", status: "At Risk" as const },
        { id: "missed", title: "Increase sales", target: "$500", actual: "$300", status: "Missed" as const },
      ],
      previousWeekResult: "Carry this result into next week.",
    };
    const next = createWeeklyPpcReport("product-1", "2026-09-02", previous);

    expect(next.goals.map(goal => ({ title: goal.title, actual: goal.actual, status: goal.status }))).toEqual([
      { title: "Improve ACOS", actual: "", status: "On Track" },
    ]);
    expect(next.previousWeekResult).toBe("Carry this result into next week.");
  });
});
