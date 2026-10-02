import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addDaysIso } from "../domain/ppc-dashboard-state";
import { UntargetedSalesOpportunities } from "./untargeted-sales-opportunities";

function payload() {
  return {
    asin: "B012345678", country: "US", currency: "USD", dataState: "Final",
    ppcClicks: 55,
    period: { startDate: "2026-09-02", endDate: "2026-09-08" },
    freshness: { searchDataAsOf: "2026-09-09", coverageDataAsOf: "2026-09-09" }, warnings: [],
    opportunities: Array.from({ length: 11 }, (_, index) => ({
      term: index === 1 ? "B0ABCDEF12" : `search term ${index + 1}`,
      type: index === 1 ? "Product ASIN" : "Search term", sourceCampaignId: `campaign-${index + 1}`, sourceAdGroupId: `ad-group-${index + 1}`, sourceKeyword: `keyword ${index + 1}`, sourceMatchType: "broad", sales: 110 - index * 10, orders: index + 1, spend: 10, impressions: 1000 - index, clicks: 5, acos: 10 + index,
    })),
  };
}

async function historyResponse(input: RequestInfo | URL) {
  const query = new URL(String(input), "http://localhost").searchParams;
  const date = query.get("weekStart")!;
  const range = query.get("weeks") === "12";
  const data = payload();
  const opportunities = range || date === data.period.startDate ? data.opportunities : [];
  return { ok: true, status: 200, json: async () => ({ opportunities: {
    ...data, opportunities, complete: true, performanceRows: opportunities,
    period: { startDate: range ? addDaysIso(date, -77) : date, endDate: addDaysIso(date, 6) },
    ...(range ? { targetingCoverage: opportunities.map(row => ({ term: row.term, type: row.type, state: "untargeted" })), freshness: { searchDataAsOf: "2026-09-09", coverageDataAsOf: "2026-10-01T00:00:00Z" } } : {}),
  } }) };
}

describe("UntargetedSalesOpportunities", () => {
  it("stops the history queue on quota errors, preserves saved totals and disables stale targeting", async () => {
    let limited = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => limited
      ? { ok: false, status: 429, json: async () => ({ code: "opportunity_rate_limited", error: "Scale Insights has reached its session request limit. Try again after 5:54 PM Manila time." }) }
      : historyResponse(input));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<UntargetedSalesOpportunities asin="B012345678" weekStart="2026-09-02" refreshVersion={0} />);
    await screen.findByRole("table", { name: "Untargeted sales opportunities" });
    const saved = window.localStorage.getItem("glassco.ppcOpportunityHistoryCache.v1");
    expect(fetchMock).toHaveBeenCalledTimes(13);
    limited = true;
    view.rerender(<UntargetedSalesOpportunities asin="B012345678" weekStart="2026-09-02" refreshVersion={1} />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("5:54 PM Manila time"));
    expect(fetchMock).toHaveBeenCalledTimes(15);
    expect(screen.getByLabelText("Total Sales")).toHaveTextContent("$660.00");
    expect(screen.getByRole("checkbox", { name: "Select search term search term 1" })).toBeDisabled();
    expect(window.localStorage.getItem("glassco.ppcOpportunityHistoryCache.v1")).toBe(saved);
  });
  afterEach(() => { cleanup(); window.localStorage.clear(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("loads with shared Refresh Data, shows converting matches, and filters without another request", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", { configurable: true, value: { writeText } });
    const fetchMock = vi.fn(historyResponse);
    const onPpcClicksLoaded = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<UntargetedSalesOpportunities asin="B012345678" weekStart="2026-09-02" refreshVersion={0} onPpcClicksLoaded={onPpcClicksLoaded} />);
    const region = screen.getByRole("region", { name: "Untargeted Sales Opportunities" });
    expect(fetchMock).toHaveBeenCalled();
    expect(within(region).queryByRole("button", { name: "Load Opportunities" })).not.toBeInTheDocument();
    expect(within(region).getByLabelText("Reporting week")).toHaveValue("all");
    const table = await within(region).findByRole("table", { name: "Untargeted sales opportunities" });
    await waitFor(() => expect(onPpcClicksLoaded).toHaveBeenCalledWith({ asin: "B012345678", country: "US", weekStart: "2026-09-02", ppcClicks: 55 }));
    expect(within(table).getAllByRole("columnheader").map(header => header.querySelector("button")?.textContent ?? header.textContent)).toEqual(["", "Search Term", "Impressions", "Clicks", "Spend", "Sales", "Orders", "ACOS", "Last seen", "Weeks appeared", "Status"]);
    expect(within(table).getByRole("columnheader", { name: /Sales/ })).toHaveAttribute("aria-sort", "descending");
    expect(fetchMock).toHaveBeenCalledTimes(13);
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(within(table).getAllByText("Not targeted")).toHaveLength(10);
    expect(within(table).getByLabelText("Total Impressions")).toHaveTextContent("10,945");
    expect(within(table).getByLabelText("Total Clicks")).toHaveTextContent("55");
    expect(within(table).getByLabelText("Total Spend")).toHaveTextContent("$110.00");
    expect(within(table).getByLabelText("Total Sales")).toHaveTextContent("$660.00");
    expect(within(table).getByLabelText("Total Orders")).toHaveTextContent("66");
    expect(within(table).getByLabelText("Total ACOS")).toHaveTextContent("17%");
    expect(within(region).queryByText(/Filtered locally/)).not.toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Create Bulk Campaigns" }).closest("div")?.parentElement).toHaveTextContent("11 matches");
    const sourceLink = within(table).getByRole("link", { name: "Open Scale Insights Search terms for search term 1" });
    expect(sourceLink).toHaveAttribute(
      "href",
      "https://portal.scaleinsights.com/Ads/SearchTerms/Index?from=2026-06-17&to=2026-09-08&asinList=B012345678",
    );
    expect(within(table).queryByRole("link", { name: "Create SKC campaign in Scale Insights for search term 1" })).not.toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Create Bulk Campaigns" })).toBeDisabled();
    fireEvent.click(within(table).getByRole("checkbox", { name: "Select search term search term 1" }));
    fireEvent.click(within(table).getByRole("checkbox", { name: "Select search term search term 3" }));
    expect(within(region).getByRole("status", { name: "2 search terms selected" })).toBeVisible();
    expect(within(region).getByRole("link", { name: "Create bulk campaigns for 2 selected search terms" })).toHaveAttribute(
      "href",
      "https://portal.scaleinsights.com/MassCampaigns/KeywordCampaigns/Customize?asin=B012345678&keyword=search+term+1%0Asearch+term+3",
    );
    fireEvent.click(within(table).getByRole("checkbox", { name: "Select all visible search terms" }));
    expect(within(region).getByRole("status", { name: "9 search terms selected" })).toBeVisible();
    expect(within(table).getByRole("checkbox", { name: "Select all visible search terms" })).toBeChecked();
    fireEvent.click(within(table).getByRole("checkbox", { name: "Select all visible search terms" }));
    expect(within(region).getByRole("status", { name: "0 search terms selected" })).toBeVisible();
    expect(within(region).getByRole("button", { name: "Create Bulk Campaigns" })).toBeDisabled();
    fireEvent.click(sourceLink);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("search term 1"));
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(within(table).getByRole("button", { name: "Copy search term search term 1" }));
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(within(table).getByRole("button", { name: "Copied search term search term 1" })).toBeVisible();
    act(() => vi.advanceTimersByTime(2_000));
    expect(within(table).getByRole("button", { name: "Copy search term search term 1" })).toBeVisible();
    vi.useRealTimers();
    fireEvent.click(within(table).getByRole("button", { name: "Sort Impressions highest to lowest" }));
    expect(within(table).getByRole("columnheader", { name: /Impressions/ })).toHaveAttribute("aria-sort", "descending");
    fireEvent.click(within(table).getByRole("button", { name: "Sort Impressions lowest to highest" }));
    expect(within(table).getByRole("columnheader", { name: /Impressions/ })).toHaveAttribute("aria-sort", "ascending");
    expect(table.querySelector("tbody th")?.textContent).toContain("search term 11");
    expect(within(region).getByLabelText("Minimum PPC Sales")).toHaveValue(null);
    expect(within(region).queryByLabelText("Minimum PPC Orders")).not.toBeInTheDocument();
    fireEvent.click(within(region).getByRole("button", { name: "Show all 11" }));
    expect(within(table).getByText("search term 11")).toBeVisible();
    expect(within(table).getByText("990")).toBeVisible();
    fireEvent.change(within(region).getByLabelText("Opportunity type"), { target: { value: "Product ASIN" } });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByLabelText("Total Impressions")).toHaveTextContent("999");
    expect(within(table).getByLabelText("Total Clicks")).toHaveTextContent("5");
    expect(within(table).getByLabelText("Total Spend")).toHaveTextContent("$10.00");
    expect(within(table).getByLabelText("Total Sales")).toHaveTextContent("$100.00");
    expect(within(table).getByLabelText("Total Orders")).toHaveTextContent("2");
    expect(within(table).getByLabelText("Total ACOS")).toHaveTextContent("10%");
    expect(within(table).getByRole("link", { name: "B0ABCDEF12" })).toHaveAttribute("href", "https://www.amazon.com/dp/B0ABCDEF12");
    expect(within(table).queryByRole("link", { name: /Create .* campaign in Scale Insights for B0ABCDEF12/ })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(13);
    expect(within(region).queryByRole("button", { name: "Fetch Again" })).not.toBeInTheDocument();
  });

  it("restores the latest validated result and refreshes it only on a new shared request", async () => {
    const fetchMock = vi.fn(historyResponse);
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<UntargetedSalesOpportunities asin="B012345678" weekStart="2026-09-02" refreshVersion={0} />);
    await screen.findByRole("table", { name: "Untargeted sales opportunities" });
    expect(fetchMock).toHaveBeenCalledTimes(13);
    view.unmount();
    render(<UntargetedSalesOpportunities asin="B012345678" weekStart="2026-09-02" refreshVersion={0} />);
    await screen.findByRole("table", { name: "Untargeted sales opportunities" });
    expect(fetchMock).toHaveBeenCalledTimes(13);
    cleanup();
    const refreshed = render(<UntargetedSalesOpportunities asin="B012345678" weekStart="2026-09-02" refreshVersion={0} />);
    refreshed.rerender(<UntargetedSalesOpportunities asin="B012345678" weekStart="2026-09-02" refreshVersion={2} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(26));
  });

  it("loads at most two requests, keeps older-only terms, clears selections on week changes, and retries missing weeks", async () => {
    let active = 0;
    let maximumActive = 0;
    let failWeek = true;
    const oldRow = { ...payload().opportunities[0], term: "Older only", sales: 40, spend: 8 };
    const unknownRow = { ...oldRow, term: "Needs review" };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      active++; maximumActive = Math.max(maximumActive, active);
      await new Promise(resolve => setTimeout(resolve, 2));
      active--;
      const query = new URL(String(input), "http://localhost").searchParams;
      const date = query.get("weekStart")!;
      if (date === "2026-08-19" && failWeek) return { ok: false, status: 502, json: async () => ({ error: "Temporary provider failure" }) };
      const result = await historyResponse(input);
      const value = await result.json();
      if (query.get("weeks") === "12") {
        value.opportunities.performanceRows.push(oldRow, unknownRow);
        const extended = value.opportunities as typeof value.opportunities & { targetingCoverage: { term: string; type: string; state: string }[] };
        extended.targetingCoverage.push({ term: oldRow.term, type: "Search term", state: "untargeted" }, { term: unknownRow.term, type: "Search term", state: "unverified" });
        value.opportunities.complete = false;
      } else if (date === "2026-08-26") {
        value.opportunities.opportunities = [oldRow, unknownRow];
        value.opportunities.performanceRows = [oldRow, unknownRow];
      }
      return { ok: true, status: 200, json: async () => value };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<UntargetedSalesOpportunities asin="B012345678" weekStart="2026-09-02" refreshVersion={0} />);
    const table = await screen.findByRole("table", { name: "Untargeted sales opportunities" });
    expect(maximumActive).toBe(2);
    expect(screen.getByText(/11 of 12 weeks loaded/, { selector: "small" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Show all 13" }));
    expect(within(table).getByText("Older only")).toBeVisible();
    expect(within(table).getByRole("checkbox", { name: "Select search term Needs review" })).toBeDisabled();
    expect(within(table).getByText(/Targeting unverified — review required/)).toBeVisible();
    fireEvent.click(within(table).getByRole("checkbox", { name: "Select search term Older only" }));
    expect(screen.getByRole("link", { name: "Create bulk campaigns for 1 selected search term" })).toHaveAttribute("href", expect.stringContaining("keyword=Older+only"));
    fireEvent.change(screen.getByLabelText("Reporting week"), { target: { value: "2026-09-02" } });
    expect(screen.getByRole("status", { name: "0 search terms selected" })).toBeVisible();
    expect(within(table).queryByText("Older only")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(13);
    fireEvent.change(screen.getByLabelText("Reporting week"), { target: { value: "all" } });
    failWeek = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry missing weeks / targeting" }));
    await waitFor(() => expect(screen.getByText(/12 of 12 weeks loaded/)).toBeVisible());
    expect(fetchMock).toHaveBeenCalledTimes(15);
  });
});
