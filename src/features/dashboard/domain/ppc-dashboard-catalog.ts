import type { DashboardProduct } from "./ppc-dashboard-state";

export const PPC_DASHBOARD_CATALOG_STORAGE_KEY = "glassco.ppcDashboardCatalog.v1";
export const MAX_DASHBOARD_PRODUCT_IMAGE_BYTES = 900_000;

export type DashboardTag = { id: string; name: string };
export type DashboardCatalogProduct = DashboardProduct & {
  source: "dashboard";
  tagId: string;
  imageDataUrl: string;
};
export type DashboardProductOverride = {
  name: string;
  asin: string;
  sku: string;
  tagId: string;
  imageDataUrl: string;
};
export type DashboardCatalogStore = {
  version: 1;
  tags: DashboardTag[];
  customProducts: DashboardCatalogProduct[];
  productOverrides: Record<string, DashboardProductOverride>;
  hiddenPipelineProductIds: string[];
};
export type ManagedDashboardProduct = DashboardProduct & {
  source: "pipeline" | "dashboard";
  tagId: string;
  imageDataUrl: string;
};

export function emptyDashboardCatalog(): DashboardCatalogStore {
  return { version: 1, tags: [], customProducts: [], productOverrides: {}, hiddenPipelineProductIds: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function imageDataUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 1_250_000) return "";
  return /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(value) ? value : "";
}

function normalizeTag(value: unknown): DashboardTag | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 100);
  const name = text(value.name, 40);
  return id && name ? { id, name } : null;
}

function normalizeOverride(value: unknown): DashboardProductOverride | null {
  if (!isRecord(value)) return null;
  const name = text(value.name, 120);
  if (!name) return null;
  return {
    name,
    asin: text(value.asin, 30).toUpperCase(),
    sku: text(value.sku, 80),
    tagId: text(value.tagId, 100),
    imageDataUrl: imageDataUrl(value.imageDataUrl),
  };
}

function normalizeProduct(value: unknown): DashboardCatalogProduct | null {
  if (!isRecord(value)) return null;
  const id = text(value.id, 160);
  const name = text(value.name, 120);
  if (!id || !name) return null;
  return {
    id,
    name,
    asin: text(value.asin, 30).toUpperCase(),
    sku: text(value.sku, 80),
    stageId: "dashboard",
    status: "Active",
    source: "dashboard",
    tagId: text(value.tagId, 100),
    imageDataUrl: imageDataUrl(value.imageDataUrl),
  };
}

export function parseDashboardCatalogStore(raw: string | null): DashboardCatalogStore {
  if (!raw) return emptyDashboardCatalog();
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== 1) return emptyDashboardCatalog();
    const tags: DashboardTag[] = [];
    const tagNames = new Set<string>();
    const tagIds = new Set<string>();
    for (const candidate of Array.isArray(value.tags) ? value.tags : []) {
      const tag = normalizeTag(candidate);
      if (!tag) continue;
      const foldedName = tag.name.toLocaleLowerCase();
      if (tagIds.has(tag.id) || tagNames.has(foldedName)) continue;
      tags.push(tag);
      tagIds.add(tag.id);
      tagNames.add(foldedName);
    }
    const customProducts: DashboardCatalogProduct[] = [];
    const productIds = new Set<string>();
    for (const candidate of Array.isArray(value.customProducts) ? value.customProducts : []) {
      const product = normalizeProduct(candidate);
      if (!product || productIds.has(product.id)) continue;
      customProducts.push({ ...product, tagId: tagIds.has(product.tagId) ? product.tagId : "" });
      productIds.add(product.id);
    }
    const productOverrides: Record<string, DashboardProductOverride> = {};
    if (isRecord(value.productOverrides)) {
      for (const [id, candidate] of Object.entries(value.productOverrides)) {
        const cleanId = text(id, 160);
        const override = normalizeOverride(candidate);
        if (cleanId && override) productOverrides[cleanId] = { ...override, tagId: tagIds.has(override.tagId) ? override.tagId : "" };
      }
    }
    const hiddenPipelineProductIds: string[] = [];
    const hiddenIds = new Set<string>();
    for (const candidate of Array.isArray(value.hiddenPipelineProductIds) ? value.hiddenPipelineProductIds : []) {
      const id = text(candidate, 160);
      if (!id || hiddenIds.has(id) || hiddenPipelineProductIds.length >= 2_000) continue;
      hiddenPipelineProductIds.push(id);
      hiddenIds.add(id);
    }
    return { version: 1, tags, customProducts, productOverrides, hiddenPipelineProductIds };
  } catch {
    return emptyDashboardCatalog();
  }
}

export function mergeDashboardProducts(pipelineProducts: DashboardProduct[], catalog: DashboardCatalogStore): ManagedDashboardProduct[] {
  const hiddenIds = new Set(catalog.hiddenPipelineProductIds);
  const imported = pipelineProducts.filter(product => !hiddenIds.has(product.id)).map(product => {
    const override = catalog.productOverrides[product.id];
    return {
      ...product,
      ...(override ? { name: override.name, asin: override.asin, sku: override.sku } : {}),
      source: "pipeline" as const,
      tagId: override?.tagId ?? "",
      imageDataUrl: override?.imageDataUrl ?? "",
    };
  });
  return [...catalog.customProducts, ...imported];
}

export function createDashboardTagId(name: string, suffix: string) {
  const slug = name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28) || "tag";
  return `tag-${slug}-${suffix}`;
}
