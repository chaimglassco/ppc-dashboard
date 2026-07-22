import { describe, expect, it } from "vitest";
import { getPublishedDocuments } from "../data/repository";
import { createDefaultCategories } from "./category-storage";
import { createSharedLibraryState, parseSharedLibraryResponse, parseSharedLibraryState } from "./shared-library-state";

describe("shared library state", () => {
  it("rejects malformed snapshots without adding repository seeds", () => {
    expect(parseSharedLibraryState(null)).toBeNull();
    expect(parseSharedLibraryState({ version: 1, documents: "bad", categories: [] })).toBeNull();
    const seed = getPublishedDocuments();
    const parsed = parseSharedLibraryState(createSharedLibraryState([seed[0]]));
    expect(parsed?.documents.map(document => document.id)).toEqual([seed[0].id]);
  });

  it("validates revision and per-record versions", () => {
    const state = createSharedLibraryState(getPublishedDocuments().slice(0, 1));
    const response = parseSharedLibraryResponse({
      initialized: true,
      state,
      revision: 7,
      recordVersions: { documents: { [state.documents[0].id]: 3 }, categories: Object.fromEntries(createDefaultCategories().map(category => [category.id, 1])) },
      updatedAt: "2026-07-22T00:00:00.000Z",
      updatedBy: "admin@example.com",
    });
    expect(response?.revision).toBe(7);
    expect(response?.recordVersions.documents[state.documents[0].id]).toBe(3);
    expect(parseSharedLibraryResponse({ initialized: true, state, revision: -1, recordVersions: { documents: {}, categories: {} } })).toBeNull();
    expect(parseSharedLibraryResponse({ state, revision: 0, recordVersions: { documents: {}, categories: {} } })).toBeNull();
  });
});
