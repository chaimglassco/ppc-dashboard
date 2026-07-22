import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import BookmarksPage from "@/app/library/bookmarks/page";
import RecentPage from "@/app/library/recent/page";
import { ReadingStateProvider } from "../state/reading-state";
import { LibraryHero } from "./library-hero";

function renderWithReadingState(children: React.ReactNode) {
  return render(<ReadingStateProvider>{children}</ReadingStateProvider>);
}

afterEach(cleanup);

describe("Library navigation refinements", () => {
  it("keeps bookmarks in the hero and removes the recently viewed shortcut", () => {
    renderWithReadingState(<LibraryHero />);
    expect(screen.getByRole("link", { name: /bookmarked documents/ })).toHaveAttribute("href", "/library/bookmarks");
    expect(screen.queryByRole("link", { name: "Recently viewed documents" })).not.toBeInTheDocument();
  });

  it.each([
    ["Bookmarks", BookmarksPage],
    ["Recently viewed", RecentPage],
  ])("adds a Back to Library control to %s", (_name, Page) => {
    renderWithReadingState(<Page />);
    expect(screen.getByRole("link", { name: /Back to Library/ })).toHaveAttribute("href", "/library");
  });
});
