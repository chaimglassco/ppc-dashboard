import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReadingStateProvider } from "../state/reading-state";
import { BookmarkButton } from "./bookmark-button";
import { getPublishedDocuments } from "../data/repository";
import { Catalog } from "./catalog";
import { DocumentEditor } from "./document-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/library", useSearchParams: () => new URLSearchParams() }));
describe("accessible controls", () => {
  it("labels bookmark state", () => { render(<ReadingStateProvider><BookmarkButton id="a" compact /></ReadingStateProvider>); expect(screen.getByRole("button", { name: "Add bookmark" })).toHaveAttribute("aria-pressed", "false"); });
  it("labels catalog search and category filter", () => { render(<ReadingStateProvider><Catalog documents={getPublishedDocuments()} /></ReadingStateProvider>); expect(screen.getByRole("textbox", { name: "Search documents" })).toBeVisible(); expect(screen.getByRole("combobox", { name: "Category" })).toBeVisible(); expect(screen.getByRole("option", { name: "All categories" })).toBeVisible(); expect(screen.queryByRole("option", { name: /^Amazon PPC$/ })).not.toBeInTheDocument(); expect(screen.queryByRole("combobox", { name: "Document type" })).not.toBeInTheDocument(); });
  it("shows the eye in view mode and pencil controls in admin mode", () => { const view = render(<ReadingStateProvider><Catalog documents={getPublishedDocuments()} /></ReadingStateProvider>); const controls = within(view.container); expect(controls.getByRole("button", { name: "Manage library" }).querySelector(".lucide-eye")).toBeTruthy(); fireEvent.click(controls.getByRole("button", { name: "Manage library" })); expect(controls.getByRole("button", { name: "Return to library view" }).querySelector(".lucide-pencil")).toBeTruthy(); expect(controls.getByRole("button", { name: "Manage categories" })).toBeVisible(); expect(controls.getByRole("button", { name: "Add new topic" })).toBeVisible(); expect(controls.queryByRole("button", { name: "Edit / Rename" })).not.toBeInTheDocument(); });
  it("opens document reordering from the catalog toolbar", () => { const view = render(<ReadingStateProvider><Catalog documents={getPublishedDocuments()} /></ReadingStateProvider>); const controls = within(view.container); expect(controls.getByRole("button", { name: "REORDER" })).toBeVisible(); fireEvent.click(controls.getByRole("button", { name: "REORDER" })); expect(controls.getByRole("dialog", { name: "Reorder library documents" })).toBeVisible(); });
  it("omits tags when adding a new topic", () => { const view = render(<ReadingStateProvider><Catalog documents={getPublishedDocuments()} /></ReadingStateProvider>); const controls = within(view.container); fireEvent.click(controls.getByRole("button", { name: "Manage library" })); fireEvent.click(controls.getByRole("button", { name: "Add new topic" })); expect(controls.getByRole("dialog", { name: "Add new topic" })).toBeVisible(); expect(controls.queryByRole("textbox", { name: "Tags" })).not.toBeInTheDocument(); });
  it("keeps document metadata out of the editor form", () => {
    const document = getPublishedDocuments()[0];
    const onSave = vi.fn();
    const view = render(<DocumentEditor document={document} categories={[document.category]} onCancel={vi.fn()} onSave={onSave} onCreateCategory={vi.fn(() => true)} onManageCategories={vi.fn()} />);
    const controls = within(view.container);
    expect(controls.queryByRole("combobox", { name: "Document type" })).not.toBeInTheDocument();
    expect(controls.queryByRole("textbox", { name: "Tags" })).not.toBeInTheDocument();
    expect(controls.queryByRole("textbox", { name: "Content (Markdown)" })).not.toBeInTheDocument();
    expect(controls.getByRole("button", { name: "Create category" })).toBeVisible();
    expect(controls.getByRole("button", { name: "Edit categories" })).toBeVisible();
    fireEvent.click(controls.getByRole("button", { name: "Save changes" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ type: document.type, tags: document.tags.join(", "), body: document.body }));
  });
  it("creates and selects a category from the document editor", () => {
    const document = getPublishedDocuments()[0];
    const onCreateCategory = vi.fn(() => true);
    const onManageCategories = vi.fn();
    const view = render(<DocumentEditor document={document} categories={[document.category]} onCancel={vi.fn()} onSave={vi.fn()} onCreateCategory={onCreateCategory} onManageCategories={onManageCategories} />);
    const controls = within(view.container);
    fireEvent.click(controls.getByRole("button", { name: "Create category" }));
    fireEvent.change(controls.getByRole("textbox", { name: "New category" }), { target: { value: "Wholesale" } });
    fireEvent.click(controls.getByRole("button", { name: "Create" }));
    expect(onCreateCategory).toHaveBeenCalledWith("Wholesale");
    expect(controls.getByRole("combobox", { name: "Category" })).toHaveValue("Wholesale");
    fireEvent.click(controls.getByRole("button", { name: "Edit categories" }));
    expect(onManageCategories).toHaveBeenCalledTimes(1);
  });
});
