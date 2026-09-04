import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/pipeline-auth-server", () => ({ verifyPipelineRequest: vi.fn() }));
vi.mock("@/features/dashboard/data/scale-insights-server", () => {
  class ScaleInsightsConfigurationError extends Error {}
  return { getScaleInsightsWeeklyPerformance: vi.fn(), ScaleInsightsConfigurationError };
});

import { getScaleInsightsWeeklyPerformance, ScaleInsightsConfigurationError } from "@/features/dashboard/data/scale-insights-server";
import { verifyPipelineRequest } from "@/lib/pipeline-auth-server";
import { GET, parsePerformanceQuery } from "./route";

const requestUrl = "http://localhost/ppc/api/dashboard/performance?asin=b0fg4h5c6w&country=us&weekStart=2026-08-26";

describe("PPC dashboard performance API", () => {
  beforeEach(() => {
    vi.mocked(verifyPipelineRequest).mockResolvedValue({ user: { email: "admin@example.com", name: "Admin", role: "ADMIN" } });
    vi.mocked(getScaleInsightsWeeklyPerformance).mockReset();
  });

  it("normalizes a bounded Wednesday-through-Tuesday query", () => {
    expect(parsePerformanceQuery(new Request(requestUrl))).toEqual({
      asin: "B0FG4H5C6W",
      country: "US",
      startDate: "2026-08-26",
      endDate: "2026-09-01",
    });
    expect(() => parsePerformanceQuery(new Request(requestUrl.replace("2026-08-26", "2026-08-27")))).toThrow(/Wednesday/);
    expect(() => parsePerformanceQuery(new Request(requestUrl.replace("b0fg4h5c6w", "bad")))).toThrow(/ASIN/);
  });

  it("authenticates before returning a minimal no-store performance DTO", async () => {
    const performance = {
      asin: "B0FG4H5C6W", country: "US", startDate: "2026-08-26", endDate: "2026-09-01", currency: "USD",
      metrics: { spend: 81.75, ppcSales: 481.75, ppcOrders: 23, totalSales: 1317.35, totalOrders: 59, organicSales: 835.6, organicOrders: 36, acos: 16.97, tacos: 6.21 },
      freshness: { adsDataAsOf: "ads", salesDataAsOf: "sales", salesDataThrough: "2026-09-01" }, warnings: [],
    };
    vi.mocked(getScaleInsightsWeeklyPerformance).mockResolvedValue(performance);

    const response = await GET(new Request(requestUrl, { headers: { Authorization: "Bearer pipeline-token" } }));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    await expect(response.json()).resolves.toEqual({ performance });
    expect(verifyPipelineRequest).toHaveBeenCalledOnce();
    expect(getScaleInsightsWeeklyPerformance).toHaveBeenCalledWith({
      asin: "B0FG4H5C6W", country: "US", startDate: "2026-08-26", endDate: "2026-09-01",
    });
  });

  it("does not query Scale Insights when Pipeline authentication fails", async () => {
    vi.mocked(verifyPipelineRequest).mockResolvedValue(new Response(null, { status: 401 }));
    const response = await GET(new Request(requestUrl));
    expect(response.status).toBe(401);
    expect(getScaleInsightsWeeklyPerformance).not.toHaveBeenCalled();
  });

  it("returns a safe configuration error without leaking credential details", async () => {
    vi.mocked(getScaleInsightsWeeklyPerformance).mockRejectedValue(new ScaleInsightsConfigurationError("secret name"));
    const response = await GET(new Request(requestUrl));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Scale Insights is not configured on this server." });
  });
});
