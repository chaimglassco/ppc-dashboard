import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPublishedDocuments } from "../data/repository";
import { createBlankContentElement } from "../domain/document-elements";
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
  Reader: ({ doc, mutationsEnabled, onSaveContentElements }: {
    doc: { title: string; description: string; category: string; contentElements?: unknown[] };
    mutationsEnabled: boolean;
    onSaveContentElements: (elements: unknown[], metadata: { title: string; description: string; category: string }) => Promise<void>;
  }) =>
    <div data-testid="reader">
      {doc.title}:{mutationsEnabled ? "editable" : "read-only"}
      <button type="button" onClick={() => {
        void onSaveContentElements(doc.contentElements ?? [], {
          title: doc.title,
          description: doc.description,
          category: doc.category,
        }).catch(() => undefined);
      }}>Save formatted document</button>
    </div>,
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

  it("explains a deleted stale link and lets an ADMIN recover it", async () => {
    const document = getPublishedDocuments()[0];
    const deletedResponse: SharedLibraryResponse = {
      ...response([]),
      recoveryDocumentCount: 1,
      documentStatus: {
        status: "deleted",
        slug: document.slug,
        documentId: document.id,
        title: document.title,
        deletedAt: "2026-07-28T01:00:00.000Z",
        recordVersion: 4,
        deletionAudit: {
          source: "user",
          deletedAt: "2026-07-28T01:00:00.000Z",
          reason: "Manual document deletion",
          actor: { name: "Admin User", email: "admin@example.com", role: "ADMIN" },
          initiatedBy: null,
        },
      },
    };
    client.hydrateSharedLibraryState.mockResolvedValue({ response: deletedResponse, source: "server" });
    client.mutateSharedLibrary.mockResolvedValue(response([document]));
    render(<ManagedReader slug={document.slug} />);

    expect(await screen.findByRole("heading", { name: `“${document.title}” was deleted` })).toBeVisible();
    expect(screen.getByText(/Deleted .* by Admin User/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Recover document" }));

    await waitFor(() => expect(client.mutateSharedLibrary).toHaveBeenCalledWith({
      operation: "document.restore",
      documentId: document.id,
      expectedVersion: 4,
    }, { slug: document.slug }));
    await waitFor(() => expect(screen.getByTestId("reader")).toHaveTextContent(`${document.title}:editable`));
  });

  it("keeps an active document visible after a verified formatted-content save", async () => {
    const base = getPublishedDocuments()[0];
    const statement = {
      ...createBlankContentElement("statement", 1),
      text: "Open guide",
      richText: {
        type: "doc" as const,
        content: [{
          type: "paragraph" as const,
          content: [{
            type: "text" as const,
            text: "Open guide",
            marks: [{ type: "link" as const, attrs: { href: "https://example.com/guide" } }],
          }],
        }],
      },
    };
    const document = { ...base, contentElements: [statement] };
    const initial = response([document]);
    const saved: SharedLibraryResponse = {
      ...initial,
      revision: 3,
      recordVersions: { ...initial.recordVersions, documents: { [document.id]: 2 } },
      documentStatus: { status: "active", slug: document.slug, documentId: document.id, recordVersion: 2 },
      mutationResult: {
        operation: "document.update",
        documentId: document.id,
        document,
        recordVersion: 2,
        lifecycleState: "active",
      },
    };
    client.hydrateSharedLibraryState.mockResolvedValue({ response: initial, source: "server" });
    client.mutateSharedLibrary.mockResolvedValue(saved);
    render(<ManagedReader slug={document.slug} />);

    fireEvent.click(await screen.findByRole("button", { name: "Save formatted document" }));

    await waitFor(() => expect(client.mutateSharedLibrary).toHaveBeenCalledWith(expect.objectContaining({
      operation: "document.update",
      documentId: document.id,
      expectedVersion: 1,
      updateScope: "content",
      document: expect.objectContaining({ id: document.id, contentElements: [expect.objectContaining({ richText: statement.richText })] }),
    }), { slug: document.slug }));
    expect(screen.getByTestId("reader")).toHaveTextContent(`${document.title}:editable`);
    expect(screen.queryByRole("heading", { name: "Document unavailable" })).not.toBeInTheDocument();
  });

  it("preserves the current document when a save response cannot prove it stayed active", async () => {
    const document = { ...getPublishedDocuments()[0], contentElements: [createBlankContentElement("statement", 1)] };
    const initial = response([document]);
    client.hydrateSharedLibraryState.mockResolvedValue({ response: initial, source: "server" });
    client.mutateSharedLibrary.mockResolvedValue({
      ...response([]),
      revision: 3,
      documentStatus: { status: "active", slug: document.slug, documentId: document.id, recordVersion: 2 },
    });
    render(<ManagedReader slug={document.slug} />);

    fireEvent.click(await screen.findByRole("button", { name: "Save formatted document" }));

    expect(await screen.findByText(/save could not be verified/i)).toBeVisible();
    expect(screen.getByTestId("reader")).toHaveTextContent(`${document.title}:editable`);
    expect(screen.queryByRole("heading", { name: "Document unavailable" })).not.toBeInTheDocument();
  });

  it("keeps the last confirmed document read-only when a refresh omits it without an explicit lifecycle", async () => {
    const document = getPublishedDocuments()[0];
    client.hydrateSharedLibraryState.mockResolvedValue({ response: response([document]), source: "server" });
    client.fetchSharedLibraryState.mockResolvedValue({
      ...response([]),
      revision: 3,
      documentStatus: { status: "not_found", slug: document.slug },
    });
    render(<ManagedReader slug={document.slug} />);

    expect(await screen.findByTestId("reader")).toHaveTextContent(`${document.title}:editable`);
    window.dispatchEvent(new Event("focus"));

    await waitFor(() => expect(screen.getByText(/current editor copy was preserved/i)).toBeVisible());
    expect(screen.getByTestId("reader")).toHaveTextContent(`${document.title}:read-only`);
    expect(screen.queryByRole("heading", { name: "Document unavailable" })).not.toBeInTheDocument();
  });
});
