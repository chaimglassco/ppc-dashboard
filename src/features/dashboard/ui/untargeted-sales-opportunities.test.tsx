import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UntargetedSalesOpportunities } from "./untargeted-sales-opportunities";

function payload() {
  return {
    asin: "B012345678", country: "US", currency: "USD", dataState: "Final",
    period: { startDate: "2026-09-02", endDate: "2026-09-08" },
    freshness: { searchDataAsOf: "2026-09-09", coverageDataAsOf: "2026-09-09" }, warnings: [],
    opportunities: Array.from({ length: 11 }, (_, index) => ({
      term: index === 1 ? "B0ABCDEF12" : `search term ${index + 1}`,
      type: index === 1 ? "Product ASIN" : "Search term", sales: index === 10 ? 0 : 110 - index * 10, orders: index === 10 ? 0 : index + 1, spend: 10, impressions: 1000 - index, clicks: 5, acos: index === 10 ? null : 10 + index,
    })),
  };
}

describe("UntargetedSalesOpportunities", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("loads on demand, shows confirmed matches, and filters without another request", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ opportunities: payload() }) }));
    vi.stubGlobal("fetch", fetchMock);
    render(<UntargetedSalesOpportunities asin="B012345678" weekStart="2026-09-02" refreshVersion={0} />);
    const region = screen.getByRole("region", { name: "Untargeted Sales Opportunities" });
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(within(region).getByRole("button", { name: "Load Opportunities" }));
    const table = await within(region).findByRole("table", { name: "Untargeted sales opportunities" });
    expect(within(table).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Search Term", "Impressions", "Clicks", "Spend", "Sales", "Orders", "ACOS", "Status"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(within(table).getAllByText("Not targeted")).toHaveLength(10);
    expect(within(region).getByLabelText("Minimum PPC Sales")).toHaveValue(null);
    expect(within(region).getByLabelText("Minimum PPC Orders")).toHaveValue(null);
    fireEvent.click(within(region).getByRole("button", { name: "Show all 11" }));
    expect(within(table).getByText("search term 11")).toBeVisible();
    expect(within(table).getByText("990")).toBeVisible();
    fireEvent.change(within(region).getByLabelText("Opportunity type"), { target: { value: "Product ASIN" } });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByRole("link", { name: "B0ABCDEF12" })).toHaveAttribute("href", "https://www.amazon.com/dp/B0ABCDEF12");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(within(region).getByRole("button", { name: "Fetch Again" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("reloads with shared Refresh Data only after the report was requested", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ opportunities: payload() }) }));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<UntargetedSalesOpportunities asin="B012345678" weekStart="2026-09-02" refreshVersion={0} />);
    view.rerender(<UntargetedSalesOpportunities asin="B012345678" weekStart="2026-09-02" refreshVersion={1} />);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Load Opportunities" }));
    await screen.findByRole("table", { name: "Untargeted sales opportunities" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    view.rerender(<UntargetedSalesOpportunities asin="B012345678" weekStart="2026-09-02" refreshVersion={2} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
