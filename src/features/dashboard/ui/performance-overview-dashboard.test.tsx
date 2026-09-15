import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createWeeklyPpcReport, reportKey } from "../domain/ppc-dashboard-state";
import type { ManagedDashboardProduct } from "../domain/ppc-dashboard-catalog";
import { PerformanceOverviewDashboard } from "./performance-overview-dashboard";

afterEach(cleanup);

describe("PerformanceOverviewDashboard", () => {
  it("uses saved weekly reports for timeframe totals and ASIN ranking", () => {
    const product: ManagedDashboardProduct = { id: "product-1", name: "Round U Lead Came", asin: "B012345678", sku: "LEAD-1", stageId: "active", status: "Active", source: "pipeline", tagId: "", imageDataUrl: "" };
    const current = { ...createWeeklyPpcReport(product.id, "2026-08-26"), spend: 100, ppcSales: 500, totalSales: 800, ppcOrders: 20, totalOrders: 32, updatedAt: "2026-09-01T12:00:00.000Z" };
    const previous = { ...createWeeklyPpcReport(product.id, "2026-08-19"), spend: 80, ppcSales: 400, totalSales: 700, ppcOrders: 18, totalOrders: 29, updatedAt: "2026-08-25T12:00:00.000Z" };
    const { container } = render(<PerformanceOverviewDashboard products={[product]} reports={{ [reportKey(product.id, current.weekStart)]: current, [reportKey(product.id, previous.weekStart)]: previous }} currentWeekStart="2026-08-26" todayIso="2026-08-28" />);

    const disclosures = Array.from(container.querySelectorAll("details"));
    expect(disclosures).toHaveLength(7);
    disclosures.forEach(disclosure => expect(disclosure).not.toHaveAttribute("open"));
    fireEvent.click(screen.getByText(/Temporal Ledger Matrix/i).closest("summary")!);
    fireEvent.click(screen.getByText(/ASIN Velocity & Performance Ranking/i).closest("summary")!);
    for (const heading of DETAIL_SECTIONS_FOR_TEST) fireEvent.click(screen.getByText(heading).closest("summary")!);

    const sevenDays = screen.getByRole("heading", { name: "7 Days" }).closest("article")!;
    expect(within(sevenDays).getByText("$800")).toBeVisible();
    expect(within(sevenDays).getByText("$100")).toBeVisible();
    expect(within(sevenDays).getByText("20%" )).toBeVisible();
    expect(screen.getByText("Round U Lead Came")).toBeVisible();
    expect(screen.getByText("↗ 14.3%")).toBeVisible();
    expect(screen.getAllByText("No connected dataset yet")).toHaveLength(4);
  });

  it("filters cards and every disclosure to matching ASIN performance", () => {
    const first: ManagedDashboardProduct = { id: "product-1", name: "Round U Lead Came", asin: "B012345678", sku: "LEAD-1", stageId: "active", status: "Active", source: "pipeline", tagId: "", imageDataUrl: "" };
    const second: ManagedDashboardProduct = { id: "product-2", name: "Homasote Board", asin: "B087654321", sku: "BOARD-2", stageId: "active", status: "Active", source: "pipeline", tagId: "", imageDataUrl: "" };
    const firstReport = { ...createWeeklyPpcReport(first.id, "2026-08-26"), spend: 100, ppcSales: 500, totalSales: 800, totalOrders: 32, updatedAt: "2026-09-01T12:00:00.000Z" };
    const secondReport = { ...createWeeklyPpcReport(second.id, "2026-08-26"), spend: 40, ppcSales: 200, totalSales: 300, totalOrders: 10, updatedAt: "2026-09-01T13:00:00.000Z" };
    render(<PerformanceOverviewDashboard products={[first, second]} reports={{ [reportKey(first.id, firstReport.weekStart)]: firstReport, [reportKey(second.id, secondReport.weekStart)]: secondReport }} currentWeekStart="2026-08-26" todayIso="2026-08-28" />);

    fireEvent.click(screen.getByText(/Temporal Ledger Matrix/i).closest("summary")!);
    fireEvent.click(screen.getByText(/ASIN Velocity & Performance Ranking/i).closest("summary")!);
    fireEvent.change(screen.getByRole("searchbox", { name: "Filter dashboard by ASIN, SKU, or product name" }), { target: { value: "B012345678" } });

    const sevenDays = screen.getByRole("heading", { name: "7 Days" }).closest("article")!;
    expect(within(sevenDays).getByText("$800")).toBeVisible();
    expect(within(sevenDays).queryByText("$1,100")).not.toBeInTheDocument();
    expect(screen.getByText("Round U Lead Came")).toBeVisible();
    expect(screen.queryByText("Homasote Board")).not.toBeInTheDocument();
    expect(screen.getByText("Filtered to B012345678")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Clear ASIN performance filter" }));
    expect(within(sevenDays).getByText("$1,100")).toBeVisible();
    expect(screen.getByText("Homasote Board")).toBeVisible();
  });
});

const DETAIL_SECTIONS_FOR_TEST = [
  /Keyword Targeting Performance/i,
  /Campaign Level Movers & Efficiency/i,
  /Product & ASIN Targeting/i,
  /Search Terms Report/i,
];
