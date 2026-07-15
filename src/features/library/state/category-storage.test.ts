import { describe, expect, it, vi } from "vitest";
import { ADMIN_CATEGORIES_KEY, createDefaultCategories, moveCategory, parseCategoryState, readAdminCategories, writeAdminCategories } from "./category-storage";

describe("admin category storage", () => {
  it("provides default categories when storage is empty or malformed", () => {
    expect(readAdminCategories({ getItem: () => null })).toHaveLength(createDefaultCategories().length);
    expect(parseCategoryState("bad")).toBeNull();
  });

  it("preserves renamed categories and merges newly seeded defaults", () => {
    const defaults = createDefaultCategories();
    const stored = { version: 1 as const, categories: [{ ...defaults[0], name: "Renamed category" }] };
    const result = readAdminCategories({ getItem: () => JSON.stringify(stored) });
    expect(result[0].name).toBe("Renamed category");
    expect(result).toHaveLength(defaults.length);
  });

  it("reorders active categories without mutating the input", () => {
    const categories = createDefaultCategories().slice(0, 3);
    const moved = moveCategory(categories, categories[1].id, -1);
    expect(moved[0].id).toBe(categories[1].id);
    expect(categories[0].id).not.toBe(moved[0].id);
  });

  it("writes category state and handles blocked storage", () => {
    const setItem = vi.fn();
    expect(writeAdminCategories(createDefaultCategories(), { setItem })).toBe(true);
    expect(setItem).toHaveBeenCalledWith(ADMIN_CATEGORIES_KEY, expect.stringContaining('"version":1'));
    expect(writeAdminCategories([], { setItem: () => { throw new Error("blocked"); } })).toBe(false);
  });
});
