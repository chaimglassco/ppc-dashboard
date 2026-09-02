import { describe, expect, it } from "vitest";
import { addDaysIso, createWeeklyPpcReport, formatWeekRange, getMonthWeekStarts, parsePpcDashboardStore, reportKey, startOfWeekIso } from "./ppc-dashboard-state";

describe("PPC dashboard state", () => {
  it("creates stable product/week report keys for Wednesday through Tuesday periods", () => {
    expect(startOfWeekIso("2026-08-26")).toBe("2026-08-26");
    expect(startOfWeekIso("2026-09-01")).toBe("2026-08-26");
    expect(startOfWeekIso("2026-09-02")).toBe("2026-09-02");
    expect(addDaysIso("2026-08-26", 6)).toBe("2026-09-01");
    expect(reportKey("product-1", "2026-08-26")).toBe("product-1:2026-08-26");
    expect(formatWeekRange("2026-08-26")).toBe("Aug 26 – Sep 1, 2026");
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
});
