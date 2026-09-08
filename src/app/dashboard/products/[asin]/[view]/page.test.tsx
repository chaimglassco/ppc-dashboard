import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PpcAnalysisPage from "./page";

describe("ASIN-scoped PPC analysis page", () => {
  it("keeps every analysis destination scoped to the selected ASIN", async () => {
    render(await PpcAnalysisPage({ params: Promise.resolve({ asin: "b012345678", view: "campaigns" }) }));

    expect(screen.getByRole("heading", { level: 1, name: "Campaigns" })).toBeVisible();
    expect(screen.getAllByText("B012345678", { selector: "strong" })).toHaveLength(2);
    const navigation = screen.getByRole("navigation", { name: "Analysis sections for ASIN B012345678" });
    expect(within(navigation).getAllByRole("link")).toHaveLength(8);
    expect(within(navigation).getByRole("link", { name: "Campaigns" })).toHaveAttribute("href", "/dashboard/products/B012345678/campaigns");
    expect(within(navigation).getByRole("link", { name: "Main Keywords" })).toHaveAttribute("href", "/dashboard/products/B012345678/main-keywords");
    expect(within(navigation).getByRole("link", { name: "Campaigns" })).toHaveAttribute("aria-current", "page");
  });
});
