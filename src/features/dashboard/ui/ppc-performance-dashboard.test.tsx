import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PPC_DASHBOARD_CATALOG_STORAGE_KEY } from "../domain/ppc-dashboard-catalog";
import { PPC_DASHBOARD_STORAGE_KEY } from "../domain/ppc-dashboard-state";
import { PPC_PERFORMANCE_CACHE_KEY } from "../domain/ppc-performance-cache";
import { PpcPerformanceDashboard } from "./ppc-performance-dashboard";

describe("PpcPerformanceDashboard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async input => String(input).includes("/api/dashboard/performance?")
      ? { ok: false, status: 503, json: async () => ({ error: "Scale Insights is not configured on this server." }) }
      : {
        ok: true,
        status: 200,
        json: async () => ({
          products: [{ id: "product-1", name: "Glass Cleaner", asin: "B012345678", sku: "GC-01", stageId: "launch", status: "Active" }],
        }),
      }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("automatically backfills visible weeks, restores them after reload, and updates only the active week on Refresh", async () => {
    let spend = 81.75;
    let fail = false;
    const metricsCalls: string[] = [];
    vi.mocked(fetch).mockImplementation(async input => {
      const url = String(input);
      if (!url.includes("/api/dashboard/performance?")) return { ok: true, status: 200, json: async () => ({ products: [{ id: "product-1", name: "Glass Cleaner", asin: "B012345678", sku: "GC-01", stageId: "launch", status: "Active" }] }) } as Response;
      metricsCalls.push(url);
      const startDate = new URL(url, "http://localhost").searchParams.get("weekStart")!;
      const end = new Date(`${startDate}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 6);
      const endDate = end.toISOString().slice(0, 10);
      if (fail) return { ok: false, status: 502, json: async () => ({ error: "Unavailable" }) } as Response;
      return { ok: true, status: 200, json: async () => ({ performance: {
        asin: "B012345678", country: "US", startDate, endDate, currency: "USD",
        metrics: { spend, ppcSales: 481.75, ppcOrders: 23, totalSales: 1317.35, totalOrders: 59 },
        freshness: { adsDataAsOf: "ads", salesDataAsOf: "sales", salesDataThrough: startDate }, warnings: [],
      } }) } as Response;
    });
    const view = render(<PpcPerformanceDashboard initialToday="2026-08-28" />);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Spend" })).toHaveValue("82"), { timeout: 5000 });
    await waitFor(() => expect(metricsCalls).toHaveLength(5));
    expect(metricsCalls.map(url => new URL(url, "http://localhost").searchParams.get("weekStart")).sort()).toEqual([
      "2026-07-29", "2026-08-05", "2026-08-12", "2026-08-19", "2026-08-26",
    ]);
    expect(JSON.parse(localStorage.getItem(PPC_PERFORMANCE_CACHE_KEY)!).entries["US:B012345678:2026-08-26"].metrics.spend).toBe(81.75);
    expect(within(screen.getByRole("button", { name: /August 19 to August 25/ })).getByText("$82")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /August 19 to August 25/ }));
    await screen.findByText(/Saved Scale Insights data/);
    expect(metricsCalls).toHaveLength(5);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Spend" })).toHaveValue("82"));
    fireEvent.click(screen.getByRole("button", { name: /August 26 to September 1/ }));
    await screen.findByText(/Saved Scale Insights data/);
    expect(metricsCalls).toHaveLength(5);
    view.unmount();
    render(<PpcPerformanceDashboard initialToday="2026-08-28" />);
    await screen.findByText(/Saved Scale Insights data/);
    expect(metricsCalls).toHaveLength(5);
    expect(within(screen.getByRole("button", { name: /August 19 to August 25/ })).getByText("$82")).toBeVisible();
    spend = 99;
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Spend" })).toHaveValue("99"));
    expect(metricsCalls).toHaveLength(6);
    fail = true;
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await screen.findByText("Refresh failed. Previously saved metrics are still displayed.");
    expect(screen.getByRole("textbox", { name: "Spend" })).toHaveValue("99");
    expect(screen.getByRole("textbox", { name: "Spend" })).toHaveAttribute("readonly");
  }, 15_000);

  it("loads a Pipeline product and automatically saves the selected weekly report", async () => {
    render(<PpcPerformanceDashboard initialToday="2026-08-28" />);

    expect(await screen.findByRole("heading", { name: "Glass Cleaner" })).toBeVisible();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/dashboard/products"), expect.any(Object));
    expect(screen.getByRole("button", { name: "Weekly Report" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Open current week" })).not.toBeInTheDocument();
    const currentPeriod = screen.getByText("August 26 to September 1").closest("button") as HTMLButtonElement;
    expect(within(currentPeriod).getByText("August 26 to September 1")).toBeVisible();
    expect(within(currentPeriod).getByText("Week 35").parentElement?.className).toMatch(/periodMeta/);
    expect(within(currentPeriod).getByText("Order")).toBeVisible();
    expect(within(currentPeriod).getByText("ACOS")).toBeVisible();
    expect(within(currentPeriod).queryByText("ROAS")).not.toBeInTheDocument();
    expect(currentPeriod).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByLabelText("Reporting periods")).getAllByRole("button")[0]).toBe(currentPeriod);

    expect(screen.queryByText("Draft", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save Draft" })).not.toBeInTheDocument();
    const monthTrigger = screen.getByRole("button", { name: "Choose reporting months, July–September 2026" });
    expect(monthTrigger.querySelector("svg")).not.toBeNull();
    expect(within(screen.getByRole("group", { name: "Month navigation" })).queryByRole("button", { name: /Choose reporting months/i })).not.toBeInTheDocument();
    fireEvent.click(monthTrigger);
    const monthDialog = screen.getByRole("dialog", { name: "Choose months" });
    expect(within(monthDialog).getByRole("button", { name: "August 2026" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(monthDialog).getByRole("button", { name: "July 2026" }));
    expect(within(monthDialog).getByRole("button", { name: "July 2026" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("dialog", { name: "Choose months" })).toBeVisible();
    fireEvent.click(within(monthDialog).getByRole("button", { name: "Apply months" }));
    expect(screen.getByRole("button", { name: "Choose reporting months, July–September 2026" })).toBeVisible();
    expect(within(screen.getByLabelText("Reporting periods")).getAllByRole("button")[0]).toHaveTextContent("Current");
    fireEvent.click(screen.getByRole("button", { name: /Choose reporting months/i }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Choose months" })).not.toBeInTheDocument();

    const weeklyLimit = screen.getByRole("textbox", { name: "Weekly limit" });
    fireEvent.focus(weeklyLimit);
    fireEvent.change(weeklyLimit, { target: { value: "1500" } });
    fireEvent.blur(weeklyLimit);
    expect(screen.getByText("$214.29")).toBeVisible();
    const budgetHistory = screen.getByRole("table", { name: "Budget change history" });
    expect(within(budgetHistory).getByRole("columnheader", { name: "Date of Change" })).toBeVisible();
    expect(within(budgetHistory).getByRole("columnheader", { name: "From" })).toBeVisible();
    expect(within(budgetHistory).getByRole("columnheader", { name: "To" })).toBeVisible();
    expect(within(budgetHistory).getByText("$0")).toBeVisible();
    expect(within(budgetHistory).getByText("$1,500")).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "Actual spend" }), { target: { value: "350" } });
    expect(screen.getByText("$1,150")).toBeVisible();
    expect(screen.getByText("23% of the weekly budget used")).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "Performance documentation" }), { target: { value: "Scale the best converting exact-match campaign." } });
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeVisible();
    expect(screen.getByText("Saving changes…")).toBeVisible();
    await waitFor(() => expect(screen.getByText("Changes saved automatically")).toBeVisible(), { timeout: 3_000 });
    expect(screen.getByRole("button", { name: "Weekly Report" })).toBeVisible();

    const stored = JSON.parse(window.localStorage.getItem(PPC_DASHBOARD_STORAGE_KEY) || "{}");
    expect(stored.version).toBe(1);
    expect(stored.reports["product-1:2026-08-26"]).toMatchObject({
      productId: "product-1",
      weekStart: "2026-08-26",
      weeklyBudget: 1500,
      dailyBudget: 214.29,
      budgetHistory: [expect.objectContaining({ from: 0, to: 1500 })],
      spend: 350,
      notes: "Scale the best converting exact-match campaign.",
      status: "Draft",
    });
  }, 10_000);

  it("retrieves the selected week from Scale Insights and locks the imported metrics", async () => {
    vi.mocked(fetch).mockImplementation(async input => {
      const url = String(input);
      if (url.includes("/api/dashboard/performance?")) {
        const startDate = new URL(url, "http://localhost").searchParams.get("weekStart")!;
        const activeWeek = startDate === "2026-08-26";
        const end = new Date(`${startDate}T00:00:00Z`);
        end.setUTCDate(end.getUTCDate() + 6);
        return {
        ok: true,
        status: 200,
        json: async () => ({ performance: {
          asin: "B012345678", country: "US", startDate, endDate: end.toISOString().slice(0, 10), currency: "USD",
          metrics: activeWeek
            ? { spend: 81.75, ppcSales: 481.75, ppcOrders: 23, totalSales: 1317.35, totalOrders: 59, organicSales: 835.6, organicOrders: 36, acos: 16.97, tacos: 6.21 }
            : { spend: 90, ppcSales: 450, ppcOrders: 20, totalSales: 1200, totalOrders: 55, organicSales: 750, organicOrders: 35, acos: 20, tacos: 7.5 },
          freshness: { adsDataAsOf: "ads", salesDataAsOf: "sales", salesDataThrough: end.toISOString().slice(0, 10) }, warnings: [],
        } }),
      } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ products: [{ id: "product-1", name: "Glass Cleaner", asin: "B012345678", sku: "GC-01", stageId: "launch", status: "Active" }] }),
      } as Response;
    });

    render(<PpcPerformanceDashboard initialToday="2026-08-28" />);

    expect(await screen.findByText("Scale Insights synced through 2026-09-01.")).toBeVisible();
    const performanceCard = screen.getByRole("region", { name: "Weekly Performance" });
    expect(within(performanceCard).getByRole("textbox", { name: "Spend" })).toHaveValue("82");
    expect(within(performanceCard).getByRole("textbox", { name: "PPC Sales" })).toHaveValue("482");
    expect(within(performanceCard).getByRole("textbox", { name: "Organic Sales" })).toHaveValue("836");
    expect(within(performanceCard).getByRole("textbox", { name: "Total Sales" })).toHaveValue("1,317");
    expect(within(performanceCard).getByRole("textbox", { name: "ACOS" })).toHaveValue("17");
    expect(within(performanceCard).getByRole("textbox", { name: "TACOS" })).toHaveValue("6");
    expect(within(screen.getByRole("button", { name: /August 26 to September 1/ })).getByText("17%")).toBeVisible();
    expect(within(performanceCard).getByRole("textbox", { name: "PPC Sales" })).toHaveAttribute("readonly");
    expect(screen.getByRole("textbox", { name: "Actual spend" })).toHaveValue("82");
    expect(screen.getByRole("textbox", { name: "Actual spend" })).toHaveAttribute("readonly");
    const previousSales = await within(performanceCard).findByLabelText("Previous Total Sales: $1,200, increased");
    expect(previousSales).toHaveTextContent("$1,200");
    expect(previousSales.className).toMatch(/metricPrevious/);
    expect(previousSales.className).not.toMatch(/metricIncrease|metricDecrease/);
    expect(within(performanceCard).getByRole("textbox", { name: "Total Sales" }).closest("span")?.parentElement?.className).toMatch(/metricIncrease/);
    const previousSpend = within(performanceCard).getByLabelText("Previous Spend: $90, decreased");
    expect(previousSpend.className).not.toMatch(/metricIncrease|metricDecrease/);
    expect(within(performanceCard).getByRole("textbox", { name: "Spend" }).closest("span")?.parentElement?.className).toMatch(/metricDecrease/);
    expect(screen.queryByText(/total sales ·/i)).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("asin=B012345678&country=US&weekStart=2026-08-26"), expect.any(Object));
  });

  it("offers hosted Scale Insights consent without storing credentials in the browser", async () => {
    vi.mocked(fetch).mockImplementation(async input => String(input).includes("/api/dashboard/performance?")
      ? ({
        ok: false,
        status: 409,
        json: async () => ({
          error: "Authorize Scale Insights to retrieve weekly performance.",
          authorizationRequired: true,
          authorizationUrl: "https://vercel.com/api/v1/connect/authorize/scl_test",
        }),
      } as Response)
      : ({
        ok: true,
        status: 200,
        json: async () => ({ products: [{ id: "product-1", name: "Glass Cleaner", asin: "B012345678", sku: "GC-01", stageId: "launch", status: "Active" }] }),
      } as Response));

    render(<PpcPerformanceDashboard initialToday="2026-08-28" />);

    const connect = await screen.findByRole("link", { name: "Connect Scale Insights" });
    expect(connect).toHaveAttribute("href", "https://vercel.com/api/v1/connect/authorize/scl_test");
    expect(screen.getByText("Connect Scale Insights once to retrieve weekly performance.")).toBeVisible();
    expect(window.localStorage.getItem("SCALE_INSIGHTS_MCP_ACCESS_TOKEN")).toBeNull();
  });

  it("shows overspend, grouped metrics, formatted notes, and color-coded priorities without dates", async () => {
    render(<PpcPerformanceDashboard initialToday="2026-08-28" />);
    expect(await screen.findByRole("heading", { name: "Glass Cleaner" })).toBeVisible();

    fireEvent.change(screen.getByRole("textbox", { name: /Weekly limit/i }), { target: { value: "50" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Actual spend" }), { target: { value: "75" } });
    const budgetCard = screen.getByRole("region", { name: "Budget Tracking" });
    expect(within(budgetCard).getByText("Overspent")).toBeVisible();
    expect(within(budgetCard).getByText("$25")).toBeVisible();

    const performanceCard = screen.getByRole("region", { name: "Weekly Performance" });
    expect(within(performanceCard).getAllByRole("textbox").map(input => input.getAttribute("aria-label"))).toEqual([
      "Target ACOS", "Spend", "PPC Sales", "Organic Sales", "Total Sales", "PPC Orders", "Organic Orders", "Total Orders", "ACOS", "TACOS",
    ]);
    fireEvent.change(within(performanceCard).getByRole("textbox", { name: "PPC Sales" }), { target: { value: "100" } });
    fireEvent.change(within(performanceCard).getByRole("textbox", { name: "Total Sales" }), { target: { value: "300" } });
    fireEvent.change(within(performanceCard).getByRole("textbox", { name: "PPC Orders" }), { target: { value: "3" } });
    fireEvent.change(within(performanceCard).getByRole("textbox", { name: "Total Orders" }), { target: { value: "8" } });
    expect(within(performanceCard).getByRole("textbox", { name: "Organic Sales" })).toHaveValue("200");
    expect(within(performanceCard).getByRole("textbox", { name: "Organic Orders" })).toHaveValue("5");
    expect(within(performanceCard).getByRole("textbox", { name: "ACOS" })).toHaveValue("75");
    expect(within(performanceCard).getByRole("textbox", { name: "TACOS" })).toHaveValue("25");
    expect(within(performanceCard).getByRole("textbox", { name: "Organic Sales" })).toHaveAttribute("readonly");
    const targetAcos = within(performanceCard).getByRole("textbox", { name: "Target ACOS" });
    const acosCard = within(performanceCard).getByRole("textbox", { name: "ACOS" }).closest("label");
    fireEvent.change(targetAcos, { target: { value: "25" } });
    expect(acosCard).toHaveAttribute("data-warning", "true");
    expect(within(performanceCard).getByRole("textbox", { name: "ACOS" })).toHaveAccessibleDescription("Actual ACOS is above Target ACOS.");
    fireEvent.change(targetAcos, { target: { value: "80" } });
    expect(acosCard).not.toHaveAttribute("data-warning");

    const goalStatus = screen.getByRole("combobox", { name: "Reduce ACOS status" });
    expect(goalStatus.className).toMatch(/success/);
    fireEvent.change(goalStatus, { target: { value: "At Risk" } });
    expect(goalStatus.className).toMatch(/warning/);
    expect(within(goalStatus).queryByRole("option", { name: "Missed" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark Reduce ACOS achieved" }));
    expect(screen.queryByRole("combobox", { name: "Reduce ACOS status" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark Increase ROAS missed" }));
    fireEvent.click(screen.getByRole("button", { name: "Goal History" }));
    const goalHistory = screen.getByRole("dialog", { name: "Goal History" });
    expect(within(goalHistory).getByText("Reduce ACOS")).toBeVisible();
    expect(within(goalHistory).getByText("Increase ROAS")).toBeVisible();
    expect(within(goalHistory).getByText("Achieved")).toBeVisible();
    expect(within(goalHistory).getByText("Missed")).toBeVisible();
    fireEvent.click(within(goalHistory).getByRole("button", { name: "Close goal history" }));
    expect(screen.queryByRole("dialog", { name: "Goal History" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Previous week:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/No saved report exists/i)).not.toBeInTheDocument();

    const carryForward = screen.getByRole("textbox", { name: "Carry-forward result and lessons" }) as HTMLTextAreaElement;
    const documentation = screen.getByRole("textbox", { name: "Performance documentation" }) as HTMLTextAreaElement;
    expect(carryForward.className).toBe(documentation.className);
    fireEvent.click(screen.getByRole("button", { name: "Bulleted list Performance documentation" }));
    expect(documentation).toHaveValue("• ");
    fireEvent.change(documentation, { target: { value: "First action\nSecond action" } });
    documentation.setSelectionRange(0, "First action\nSecond action".length);
    fireEvent.click(screen.getByRole("button", { name: "Bulleted list Performance documentation" }));
    expect(documentation).toHaveValue("• First action\n• Second action");
    documentation.setSelectionRange(documentation.value.length, documentation.value.length);
    fireEvent.keyDown(documentation, { key: "Enter", shiftKey: true });
    expect(documentation).toHaveValue("• First action\n• Second action\n• ");

    fireEvent.click(screen.getByRole("button", { name: "Numbered list Carry-forward result and lessons" }));
    expect(carryForward).toHaveValue("1. ");
    fireEvent.change(carryForward, { target: { value: "1. First action" } });
    carryForward.setSelectionRange(carryForward.value.length, carryForward.value.length);
    fireEvent.keyDown(carryForward, { key: "Enter", shiftKey: true });
    expect(carryForward).toHaveValue("1. First action\n2. ");

    const priority = screen.getByRole("combobox", { name: /negative exact keywords priority/i });
    expect(priority.className).toMatch(/priorityHigh/);
    fireEvent.change(priority, { target: { value: "Low" } });
    expect(priority.className).toMatch(/priorityLow/);
    expect(screen.queryByLabelText(/due date/i)).not.toBeInTheDocument();
  }, 15_000);

  it("shows only selected-month weeks, including their boundary overlap", async () => {
    render(<PpcPerformanceDashboard initialToday="2026-09-03" />);
    expect(await screen.findByRole("heading", { name: "Glass Cleaner" })).toBeVisible();

    const periods = within(screen.getByLabelText("Reporting periods")).getAllByRole("button");
    expect(periods[0]).toHaveTextContent("September 2 to September 8");
    expect(periods[1]).toHaveTextContent("August 26 to September 1");
    expect(periods).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Choose reporting months, August & September 2026" })).toBeVisible();
    expect(screen.queryByText("August 19 to August 25")).not.toBeInTheDocument();
    expect(screen.queryByText("September 30 to October 6")).not.toBeInTheDocument();
  });

  it("confirms before hiding a Pipeline product from the weekly portfolio", async () => {
    render(<PpcPerformanceDashboard initialToday="2026-08-28" />);
    expect(await screen.findByRole("heading", { name: "Glass Cleaner" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Enable product editing" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Glass Cleaner" }));
    const warning = screen.getByRole("alertdialog", { name: "Remove Glass Cleaner?" });
    expect(within(warning).getByText(/remains unchanged in Product Pipeline/i)).toBeVisible();
    fireEvent.click(within(warning).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Delete Glass Cleaner" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Delete Glass Cleaner" }));
    fireEvent.click(within(screen.getByRole("alertdialog", { name: "Remove Glass Cleaner?" })).getByRole("button", { name: "Delete product" }));
    expect(screen.queryByRole("button", { name: "Delete Glass Cleaner" })).not.toBeInTheDocument();
    const stored = JSON.parse(window.localStorage.getItem(PPC_DASHBOARD_CATALOG_STORAGE_KEY) || "{}");
    expect(stored.hiddenPipelineProductIds).toEqual(["product-1"]);
  });

  it("creates a tag and dashboard product, exposes identifier links, edits it, and deletes it", async () => {
    render(<PpcPerformanceDashboard initialToday="2026-08-28" />);
    expect(await screen.findByRole("heading", { name: "Glass Cleaner" })).toBeVisible();
    expect(screen.queryByText("Active", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Glass Cleaner" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add tag" }));
    const tagDialog = screen.getByRole("dialog", { name: "Add tag" });
    fireEvent.change(within(tagDialog).getByRole("textbox", { name: "Tag name" }), { target: { value: "Launch group" } });
    fireEvent.click(within(tagDialog).getByRole("button", { name: "Add tag" }));
    expect(screen.getByRole("combobox", { name: "Filter products by tag" })).toHaveDisplayValue("Launch group");

    fireEvent.click(screen.getByRole("button", { name: "Add product" }));
    const productDialog = screen.getByRole("dialog", { name: "Add product" });
    fireEvent.change(within(productDialog).getByRole("textbox", { name: "Product name" }), { target: { value: "Glass Polish" } });
    fireEvent.change(within(productDialog).getByRole("textbox", { name: "ASIN" }), { target: { value: "b012345679" } });
    fireEvent.change(within(productDialog).getByRole("textbox", { name: "SKU" }), { target: { value: "POLISH-01" } });
    fireEvent.change(within(productDialog).getByLabelText(/Product image/i), { target: { files: [new File(["image"], "polish.png", { type: "image/png" })] } });
    expect(await within(productDialog).findByAltText("Product preview")).toBeVisible();
    expect(within(productDialog).getByRole("combobox", { name: "Tag" })).toHaveDisplayValue("Launch group");
    fireEvent.click(within(productDialog).getByRole("button", { name: "Add product" }));

    expect(await screen.findByRole("heading", { name: "Glass Polish" })).toBeVisible();
    expect(screen.getAllByAltText("Glass Polish product")).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Open ASIN B012345679 on Amazon" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open SKU POLISH-01 in Seller Central" })).not.toBeInTheDocument();
    const headerAsinLink = screen.getByRole("link", { name: "Open selected product ASIN B012345679 on Amazon" });
    const headerSkuLink = screen.getByRole("link", { name: "Open selected product SKU POLISH-01 in Seller Central" });
    expect(headerAsinLink).toHaveAttribute("href", "https://www.amazon.com/dp/B012345679");
    expect(headerSkuLink).toHaveAttribute("href", "https://sellercentral.amazon.com/myinventory/inventory?searchField=sku&searchTerm=POLISH-01");
    expect(headerAsinLink).toHaveAttribute("target", "_blank");
    expect(headerSkuLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(headerAsinLink.closest("p")).not.toHaveTextContent("August 26 to September 1");
    expect(headerAsinLink.closest("p")).not.toHaveTextContent("Week 35");
    const asinNavigation = screen.getByRole("navigation", { name: "Scale Insights analysis for ASIN B012345679" });
    expect(within(asinNavigation).getAllByRole("link")).toHaveLength(11);
    expect(within(asinNavigation).getByRole("link", { name: "Campaigns" })).toHaveAttribute("href", "https://portal.scaleinsights.com/Ads/Performance/Campaigns/Index?from=2026-08-26&to=2026-09-01&asinList=B012345679");
    expect(within(asinNavigation).getByRole("link", { name: "Keyword Targeting" })).toHaveAttribute("href", "https://portal.scaleinsights.com/Ads/Performance/Keywords/Index?from=2026-08-26&to=2026-09-01&asinList=B012345679");
    expect(within(asinNavigation).getByRole("link", { name: "Product Targeting" })).toHaveAttribute("href", "https://portal.scaleinsights.com/Ads/Performance/ProductAds/Index?from=2026-08-26&to=2026-09-01&asinList=B012345679");
    expect(within(asinNavigation).getByRole("link", { name: "Search Terms" })).toHaveAttribute("href", "https://portal.scaleinsights.com/Ads/SearchTerms/Index?from=2026-08-26&to=2026-09-01&asinList=B012345679");
    expect(within(asinNavigation).getByRole("link", { name: "Match Types" })).toHaveAttribute("href", "https://portal.scaleinsights.com/Ads/Performance/MatchTypes/Index?from=2026-08-26&to=2026-09-01&asinList=B012345679");
    expect(within(asinNavigation).getByRole("link", { name: "Placements" })).toHaveAttribute("href", "https://portal.scaleinsights.com/Ads/Performance/Placements/Index?from=2026-08-26&to=2026-09-01&asinList=B012345679");
    expect(within(asinNavigation).getByRole("link", { name: "Ad Types" })).toHaveAttribute("href", "https://portal.scaleinsights.com/Ads/Performance/AdTypes/Index?from=2026-08-26&to=2026-09-01&asinList=B012345679");
    expect(within(asinNavigation).getByRole("link", { name: "Main Keywords" })).toHaveAttribute("href", "https://portal.scaleinsights.com/Ads/MainKeywords/Index?from=2026-08-26&to=2026-09-01&asinList=B012345679");
    expect(within(asinNavigation).getByRole("link", { name: "Daily Performance" })).toHaveAttribute("href", "https://portal.scaleinsights.com/Ads/AdvertisingTrend?cycles=7&daysPerCycle=1&to=2026-09-01&asinList=B012345679");
    expect(within(asinNavigation).getByRole("link", { name: "Weekly Performance" })).toHaveAttribute("href", "https://portal.scaleinsights.com/Ads/AdvertisingTrend?cycles=7&daysPerCycle=7&to=2026-09-01&asinList=B012345679");
    expect(within(asinNavigation).getByRole("link", { name: "Monthly Performance" })).toHaveAttribute("href", "https://portal.scaleinsights.com/Ads/AdvertisingTrend?cycles=7&daysPerCycle=30&to=2026-09-01&asinList=B012345679");
    const trendNavigation = within(asinNavigation).getByRole("group", { name: "Trend reports" });
    expect(within(trendNavigation).getAllByRole("link").map(link => link.textContent)).toEqual(["Daily Performance", "Weekly Performance", "Monthly Performance"]);
    for (const link of within(asinNavigation).getAllByRole("link")) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(screen.getAllByText("Launch group").length).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole("button", { name: "Enable product editing" }));
    expect(screen.getByRole("button", { name: "Exit product editing" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Edit Glass Polish" }));
    const editDialog = screen.getByRole("dialog", { name: "Edit product" });
    fireEvent.change(within(editDialog).getByRole("textbox", { name: "Product name" }), { target: { value: "Glass Polish Pro" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("heading", { name: "Glass Polish Pro" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Delete Glass Polish Pro" }));
    const deleteDialog = screen.getByRole("alertdialog", { name: "Remove Glass Polish Pro?" });
    fireEvent.click(within(deleteDialog).getByRole("button", { name: "Delete product" }));
    expect(screen.queryByRole("button", { name: "Edit Glass Polish Pro" })).not.toBeInTheDocument();

    const stored = JSON.parse(window.localStorage.getItem(PPC_DASHBOARD_CATALOG_STORAGE_KEY) || "{}");
    expect(stored.tags).toEqual([expect.objectContaining({ name: "Launch group" })]);
    expect(stored.customProducts).toEqual([]);
  });
});
