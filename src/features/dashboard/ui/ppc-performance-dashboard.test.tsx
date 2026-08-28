import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  afterEach(() => vi.unstubAllGlobals());

  it("loads a Pipeline product and saves the selected weekly report explicitly", async () => {
    render(<PpcPerformanceDashboard initialToday="2026-08-28" />);

    expect(await screen.findByRole("heading", { name: "Glass Cleaner" })).toBeVisible();
    expect(fetch).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByRole("textbox", { name: /Weekly limit/i }), { target: { value: "1500" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Performance documentation" }), { target: { value: "Scale the best converting exact-match campaign." } });
    expect(screen.getByText("Unsaved changes")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    await waitFor(() => expect(screen.getByText("Draft saved")).toBeVisible());

    const stored = JSON.parse(window.localStorage.getItem(PPC_DASHBOARD_STORAGE_KEY) || "{}");
    expect(stored.version).toBe(1);
    expect(stored.reports["product-1:2026-08-24"]).toMatchObject({
      productId: "product-1",
      weeklyBudget: 1500,
      notes: "Scale the best converting exact-match campaign.",
      status: "Draft",
    });
  });
});
