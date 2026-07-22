import { describe, expect, it, vi } from "vitest";
import type { SharedLibraryState } from "../state/shared-library-state";

vi.mock("@vercel/blob", () => ({ get: vi.fn(), put: vi.fn() }));

import { createCleanLegacyCatalog, LegacyLibraryBackupError } from "./legacy-library-backup";

function state(documents: Array<Record<string, unknown>>): SharedLibraryState {
  return { version: 1, documents, categories: [{ id: "guide", name: "Guide", hidden: false }] } as unknown as SharedLibraryState;
}

describe("legacy Library cleanup", () => {
  it("restores only the two exact production titles and preserves their records", () => {
    const source = state([
      { id: "sample-id", slug: "sample", title: "Sample Document with all the elements", deletedAt: "2026-01-01T00:00:00.000Z", contentElements: [{ id: "keep-me" }] },
      { id: "checking-id", slug: "checking", title: "Checking Spenders with No Sales", settings: { layout: "wide" } },
      { id: "starter-id", slug: "starter", title: "Starter" },
      { id: "deleted-id", slug: "deleted", title: "Already deleted", deletedAt: "2025-01-01T00:00:00.000Z" },
    ]);

    const result = createCleanLegacyCatalog(source, "2026-07-22T12:34:56.000Z");

    expect(result.state.documents).toEqual([
      { id: "sample-id", slug: "sample", title: "Sample Document with all the elements", contentElements: [{ id: "keep-me" }] },
      { id: "checking-id", slug: "checking", title: "Checking Spenders with No Sales", settings: { layout: "wide" } },
      { id: "starter-id", slug: "starter", title: "Starter", deletedAt: "2026-07-22T12:34:56.000Z" },
      { id: "deleted-id", slug: "deleted", title: "Already deleted", deletedAt: "2025-01-01T00:00:00.000Z" },
    ]);
    expect(result.report).toMatchObject({ activeDocuments: 2, newlyTombstoned: 1, previouslyTombstoned: 1 });
  });

  it("fails closed when an exact title is missing or duplicated", () => {
    const missing = state([{ id: "sample-id", slug: "sample", title: "Sample Document with all the elements" }]);
    expect(() => createCleanLegacyCatalog(missing)).toThrow(LegacyLibraryBackupError);

    const duplicate = state([
      { id: "sample-1", slug: "sample-1", title: "Sample Document with all the elements" },
      { id: "sample-2", slug: "sample-2", title: "Sample Document with all the elements" },
      { id: "checking-id", slug: "checking", title: "Checking Spenders with No Sales" },
    ]);
    expect(() => createCleanLegacyCatalog(duplicate)).toThrow('found 2');
  });
});
