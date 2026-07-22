import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublishedDocuments } from "../data/repository";
import { createDefaultCategories } from "../state/category-storage";
import { ReadingStateProvider } from "../state/reading-state";
import type { SharedLibraryResponse } from "../state/shared-library-state";
import { Catalog } from "./catalog";

const client = vi.hoisted(() => ({ fetchSharedLibraryState: vi.fn(), hydrateSharedLibraryState: vi.fn(), mutateSharedLibrary: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/library", useSearchParams: () => new URLSearchParams() }));
vi.mock("../state/shared-library-client", async importOriginal => {
  const actual = await importOriginal<typeof import("../state/shared-library-client")>();
  return { ...actual, ...client };
});

const document = getPublishedDocuments()[0];

function response(deletedAt?: string): SharedLibraryResponse {
  return {
    initialized: true,
    state: { version: 1, documents: [{ ...document, ...(deletedAt ? { deletedAt } : {}) }], categories: createDefaultCategories() },
    revision: deletedAt ? 2 : 1,
    recordVersions: { documents: { [document.id]: deletedAt ? 2 : 1 }, categories: {} },
    updatedAt: null,
    updatedBy: null,
  };
}

function renderCatalog() {
  return render(<ReadingStateProvider><Catalog documents={[document]} /></ReadingStateProvider>);
}

async function enterAdminMode() {
  await waitFor(() => expect(screen.getByRole("button", { name: "Manage library" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Manage library" }));
}

describe("catalog document deletion", () => {
  beforeEach(() => {
    client.fetchSharedLibraryState.mockReset();
    client.hydrateSharedLibraryState.mockReset();
    client.mutateSharedLibrary.mockReset();
    client.fetchSharedLibraryState.mockResolvedValue(response());
    client.hydrateSharedLibraryState.mockResolvedValue({ response: response(), source: "server" });
    window.localStorage.clear();
  });

  it("requires confirmation, shows progress, prevents duplicate requests, and announces success", async () => {
    let resolveDelete!: (value: SharedLibraryResponse) => void;
    client.mutateSharedLibrary.mockReturnValue(new Promise(resolve => { resolveDelete = resolve; }));
    renderCatalog();
    await enterAdminMode();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const firstDialog = screen.getByRole("dialog", { name: "Delete document?" });
    expect(within(firstDialog).getByText(document.title)).toBeVisible();
    expect(client.mutateSharedLibrary).not.toHaveBeenCalled();
    fireEvent.click(within(firstDialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Delete document?" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete document?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(within(dialog).getByRole("button", { name: "Deleting…" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("heading", { name: document.title })).toBeVisible();
    expect(client.mutateSharedLibrary).toHaveBeenCalledTimes(1);

    await act(async () => resolveDelete(response("2026-07-22T12:00:00.000Z")));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Delete document?" })).not.toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: document.title })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(`${document.title} was deleted successfully.`);
    expect(client.mutateSharedLibrary).toHaveBeenCalledWith({ operation: "document.delete", documentId: document.id, expectedVersion: 1 }, { summary: true });
  });

  it("keeps the document and confirmation available when deletion fails", async () => {
    client.mutateSharedLibrary.mockRejectedValue(new Error("offline"));
    renderCatalog();
    await enterAdminMode();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { name: "Delete document?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent("could not be deleted"));
    expect(screen.getByRole("heading", { name: document.title })).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Delete" })).toBeEnabled();
  });
});
