import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublishedDocuments } from "../data/repository";
import { createDefaultCategories } from "../state/category-storage";
import { ReadingStateProvider } from "../state/reading-state";
import type { SharedLibraryState } from "../state/shared-library-state";
import { Catalog } from "./catalog";

const client = vi.hoisted(() => ({ hydrateSharedLibraryState: vi.fn(), initializeCleanLibrary: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/library", useSearchParams: () => new URLSearchParams() }));
vi.mock("../state/shared-library-client", async importOriginal => {
  const actual = await importOriginal<typeof import("../state/shared-library-client")>();
  return { ...actual, ...client };
});

describe("catalog hydration", () => {
  beforeEach(() => {
    client.hydrateSharedLibraryState.mockReset();
    client.initializeCleanLibrary.mockReset();
    window.localStorage.clear();
  });

  it("never renders seed documents while the saved deletion state is loading", async () => {
    const documents = getPublishedDocuments();
    let resolveHydration!: (value: { response: { initialized: boolean; state: SharedLibraryState; revision: number; recordVersions: { documents: Record<string, number>; categories: Record<string, number> }; updatedAt: null; updatedBy: null }; source: "server" }) => void;
    client.hydrateSharedLibraryState.mockReturnValue(new Promise(resolve => { resolveHydration = resolve; }));

    render(<ReadingStateProvider><Catalog documents={documents} /></ReadingStateProvider>);

    expect(screen.getByLabelText("Loading library documents")).toBeVisible();
    expect(screen.queryByText(documents[0].title)).not.toBeInTheDocument();

    await act(async () => {
      resolveHydration({
        response: {
          initialized: true,
          state: { version: 1, documents: documents.map((document, index) => index === 0 ? { ...document, deletedAt: "2026-07-21T00:00:00.000Z" } : document), categories: createDefaultCategories() },
          revision: 1,
          recordVersions: { documents: {}, categories: {} },
          updatedAt: null,
          updatedBy: null,
        },
        source: "server",
      });
    });

    await waitFor(() => expect(screen.queryByLabelText("Loading library documents")).not.toBeInTheDocument());
    expect(screen.queryByText(documents[0].title)).not.toBeInTheDocument();
    expect(screen.getByText(documents[1].title)).toBeVisible();
  });

  it("keeps an uninitialized authoritative catalog read-only without seeding it", async () => {
    client.hydrateSharedLibraryState.mockResolvedValue({
      response: {
        initialized: false,
        state: { version: 1, documents: [], categories: [] },
        revision: 0,
        recordVersions: { documents: {}, categories: {} },
        updatedAt: null,
        updatedBy: null,
      },
      source: "server",
    });

    const view = render(<ReadingStateProvider><Catalog documents={getPublishedDocuments()} /></ReadingStateProvider>);
    const catalog = within(view.container);

    await waitFor(() => expect(catalog.getByText(/Library migration pending/)).toBeVisible());
    expect(catalog.getByRole("button", { name: "Add new topic" })).toBeDisabled();
    expect(catalog.getByText("0 documents")).toBeVisible();
    expect(catalog.queryByText(getPublishedDocuments()[0].title)).not.toBeInTheDocument();
  });

  it("lets an ADMIN confirm and run the protected migration", async () => {
    const uninitialized = {
      initialized: false,
      state: { version: 1 as const, documents: [], categories: [] },
      revision: 0,
      recordVersions: { documents: {}, categories: {} },
      updatedAt: null,
      updatedBy: null,
    };
    const restored = { ...uninitialized, initialized: true, revision: 1, state: { version: 1 as const, documents: getPublishedDocuments().slice(0, 2), categories: createDefaultCategories() } };
    client.hydrateSharedLibraryState.mockResolvedValue({ response: uninitialized, source: "server" });
    client.initializeCleanLibrary.mockResolvedValue(restored);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const view = render(<ReadingStateProvider><Catalog documents={getPublishedDocuments()} /></ReadingStateProvider>);
    const catalog = within(view.container);

    await waitFor(() => expect(catalog.getByRole("button", { name: "Back up and restore Library" })).toBeEnabled());
    fireEvent.click(catalog.getByRole("button", { name: "Back up and restore Library" }));

    await waitFor(() => expect(client.initializeCleanLibrary).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(catalog.getByText("Library backup and restoration completed successfully.")).toBeVisible());
    expect(catalog.queryByRole("button", { name: "Back up and restore Library" })).not.toBeInTheDocument();
  });

  it("keeps migration pending and reports a failed ADMIN migration", async () => {
    client.hydrateSharedLibraryState.mockResolvedValue({ response: { initialized: false, state: { version: 1, documents: [], categories: [] }, revision: 0, recordVersions: { documents: {}, categories: {} }, updatedAt: null, updatedBy: null }, source: "server" });
    client.initializeCleanLibrary.mockRejectedValue(new Error("Backup could not be created."));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const view = render(<ReadingStateProvider><Catalog documents={getPublishedDocuments()} /></ReadingStateProvider>);
    const catalog = within(view.container);

    await waitFor(() => expect(catalog.getByRole("button", { name: "Back up and restore Library" })).toBeEnabled());
    fireEvent.click(catalog.getByRole("button", { name: "Back up and restore Library" }));

    await waitFor(() => expect(catalog.getByText("Library migration failed: Backup could not be created.")).toBeVisible());
    expect(catalog.getByRole("button", { name: "Back up and restore Library" })).toBeEnabled();
  });
});
