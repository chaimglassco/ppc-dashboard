import { describe, expect, it } from "vitest";
import { getPublishedDocuments } from "../data/repository";
import { createDefaultCategories } from "./category-storage";
import { createSharedLibraryState, mergeLocalIntoShared, mergeLocalOnlyIntoShared, mergeSharedLibraryState, parseSharedLibraryState } from "./shared-library-state";

describe("shared library state", () => {
  it("rejects malformed shared snapshots", () => {
    expect(parseSharedLibraryState(null)).toBeNull();
    expect(parseSharedLibraryState({ version: 1, documents: "bad", categories: [] })).toBeNull();
  });

  it("merges local-only documents into the shared catalog", () => {
    const seed = getPublishedDocuments();
    const shared = createSharedLibraryState(seed);
    const localDocument = { ...seed[0], id: "local-sample", slug: "local-sample", title: "Local sample" };
    const merged = mergeLocalOnlyIntoShared(shared, [...seed, localDocument], createDefaultCategories());
    expect(merged.documents.some(document => document.id === "local-sample")).toBe(true);
    expect(merged.documents.filter(document => document.id === seed[0].id)).toHaveLength(1);
  });

  it("lets a one-time local migration replace an older shared copy with the same ID", () => {
    const seed = getPublishedDocuments();
    const shared = createSharedLibraryState(seed);
    const local = seed.map(document => document.id === seed[0].id ? { ...document, title: "Renamed local sample" } : document);
    const merged = mergeLocalIntoShared(shared, local, createDefaultCategories());
    expect(merged.documents.find(document => document.id === seed[0].id)?.title).toBe("Renamed local sample");
  });

  it("restores seeded documents and default categories around a stored snapshot", () => {
    const seed = getPublishedDocuments();
    const stored = createSharedLibraryState([seed[0]]);
    stored.categories = stored.categories.slice(0, 1);
    const merged = mergeSharedLibraryState(seed, stored);
    expect(merged.documents).toHaveLength(seed.length);
    expect(merged.categories).toHaveLength(createDefaultCategories().length);
  });
});
