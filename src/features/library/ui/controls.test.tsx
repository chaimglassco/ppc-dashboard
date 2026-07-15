import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReadingStateProvider } from "../state/reading-state";
import { BookmarkButton } from "./bookmark-button";
import { getPublishedDocuments } from "../data/repository";
import { Catalog } from "./catalog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/library", useSearchParams: () => new URLSearchParams() }));
describe("accessible controls", () => {
  it("labels bookmark state", () => { render(<ReadingStateProvider><BookmarkButton id="a" compact /></ReadingStateProvider>); expect(screen.getByRole("button", { name: "Add bookmark" })).toHaveAttribute("aria-pressed", "false"); });
  it("labels catalog search and category filter", () => { render(<ReadingStateProvider><Catalog documents={getPublishedDocuments()} /></ReadingStateProvider>); expect(screen.getByRole("textbox", { name: "Search documents" })).toBeVisible(); expect(screen.getByRole("combobox", { name: "Category" })).toBeVisible(); expect(screen.queryByRole("combobox", { name: "Document type" })).not.toBeInTheDocument(); });
  it("shows the eye in view mode and pencil controls in admin mode", () => { const view = render(<ReadingStateProvider><Catalog documents={getPublishedDocuments()} /></ReadingStateProvider>); const controls = within(view.container); expect(controls.getByRole("button", { name: "Manage library" }).querySelector(".lucide-eye")).toBeTruthy(); fireEvent.click(controls.getByRole("button", { name: "Manage library" })); expect(controls.getByRole("button", { name: "Return to library view" }).querySelector(".lucide-pencil")).toBeTruthy(); expect(controls.getByRole("button", { name: "Manage categories" })).toBeVisible(); expect(controls.getByRole("button", { name: "Add new topic" })).toBeVisible(); });
  it("omits tags when adding a new topic", () => { const view = render(<ReadingStateProvider><Catalog documents={getPublishedDocuments()} /></ReadingStateProvider>); const controls = within(view.container); fireEvent.click(controls.getByRole("button", { name: "Manage library" })); fireEvent.click(controls.getByRole("button", { name: "Add new topic" })); expect(controls.getByRole("dialog", { name: "Add new topic" })).toBeVisible(); expect(controls.queryByRole("textbox", { name: "Tags" })).not.toBeInTheDocument(); });
});
