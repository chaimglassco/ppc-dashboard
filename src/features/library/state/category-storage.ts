import { CATEGORIES } from "../domain/types";

export type ManagedCategory = {
  id: string;
  name: string;
  hidden: boolean;
  deletedAt?: string;
};

type CategoryState = { version: 1; categories: ManagedCategory[] };

const categoryId = (name: string, index: number) => `category-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;

export function createDefaultCategories(): ManagedCategory[] {
  return CATEGORIES.map((name, index) => ({ id: categoryId(name, index), name, hidden: false }));
}

export function parseCategoryState(raw: string | null): CategoryState | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const state = value as Record<string, unknown>;
    if (state.version !== 1 || !Array.isArray(state.categories)) return null;
    const categories = state.categories.filter((item): item is ManagedCategory => {
      if (!item || typeof item !== "object") return false;
      const category = item as Record<string, unknown>;
      return typeof category.id === "string" && typeof category.name === "string" && typeof category.hidden === "boolean" && (category.deletedAt === undefined || typeof category.deletedAt === "string");
    });
    return { version: 1, categories };
  } catch {
    return null;
  }
}

export function moveCategory(categories: ManagedCategory[], id: string, direction: -1 | 1) {
  const active = categories.filter(category => !category.deletedAt);
  const position = active.findIndex(category => category.id === id);
  const targetPosition = position + direction;
  if (position < 0 || targetPosition < 0 || targetPosition >= active.length) return categories;
  const index = categories.findIndex(category => category.id === id);
  const targetIndex = categories.findIndex(category => category.id === active[targetPosition].id);
  const next = [...categories];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}
