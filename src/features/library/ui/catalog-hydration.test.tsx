import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPublishedDocuments } from "../data/repository";
import { createDefaultCategories } from "../state/category-storage";
import { ReadingStateProvider } from "../state/reading-state";
import type { SharedLibraryState } from "../state/shared-library-state";
import { Catalog } from "./catalog";

const client = vi.hoisted(() => ({ fetchSharedLibraryState: vi.fn(), fetchPurgedLibraryDocuments: vi.fn(), hydrateSharedLibraryState: vi.fn(), initializeSharedLibrary: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/library", useSearchParams: () => new URLSearchParams() }));
vi.mock("../state/shared-library-client", async importOriginal => {
  const actual = await importOriginal<typeof import("../state/shared-library-client")>();
  return { ...actual, ...client };
});

describe("catalog hydration", () => {
  beforeEach(() => {
    client.fetchSharedLibraryState.mockReset();
    client.fetchPurgedLibraryDocuments.mockReset();
    client.hydrateSharedLibraryState.mockReset();
    client.initializeSharedLibrary.mockReset();
    client.fetchPurgedLibraryDocuments.mockResolvedValue([]);
    window.localStorage.clear();
  });
  afterEach(() => { vi.useRealTimers(); });

  it("does not start overlapping five-second polls while initial hydration is pending", async () => {
    vi.useFakeTimers();
    client.hydrateSharedLibraryState.mockReturnValue(new Promise(() => undefined));
    const view = render(<ReadingStateProvider><Catalog documents={getPublishedDocuments()} /></ReadingStateProvider>);

    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });

    expect(client.fetchSharedLibraryState).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Loading library documents")).toBeVisible();
    view.unmount();
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

  it("shows the authoritative empty Library state and keeps Recovery available to ADMIN", async () => {
    const emptyResponse = {
      initialized: true,
      state: { version: 1 as const, documents: [], categories: createDefaultCategories() },
      revision: 9,
      recordVersions: { documents: {}, categories: {} },
      updatedAt: null,
      updatedBy: null,
      recoveryDocumentCount: 0,
    };
    client.hydrateSharedLibraryState.mockResolvedValue({ response: emptyResponse, source: "server" });
    client.fetchSharedLibraryState.mockResolvedValue(emptyResponse);
    const view = render(<ReadingStateProvider><Catalog documents={getPublishedDocuments()} /></ReadingStateProvider>);
    const catalog = within(view.container);

    await waitFor(() => expect(catalog.getByText("The Library has no active documents")).toBeVisible());
    fireEvent.click(catalog.getByRole("button", { name: "Manage library" }));

    expect(catalog.getByRole("button", { name: "Open document recovery" })).toBeEnabled();
    expect(catalog.getByRole("button", { name: "REORDER" })).toBeDisabled();
    expect(catalog.getByText("Reorder needs at least 2 active documents. Add or recover another document first.")).toBeVisible();
  });

  it("opens Recovery immediately while its two data sources load independently", async () => {
    const documents = getPublishedDocuments().slice(0, 2);
    const liveResponse = {
      initialized: true,
      state: { version: 1 as const, documents, categories: createDefaultCategories() },
      revision: 3,
      recordVersions: { documents: Object.fromEntries(documents.map(document => [document.id, 1])), categories: {} },
      updatedAt: null,
      updatedBy: null,
      recoveryDocumentCount: 0,
    };
    let finishRecovery!: (value: typeof liveResponse) => void;
    let finishHistory!: (value: []) => void;
    client.hydrateSharedLibraryState.mockResolvedValue({ response: liveResponse, source: "server" });
    client.fetchSharedLibraryState.mockReturnValue(new Promise(resolve => { finishRecovery = resolve; }));
    client.fetchPurgedLibraryDocuments.mockReturnValue(new Promise(resolve => { finishHistory = resolve; }));
    const view = render(<ReadingStateProvider><Catalog documents={documents} /></ReadingStateProvider>);
    const catalog = within(view.container);

    await waitFor(() => expect(catalog.getByRole("button", { name: "Manage library" })).toBeEnabled());
    fireEvent.click(catalog.getByRole("button", { name: "Manage library" }));
    fireEvent.click(catalog.getByRole("button", { name: "Open document recovery" }));

    expect(catalog.getByRole("dialog", { name: "Deleted documents" })).toBeVisible();
    expect(catalog.getByText("Loading recoverable documents...")).toBeVisible();
    expect(catalog.getByText("Loading permanent deletion history...")).toBeVisible();

    await act(async () => {
      finishRecovery(liveResponse);
      finishHistory([]);
    });
    await waitFor(() => expect(catalog.queryByText("Loading recoverable documents...")).not.toBeInTheDocument());
    expect(catalog.getByText("No recoverable or known permanently deleted documents were found.")).toBeVisible();
  });

  it("keeps cached controls read-only, offers Retry, and restores admin controls after reconnecting", async () => {
    const documents = getPublishedDocuments().slice(0, 2);
    const cachedResponse = {
      initialized: true,
      state: { version: 1 as const, documents, categories: createDefaultCategories() },
      revision: 3,
      recordVersions: { documents: Object.fromEntries(documents.map(document => [document.id, 1])), categories: {} },
      updatedAt: null,
      updatedBy: null,
    };
    client.hydrateSharedLibraryState.mockResolvedValue({ response: cachedResponse, source: "cache" });
    client.fetchSharedLibraryState.mockResolvedValue(cachedResponse);
    const view = render(<ReadingStateProvider><Catalog documents={getPublishedDocuments()} /></ReadingStateProvider>);
    const catalog = within(view.container);

    await waitFor(() => expect(catalog.getByRole("button", { name: "Try again" })).toBeEnabled());
    expect(catalog.getByRole("button", { name: "Manage library" })).toBeDisabled();
    expect(catalog.getByRole("button", { name: "REORDER" })).toBeDisabled();

    fireEvent.click(catalog.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(catalog.getByRole("button", { name: "Manage library" })).toBeEnabled());
    expect(catalog.getByRole("button", { name: "REORDER" })).toBeEnabled();
    expect(catalog.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("revalidates immediately when a browser-cached catalog page is restored", async () => {
    const documents = getPublishedDocuments().slice(0, 2);
    const liveResponse = {
      initialized: true,
      state: { version: 1 as const, documents, categories: createDefaultCategories() },
      revision: 3,
      recordVersions: { documents: Object.fromEntries(documents.map(document => [document.id, 1])), categories: {} },
      updatedAt: null,
      updatedBy: null,
      recoveryDocumentCount: 0,
    };
    client.hydrateSharedLibraryState.mockResolvedValue({ response: liveResponse, source: "server" });
    client.fetchSharedLibraryState.mockResolvedValue(liveResponse);
    render(<ReadingStateProvider><Catalog documents={getPublishedDocuments()} /></ReadingStateProvider>);
    await waitFor(() => expect(screen.queryByLabelText("Loading library documents")).not.toBeInTheDocument());

    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));

    await waitFor(() => expect(client.fetchSharedLibraryState).toHaveBeenCalledWith(undefined, { summary: true }));
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
    client.initializeSharedLibrary.mockResolvedValue(restored);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const view = render(<ReadingStateProvider><Catalog documents={getPublishedDocuments()} /></ReadingStateProvider>);
    const catalog = within(view.container);

    await waitFor(() => expect(catalog.getByRole("button", { name: "Back up and import complete Library" })).toBeEnabled());
    fireEvent.click(catalog.getByRole("button", { name: "Back up and import complete Library" }));

    await waitFor(() => expect(client.initializeSharedLibrary).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(catalog.getByText("Library backup and complete catalog import finished successfully.")).toBeVisible());
    expect(catalog.queryByRole("button", { name: "Back up and import complete Library" })).not.toBeInTheDocument();
  });

  it("keeps migration pending and reports a failed ADMIN migration", async () => {
    client.hydrateSharedLibraryState.mockResolvedValue({ response: { initialized: false, state: { version: 1, documents: [], categories: [] }, revision: 0, recordVersions: { documents: {}, categories: {} }, updatedAt: null, updatedBy: null }, source: "server" });
    client.initializeSharedLibrary.mockRejectedValue(new Error("Backup could not be created."));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const view = render(<ReadingStateProvider><Catalog documents={getPublishedDocuments()} /></ReadingStateProvider>);
    const catalog = within(view.container);

    await waitFor(() => expect(catalog.getByRole("button", { name: "Back up and import complete Library" })).toBeEnabled());
    fireEvent.click(catalog.getByRole("button", { name: "Back up and import complete Library" }));

    await waitFor(() => expect(catalog.getByText("Library migration failed: Backup could not be created.")).toBeVisible());
    expect(catalog.getByRole("button", { name: "Back up and import complete Library" })).toBeEnabled();
  });
});
