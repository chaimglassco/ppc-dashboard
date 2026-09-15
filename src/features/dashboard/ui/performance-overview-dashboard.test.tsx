import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createWeeklyPpcReport, reportKey } from "../domain/ppc-dashboard-state";
import type { ManagedDashboardProduct } from "../domain/ppc-dashboard-catalog";
import { PerformanceOverviewDashboard } from "./performance-overview-dashboard";

describe("PerformanceOverviewDashboard", () => {
  it("uses saved weekly reports for timeframe totals and ASIN ranking", () => {
    const product: ManagedDashboardProduct = { id: "product-1", name: "Round U Lead Came", asin: "B012345678", sku: "LEAD-1", stageId: "active", status: "Active", source: "pipeline", tagId: "", imageDataUrl: "" };
    const current = { ...createWeeklyPpcReport(product.id, "2026-08-26"), spend: 100, ppcSales: 500, totalSales: 800, ppcOrders: 20, totalOrders: 32, updatedAt: "2026-09-01T12:00:00.000Z" };
    const previous = { ...createWeeklyPpcReport(product.id, "2026-08-19"), spend: 80, ppcSales: 400, totalSales: 700, ppcOrders: 18, totalOrders: 29, updatedAt: "2026-08-25T12:00:00.000Z" };
    render(<PerformanceOverviewDashboard products={[product]} reports={{ [reportKey(product.id, current.weekStart)]: current, [reportKey(product.id, previous.weekStart)]: previous }} currentWeekStart="2026-08-26" todayIso="2026-08-28" />);

    const sevenDays = screen.getByRole("heading", { name: "7 Days" }).closest("article")!;
    expect(within(sevenDays).getByText("$800")).toBeVisible();
    expect(within(sevenDays).getByText("$100")).toBeVisible();
    expect(within(sevenDays).getByText("20%" )).toBeVisible();
    expect(screen.getByText("Round U Lead Came")).toBeVisible();
    expect(screen.getByText("↗ 14.3%")).toBeVisible();
    expect(screen.getAllByText("No connected dataset yet")).toHaveLength(4);
  });
});
