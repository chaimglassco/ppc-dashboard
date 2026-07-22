import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PpcDashboardPage from "./page";

describe("PPC Dashboard placeholder", () => {
  it("renders the authenticated-shell page content without dashboard functionality", () => {
    render(<PpcDashboardPage />);
    expect(screen.getByRole("heading", { name: "PPC Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });
});
