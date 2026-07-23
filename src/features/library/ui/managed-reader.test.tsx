import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPublishedDocuments } from "../data/repository";
import { createDefaultCategories } from "../state/category-storage";
import type { SharedLibraryResponse } from "../state/shared-library-state";
import { ManagedReader } from "./managed-reader";

const client = vi.hoisted(() => ({
  fetchSharedLibraryState: vi.fn(),
  hydrateSharedLibraryState: vi.fn(),
  mutateSharedLibrary: vi.fn(),
}));

vi.mock("../state/shared-library-client", async importOriginal => {
  const actual = await importOriginal<typeof import("../state/shared-library-client")>();
  return { ...actual, ...client };
});

vi.mock("./reader", () => ({
  Reader: ({ doc, mutationsEnabled }: { doc: { title: string }; mutationsEnabled: boolean }) =>
    <div data-testid="reader">{doc.title}:{mutationsEnabled ? "editable" : "read-only"}</div>,
}));

function response(documents = getPublishedDocuments().slice(0, 1)): SharedLibraryResponse {
  return {
    initialized: true,
    state: { version: 1, documents, categories: createDefaultCategories() },
    revision: 2,
    recordVersions: { documents: Object.fromEntries(documents.map(document => [document.id, 1])), categories: {} },
    updatedAt: null,
    updatedBy: null,
  };
}

describe("managed reader loading states", () => {
  beforeEach(() => {
    client.fetchSharedLibraryState.mockReset();
    client.hydrateSharedLibraryState.mockReset();
    client.mutateSharedLibrary.mockReset();
  });
  afterEach(cleanup);

  it("shows a retryable connection error instead of claiming the document is unavailable", async () => {
    client.hydrateSharedLibraryState.mockRejectedValue(new Error("offline"));
    render(<ManagedReader slug="checking-spend" />);

    expect(await screen.findByRole("heading", { name: "Library connection unavailable" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Document unavailable" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });

  it("shows Document unavailable only after an authoritative response has no matching document", async () => {
    client.hydrateSharedLibraryState.mockResolvedValue({ response: response([]), source: "server" });
    render(<ManagedReader slug="missing-document" />);

    expect(await screen.findByRole("heading", { name: "Document unavailable" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Library connection unavailable" })).not.toBeInTheDocument();
  });

  it("shows a full cached document read-only during an outage", async () => {
    const document = getPublishedDocuments()[0];
    client.hydrateSharedLibraryState.mockResolvedValue({ response: response([document]), source: "cache" });
    render(<ManagedReader slug={document.slug} />);

    expect(await screen.findByTestId("reader")).toHaveTextContent(`${document.title}:read-only`);
    expect(screen.getByText(/confirmed copy is read-only/i)).toBeVisible();
  });

  it("loads the document after a manual retry succeeds", async () => {
    const document = getPublishedDocuments()[0];
    client.hydrateSharedLibraryState.mockRejectedValue(new Error("offline"));
    client.fetchSharedLibraryState.mockResolvedValue(response([document]));
    render(<ManagedReader slug={document.slug} />);

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));

    await waitFor(() => expect(screen.getByTestId("reader")).toHaveTextContent(`${document.title}:editable`));
  });
});
