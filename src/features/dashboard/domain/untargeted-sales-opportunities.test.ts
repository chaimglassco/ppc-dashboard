import { describe, expect, it } from "vitest";
import { parseUntargetedSalesOpportunities } from "./untargeted-sales-opportunities";

const valid = {
  asin: "b012345678", country: "us", currency: "usd", dataState: "Partial",
  period: { startDate: "2026-09-02", endDate: "2026-09-08" },
  freshness: { searchDataAsOf: "2026-09-09", coverageDataAsOf: "2026-09-09" },
  opportunities: [{ term: "lead knife", type: "Search term", sales: 25, orders: 1, spend: 5, clicks: 3, acos: 20 }], warnings: [],
};

describe("untargeted opportunity response validation", () => {
  it("normalizes valid responses", () => expect(parseUntargetedSalesOpportunities(valid)).toMatchObject({ asin: "B012345678", country: "US", currency: "USD" }));
  it("rejects invalid metrics and product ASINs", () => {
    expect(parseUntargetedSalesOpportunities({ ...valid, opportunities: [{ ...valid.opportunities[0], orders: 1.5 }] })).toBeNull();
    expect(parseUntargetedSalesOpportunities({ ...valid, opportunities: [{ ...valid.opportunities[0], type: "Product ASIN", term: "bad" }] })).toBeNull();
  });
});
