import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CampaignWeeklyComparison } from "./campaign-weekly-comparison";

function comparisonPayload() {
  return {
    asin: "B012345678",
    country: "US",
    currency: "USD",
    dataState: "Partial",
    previousPeriod: { startDate: "2026-08-26", endDate: "2026-08-28" },
    currentPeriod: { startDate: "2026-09-02", endDate: "2026-09-04" },
    freshness: { previousDataAsOf: "2026-08-29", currentDataAsOf: "2026-09-05" },
    warnings: ["Matched partial comparison"],
    campaigns: Array.from({ length: 11 }, (_, index) => ({
      campaignId: String(1000 + index),
      sponsoredType: index % 2,
      campaignName: `Campaign ${index + 1}`,
      previousActive: true,
      currentActive: index !== 0,
      previous: { sales: 200, spend: 40 + index, orders: 20 },
      current: { sales: 199 - index, spend: 45 + index, orders: 19 - (index % 3) },
    })),
  };
}

describe("CampaignWeeklyComparison", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders six collapsed mover dropdowns, all metrics, top ten rows, and direct trend links", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ comparison: comparisonPayload() }) })));
    const { container } = render(<CampaignWeeklyComparison asin="B012345678" weekStart="2026-09-02" refreshVersion={0} />);

    const region = await screen.findByRole("region", { name: "Campaign Week-over-Week Comparison" });
    expect(within(region).getByText("Partial")).toBeVisible();
    expect(within(region).getByText("Aug 26, 2026 – Aug 28, 2026")).toBeVisible();
    expect(within(region).getByText("Sep 2, 2026 – Sep 4, 2026")).toBeVisible();
    expect(container.querySelectorAll("details")).toHaveLength(6);
    for (const details of container.querySelectorAll("details")) expect(details).not.toHaveAttribute("open");

    const salesDeclineSummary = within(region).getByText("Sales Decline").closest("summary");
    expect(salesDeclineSummary).not.toBeNull();
    fireEvent.click(salesDeclineSummary!);
    const table = screen.getByRole("table", { name: "Sales Decline campaign comparison" });
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(within(table).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Campaign", "Sales", "Spend", "Orders"]);
    expect(within(table).getByText("Campaign 11")).toBeVisible();
    expect(within(table).queryByText("Campaign 1")).not.toBeInTheDocument();
    const link = within(table).getByRole("link", { name: /Campaign 11/ });
    expect(link).toHaveAttribute("href", "https://portal.scaleinsights.com/PopupWindow/PPCTrendForCampaign?from=2026-09-02&to=2026-09-04&campaignId=1010&sponsoredType=0");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(table).getAllByLabelText(/^Sales from/)).toHaveLength(10);
    expect(within(table).getAllByLabelText(/^Spend from/)).toHaveLength(10);
    expect(within(table).getAllByLabelText(/^Orders from/)).toHaveLength(10);

    fireEvent.click(within(region).getByRole("button", { name: "Show all 11 Sales Decline campaigns" }));
    expect(within(table).getAllByRole("row")).toHaveLength(12);
    expect(within(table).getByText("Campaign 1")).toBeVisible();
  });

  it("reloads the in-memory result when the shared refresh version changes", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ comparison: comparisonPayload() }) }));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<CampaignWeeklyComparison asin="B012345678" weekStart="2026-09-02" refreshVersion={0} />);
    await screen.findByText("Sales Decline");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    view.rerender(<CampaignWeeklyComparison asin="B012345678" weekStart="2026-09-02" refreshVersion={1} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("offers safe authorization and retry states", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ authorizationRequired: true, authorizationUrl: "https://vercel.com/api/v1/connect/authorize/scl_test" }) })
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: "Campaign provider unavailable." }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ comparison: comparisonPayload() }) });
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<CampaignWeeklyComparison asin="B012345678" weekStart="2026-09-02" refreshVersion={0} />);
    expect(await screen.findByRole("link", { name: "Connect Scale Insights" })).toHaveAttribute("href", "https://vercel.com/api/v1/connect/authorize/scl_test");
    view.rerender(<CampaignWeeklyComparison asin="B012345678" weekStart="2026-09-02" refreshVersion={1} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Campaign provider unavailable.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Sales Decline")).toBeVisible();
  });
});
