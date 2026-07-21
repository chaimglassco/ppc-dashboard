import { describe, expect, it, vi } from "vitest";
import { getPublishedDocuments } from "../data/repository";
import { createBlankContentElement } from "../domain/document-elements";
import { ADMIN_LIBRARY_KEY, mergeAdminDocuments, moveDocument, parseAdminLibraryState, readAdminDocuments, writeAdminDocuments } from "./admin-storage";

describe("admin library storage", () => {
  const seed = getPublishedDocuments().slice(0, 2);
  it("falls back safely for missing or malformed state", () => { expect(parseAdminLibraryState("bad")).toBeNull(); expect(readAdminDocuments(seed, { getItem: () => null })).toHaveLength(2); });
  it("preserves stored order and merges new seed records", () => { const stored = { version: 1 as const, documents: [{ ...seed[1], title: "Renamed" }] }; const result = mergeAdminDocuments(seed, stored); expect(result.map(document => document.id)).toEqual([seed[1].id, seed[0].id]); expect(result[0].title).toBe("Renamed"); });
  it("moves records without mutating input", () => { const moved = moveDocument(seed, seed[1].id, -1); expect(moved.map(document => document.id)).toEqual([seed[1].id, seed[0].id]); expect(seed[0].id).not.toBe(moved[0].id); });
  it("writes a versioned snapshot and handles blocked storage", () => { const setItem = vi.fn(); expect(writeAdminDocuments(seed, { setItem })).toBe(true); expect(setItem).toHaveBeenCalledWith(ADMIN_LIBRARY_KEY, expect.stringContaining('"version":1')); expect(writeAdminDocuments(seed, { setItem: () => { throw new Error("blocked"); } })).toBe(false); });
  it("accepts new Button fields while retaining legacy elements without them", () => {
    const button = { ...createBlankContentElement("button", 1), buttonText: "Open", buttonUrl: "/library", buttonWidth: "large" as const, buttonAlignment: "right" as const };
    const legacy = createBlankContentElement("feature", 1);
    const value = JSON.stringify({ version: 1, documents: [{ ...seed[0], contentElements: [legacy, button] }] });
    expect(parseAdminLibraryState(value)?.documents[0].contentElements).toHaveLength(2);
  });
  it("accepts supported Insight colors and rejects unsupported values", () => {
    const insight = { ...createBlankContentElement("insight", 1), insightColor: "red" as const };
    const valid = JSON.stringify({ version: 1, documents: [{ ...seed[0], contentElements: [insight] }] });
    const invalid = JSON.stringify({ version: 1, documents: [{ ...seed[0], contentElements: [{ ...insight, insightColor: "purple" }] }] });
    expect(parseAdminLibraryState(valid)?.documents[0].contentElements?.[0].insightColor).toBe("red");
    expect(parseAdminLibraryState(invalid)?.documents).toHaveLength(0);
  });
});
