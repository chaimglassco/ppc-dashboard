import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReadingStateProvider } from "../state/reading-state";
import { BookmarkButton } from "./bookmark-button";
import { getPublishedDocuments } from "../data/repository";
import { Catalog } from "./catalog";
import { DocumentEditor } from "./document-editor";
import { CategoryManager } from "./category-manager";
import { DeletedDocuments } from "./deleted-documents";
import { createDefaultCategories } from "../state/category-storage";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/library", useSearchParams: () => new URLSearchParams() }));
describe("accessible controls", () => {
  beforeEach(() => {
    const documents = getPublishedDocuments();
    const body = { initialized: true, state: { version: 1, documents, categories: createDefaultCategories() }, revision: 1, recordVersions: { documents: Object.fromEntries(documents.map(document => [document.id, 1])), categories: {} }, updatedAt: null, updatedBy: null };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })));
  });
  it("labels bookmark state", () => { render(<ReadingStateProvider><BookmarkButton id="a" compact /></ReadingStateProvider>); expect(screen.getByRole("button", { name: "Add bookmark" })).toHaveAttribute("aria-pressed", "false"); });
  it("labels catalog search and category filter", () => { render(<ReadingStateProvider><Catalog documents={getPublishedDocuments()} /></ReadingStateProvider>); expect(screen.getByRole("textbox", { name: "Search documents" })).toBeVisible(); expect(screen.getByRole("combobox", { name: "Category" })).toBeVisible(); expect(screen.getByRole("option", { name: "All categories" })).toBeVisible(); expect(screen.queryByRole("option", { name: /^Amazon PPC$/ })).not.toBeInTheDocument(); expect(screen.queryByRole("combobox", { name: "Document type" })).not.toBeInTheDocument(); });
  it("keeps add document visible and shows recovery in admin mode", async () => { const view = render(<ReadingStateProvider><Catalog documents={getPublishedDocuments()} /></ReadingStateProvider>); const controls = within(view.container); await waitFor(() => expect(controls.getByRole("button", { name: "Manage library" })).toBeEnabled()); expect(controls.getByRole("button", { name: "Manage library" }).querySelector(".lucide-eye")).toBeTruthy(); expect(controls.getByRole("button", { name: "Add new topic" })).toBeVisible(); expect(controls.queryByRole("button", { name: /Open document recovery/ })).not.toBeInTheDocument(); fireEvent.click(controls.getByRole("button", { name: "Manage library" })); expect(controls.getByRole("button", { name: "Return to library view" }).querySelector(".lucide-pencil")).toBeTruthy(); expect(controls.getByRole("button", { name: "Manage categories" })).toBeVisible(); expect(controls.getByRole("button", { name: "Add new topic" })).toBeVisible(); expect(controls.getByRole("button", { name: "Open document recovery" })).toBeDisabled(); expect(controls.queryByRole("button", { name: "Edit / Rename" })).not.toBeInTheDocument(); });
  it("opens document reordering from the catalog toolbar", async () => { const view = render(<ReadingStateProvider><Catalog documents={getPublishedDocuments()} /></ReadingStateProvider>); const controls = within(view.container); await waitFor(() => expect(controls.getByRole("button", { name: "REORDER" })).toBeEnabled()); fireEvent.click(controls.getByRole("button", { name: "REORDER" })); expect(controls.getByRole("dialog", { name: "Reorder library documents" })).toBeVisible(); });
  it("omits tags when adding a new topic", async () => { const view = render(<ReadingStateProvider><Catalog documents={getPublishedDocuments()} /></ReadingStateProvider>); const controls = within(view.container); await waitFor(() => expect(controls.getByRole("button", { name: "Add new topic" })).toBeEnabled()); fireEvent.click(controls.getByRole("button", { name: "Manage library" })); fireEvent.click(controls.getByRole("button", { name: "Add new topic" })); expect(controls.getByRole("dialog", { name: "Add new topic" })).toBeVisible(); expect(controls.queryByRole("textbox", { name: "Tags" })).not.toBeInTheDocument(); });
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
  it("keeps deleted categories behind the recovery icon", () => {
    const onRecover = vi.fn();
    const view = render(<CategoryManager categories={[{ id: "active", name: "Active category", hidden: false }, { id: "deleted", name: "Deleted category", hidden: true, deletedAt: "2026-07-17" }]} documentCounts={{ "Deleted category": 2 }} onClose={vi.fn()} onCreate={vi.fn()} onRename={vi.fn()} onToggleHidden={vi.fn()} onDelete={vi.fn()} onRecover={onRecover} onMove={vi.fn()} />);
    const controls = within(view.container);
    expect(controls.queryByRole("heading", { name: "Deleted categories" })).not.toBeInTheDocument();
    fireEvent.click(controls.getByRole("button", { name: "Open category recovery (1)" }));
    const recovery = controls.getByRole("dialog", { name: "Deleted categories" });
    expect(recovery).toBeVisible();
    fireEvent.click(within(recovery).getByRole("button", { name: "Recover" }));
    expect(onRecover).toHaveBeenCalledWith("deleted");
  });
  it("shows deleted documents only inside the recovery dialog", () => {
    const onRecover = vi.fn();
    const onClose = vi.fn();
    const document = { ...getPublishedDocuments()[0], deletedAt: "2026-07-17T04:00:00.000Z" };
    const view = render(<DeletedDocuments documents={[document]} onClose={onClose} onRecover={onRecover} />);
    const dialog = within(view.container).getByRole("dialog", { name: "Deleted documents" });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByText(document.title)).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: "Recover" }));
    expect(onRecover).toHaveBeenCalledWith(document.id);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
