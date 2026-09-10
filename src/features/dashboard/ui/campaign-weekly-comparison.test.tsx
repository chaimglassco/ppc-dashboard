import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CampaignWeeklyComparison } from "./campaign-weekly-comparison";

function baselinePayload() {
  return {
    asin: "B012345678",
    country: "US",
    currency: "USD",
    dataState: "Final",
    previousPeriod: { startDate: "2026-08-26", endDate: "2026-09-01" },
    currentPeriod: { startDate: "2026-09-02", endDate: "2026-09-08" },
    freshness: { previousDataAsOf: "2026-09-02" },
    warnings: [],
    campaigns: Array.from({ length: 11 }, (_, index) => ({
      campaignId: String(1000 + index),
      sponsoredType: index % 2,
      campaignName: `Campaign ${index + 1}`,
      previousSpend: 100 - index,
    })),
  };
}

describe("CampaignWeeklyComparison Spend baseline", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows previous-week campaign Spend and leaves every current-week value blank", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ comparison: baselinePayload() }) })));
    render(<CampaignWeeklyComparison asin="B012345678" weekStart="2026-09-02" refreshVersion={0} />);

    const region = screen.getByRole("region", { name: "Campaign Week-over-Week Comparison" });
    expect(within(region).getByText("Stage 1: previous-week campaign Spend. Current-week Spend will be connected next.")).toBeVisible();
    expect(await within(region).findByText("Aug 26, 2026 – Sep 1, 2026")).toBeVisible();
    expect(within(region).getByText("Sep 2, 2026 – Sep 8, 2026")).toBeVisible();
    const table = within(region).getByRole("table", { name: "Previous and current week campaign Spend" });
    expect(within(table).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Campaign", "Previous Week Spend", "Current Week Spend"]);
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(within(table).getByText("Campaign 1")).toBeVisible();
    expect(within(table).queryByText("Campaign 11")).not.toBeInTheDocument();
    expect(within(table).getAllByLabelText("Current week Spend pending")).toHaveLength(10);
    expect(within(table).getByText("$100.00")).toBeVisible();
    const link = within(table).getByRole("link", { name: "Campaign 1" });
    expect(link).toHaveAttribute("href", "https://portal.scaleinsights.com/PopupWindow/PPCTrendForCampaign?from=2026-08-26&to=2026-09-01&campaignId=1000&sponsoredType=0");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    fireEvent.click(within(region).getByRole("button", { name: "Show all 11 campaigns" }));
    expect(within(table).getAllByRole("row")).toHaveLength(12);
    expect(within(table).getByText("Campaign 11")).toBeVisible();
  });

  it("reloads the in-memory baseline when the shared refresh version changes", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ comparison: baselinePayload() }) }));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<CampaignWeeklyComparison asin="B012345678" weekStart="2026-09-02" refreshVersion={0} />);
    await screen.findByText("Spend baseline");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    view.rerender(<CampaignWeeklyComparison asin="B012345678" weekStart="2026-09-02" refreshVersion={1} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("offers safe authorization and unsupported-capability states", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ authorizationRequired: true, authorizationUrl: "https://vercel.com/api/v1/connect/authorize/scl_test" }) })
      .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({
        error: "Provider detail must stay hidden.",
        code: "campaign_capability_missing",
        requestId: "request-safe-123",
      }) });
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<CampaignWeeklyComparison asin="B012345678" weekStart="2026-09-02" refreshVersion={0} />);
    expect(await screen.findByRole("link", { name: "Connect Scale Insights" })).toHaveAttribute("href", "https://vercel.com/api/v1/connect/authorize/scl_test");
    view.rerender(<CampaignWeeklyComparison asin="B012345678" weekStart="2026-09-02" refreshVersion={1} />);
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Campaign-level data is unavailable from the connected Scale Insights tools");
    expect(status).toHaveTextContent("Scale Insights provides weekly ASIN totals through this connection, but its current reporting tools do not provide campaign-level rows.");
    expect(status).toHaveTextContent("Reference ID: request-safe-123");
    expect(status).not.toHaveTextContent("Provider detail must stay hidden.");
    expect(within(status).queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });
});
