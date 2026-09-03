import { describe, expect, it } from "vitest";
import { addDaysIso, createWeeklyPpcReport, formatWeekRange, getMonthWeekStarts, parsePpcDashboardStore, reportKey, startOfWeekIso, withCalculatedPerformance } from "./ppc-dashboard-state";

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
    expect(parsed.reports["product-1:2026-08-26"].notes).toBe("Keep this");
    expect(parsePpcDashboardStore("not json")).toEqual({ version: 1, reports: {} });
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

  it("carries unfinished goals into the following week and resets their progress", () => {
    const previous = {
      ...createWeeklyPpcReport("product-1", "2026-08-26"),
      goals: [
        { id: "done", title: "Completed goal", target: "10", actual: "10", status: "Achieved" as const },
        { id: "risk", title: "Improve ACOS", target: "25%", actual: "32%", status: "At Risk" as const },
        { id: "missed", title: "Increase sales", target: "$500", actual: "$300", status: "Missed" as const },
      ],
    };
    const next = createWeeklyPpcReport("product-1", "2026-09-02", previous);

    expect(next.goals.map(goal => ({ title: goal.title, actual: goal.actual, status: goal.status }))).toEqual([
      { title: "Improve ACOS", actual: "", status: "On Track" },
      { title: "Increase sales", actual: "", status: "On Track" },
    ]);
  });
});
