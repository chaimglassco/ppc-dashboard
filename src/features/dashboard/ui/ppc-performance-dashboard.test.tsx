import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PPC_DASHBOARD_CATALOG_STORAGE_KEY } from "../domain/ppc-dashboard-catalog";
import { PPC_DASHBOARD_STORAGE_KEY } from "../domain/ppc-dashboard-state";
import { PpcPerformanceDashboard } from "./ppc-performance-dashboard";

describe("PpcPerformanceDashboard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        products: [{ id: "product-1", name: "Glass Cleaner", asin: "B012345678", sku: "GC-01", stageId: "launch", status: "Active" }],
      }),
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("loads a Pipeline product and automatically saves the selected weekly report", async () => {
    render(<PpcPerformanceDashboard initialToday="2026-08-28" />);

    expect(await screen.findByRole("heading", { name: "Glass Cleaner" })).toBeVisible();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Open current week" })).not.toBeInTheDocument();
    const currentPeriod = screen.getByText("Current").closest("button") as HTMLButtonElement;
    expect(within(currentPeriod).getByText("August 26 to September 1")).toBeVisible();
    expect(within(currentPeriod).getByText("Order")).toBeVisible();
    expect(within(currentPeriod).getByText("ACOS")).toBeVisible();
    expect(within(currentPeriod).queryByText("ROAS")).not.toBeInTheDocument();
    expect(currentPeriod).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByLabelText("Reporting periods")).getAllByRole("button")[0]).toBe(currentPeriod);

    const monthTrigger = screen.getByRole("button", { name: "Choose reporting month, August 2026" });
    expect(monthTrigger.querySelector("svg")).not.toBeNull();
    expect(within(screen.getByRole("group", { name: "Month navigation" })).queryByRole("button", { name: /Choose reporting month/i })).not.toBeInTheDocument();
    fireEvent.click(monthTrigger);
    const monthDialog = screen.getByRole("dialog", { name: "Choose a month" });
    expect(within(monthDialog).getByRole("button", { name: "August 2026" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(monthDialog).getByRole("button", { name: "July 2026" }));
    expect(screen.getByRole("button", { name: "Choose reporting month, July 2026" })).toBeVisible();
    expect(within(screen.getByLabelText("Reporting periods")).getAllByRole("button")[0]).toHaveTextContent("Current");
    fireEvent.click(screen.getByRole("button", { name: "Choose reporting month, July 2026" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Choose a month" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: /Weekly limit/i }), { target: { value: "1500" } });
    expect(screen.getByText("$214.29")).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "Actual spend" }), { target: { value: "350" } });
    expect(screen.getByText("$1,150")).toBeVisible();
    expect(screen.getByText("23% of the weekly budget used")).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "Performance documentation" }), { target: { value: "Scale the best converting exact-match campaign." } });
    expect(screen.getByText("Saving changes…")).toBeVisible();
    await waitFor(() => expect(screen.getByText("Changes saved automatically")).toBeVisible(), { timeout: 3_000 });

    const stored = JSON.parse(window.localStorage.getItem(PPC_DASHBOARD_STORAGE_KEY) || "{}");
    expect(stored.version).toBe(1);
    expect(stored.reports["product-1:2026-08-26"]).toMatchObject({
      productId: "product-1",
      weekStart: "2026-08-26",
      weeklyBudget: 1500,
      dailyBudget: 214.29,
      spend: 350,
      notes: "Scale the best converting exact-match campaign.",
      status: "Draft",
    });
  }, 10_000);

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
      "Spend", "PPC Sales", "Organic Sales", "Total Sales", "PPC Orders", "Organic Orders", "Total Orders", "ACOS", "TACOS",
    ]);

    const carryForward = screen.getByRole("textbox", { name: "Carry-forward result and lessons" });
    const documentation = screen.getByRole("textbox", { name: "Performance documentation" }) as HTMLTextAreaElement;
    expect(carryForward.className).toBe(documentation.className);
    fireEvent.change(documentation, { target: { value: "First action\nSecond action" } });
    documentation.setSelectionRange(0, "First action\nSecond action".length);
    fireEvent.click(screen.getByRole("button", { name: "Bulleted list Performance documentation" }));
    expect(documentation).toHaveValue("• First action\n• Second action");

    const priority = screen.getByRole("combobox", { name: /negative exact keywords priority/i });
    expect(priority.className).toMatch(/priorityHigh/);
    fireEvent.change(priority, { target: { value: "Low" } });
    expect(priority.className).toMatch(/priorityLow/);
    expect(screen.queryByLabelText(/due date/i)).not.toBeInTheDocument();
  });

  it("lists the current week first and follows it with earlier weeks", async () => {
    render(<PpcPerformanceDashboard initialToday="2026-09-03" />);
    expect(await screen.findByRole("heading", { name: "Glass Cleaner" })).toBeVisible();

    const periods = within(screen.getByLabelText("Reporting periods")).getAllByRole("button");
    expect(periods[0]).toHaveTextContent("September 2 to September 8");
    expect(periods[1]).toHaveTextContent("August 26 to September 1");
    expect(periods[2]).toHaveTextContent("August 19 to August 25");
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
    const asinLink = screen.getByRole("link", { name: "Open ASIN B012345679 on Amazon" });
    const skuLink = screen.getByRole("link", { name: "Open SKU POLISH-01 in Seller Central" });
    const headerAsinLink = screen.getByRole("link", { name: "Open selected product ASIN B012345679 on Amazon" });
    const headerSkuLink = screen.getByRole("link", { name: "Open selected product SKU POLISH-01 in Seller Central" });
    expect(asinLink).toHaveAttribute("href", "https://www.amazon.com/dp/B012345679");
    expect(skuLink).toHaveAttribute("href", "https://sellercentral.amazon.com/myinventory/inventory?searchField=sku&searchTerm=POLISH-01");
    expect(headerAsinLink).toHaveAttribute("href", "https://www.amazon.com/dp/B012345679");
    expect(headerSkuLink).toHaveAttribute("href", "https://sellercentral.amazon.com/myinventory/inventory?searchField=sku&searchTerm=POLISH-01");
    expect(asinLink).toHaveAttribute("target", "_blank");
    expect(skuLink).toHaveAttribute("rel", "noopener noreferrer");
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
