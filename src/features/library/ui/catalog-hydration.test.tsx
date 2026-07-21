import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublishedDocuments } from "../data/repository";
import { createDefaultCategories } from "../state/category-storage";
import { ReadingStateProvider } from "../state/reading-state";
import type { SharedLibraryState } from "../state/shared-library-state";
import { Catalog } from "./catalog";

const hydrateSharedLibraryState = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/library", useSearchParams: () => new URLSearchParams() }));
vi.mock("../state/shared-library-client", async importOriginal => {
  const actual = await importOriginal<typeof import("../state/shared-library-client")>();
  return { ...actual, hydrateSharedLibraryState };
});

describe("catalog hydration", () => {
  beforeEach(() => {
    hydrateSharedLibraryState.mockReset();
    window.localStorage.clear();
  });

  it("never renders seed documents while the saved deletion state is loading", async () => {
    const documents = getPublishedDocuments();
    let resolveHydration!: (state: SharedLibraryState) => void;
    hydrateSharedLibraryState.mockReturnValue(new Promise<SharedLibraryState>(resolve => { resolveHydration = resolve; }));

    render(<ReadingStateProvider><Catalog documents={documents} /></ReadingStateProvider>);

    expect(screen.getByLabelText("Loading library documents")).toBeVisible();
    expect(screen.queryByText(documents[0].title)).not.toBeInTheDocument();

    await act(async () => {
      resolveHydration({
        version: 1,
        documents: documents.map((document, index) => index === 0 ? { ...document, deletedAt: "2026-07-21T00:00:00.000Z" } : document),
        categories: createDefaultCategories(),
      });
    });

    await waitFor(() => expect(screen.queryByLabelText("Loading library documents")).not.toBeInTheDocument());
    expect(screen.queryByText(documents[0].title)).not.toBeInTheDocument();
    expect(screen.getByText(documents[1].title)).toBeVisible();
  });
});
