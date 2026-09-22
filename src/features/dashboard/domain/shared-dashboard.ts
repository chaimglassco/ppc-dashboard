import { PPC_DASHBOARD_STORAGE_KEY, parsePpcDashboardStore } from "./ppc-dashboard-state";
import { PPC_DASHBOARD_CATALOG_STORAGE_KEY, parseDashboardCatalogStore } from "./ppc-dashboard-catalog";
import { PPC_PERFORMANCE_CACHE_KEY, parsePerformanceCache } from "./ppc-performance-cache";
import { ACCOUNT_CAMPAIGN_SNAPSHOT_STORAGE_KEY, parseAccountCampaignSnapshotCache } from "./account-campaign-compare";
import { PPC_CAMPAIGN_CSV_CACHE_KEY, parseCampaignCsvImportCache } from "./campaign-comparison-csv";
import { PPC_UNTARGETED_OPPORTUNITIES_CACHE_KEY, parseUntargetedOpportunityCache } from "./untargeted-sales-opportunities";

export const DASHBOARD_STORES = [
  { key: PPC_DASHBOARD_STORAGE_KEY, label: "Weekly reports, goals and notes" },
  { key: PPC_DASHBOARD_CATALOG_STORAGE_KEY, label: "Products, tags and display order" },
  { key: PPC_PERFORMANCE_CACHE_KEY, label: "Saved weekly performance" },
  { key: ACCOUNT_CAMPAIGN_SNAPSHOT_STORAGE_KEY, label: "Account campaign CSV imports" },
  { key: PPC_CAMPAIGN_CSV_CACHE_KEY, label: "Product campaign CSV imports" },
  { key: PPC_UNTARGETED_OPPORTUNITIES_CACHE_KEY, label: "Saved search term opportunities" },
] as const;
export type DashboardStoreKey = typeof DASHBOARD_STORES[number]["key"];
export const MAX_SHARED_DASHBOARD_BYTES = 3_500_000;
export type DashboardDocument = {
  version: 1; key: DashboardStoreKey; value: string; savedAt: string; operationId: string;
  actor: string;
};
export type DashboardDocumentResponse = { document: DashboardDocument | null; etag: string | null; canEdit: boolean };
export function isDashboardStoreKey(key: unknown): key is DashboardStoreKey {
  return DASHBOARD_STORES.some(store => store.key === key);
}
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

// Use the existing v1 parsers, but reject dropped records instead of silently migrating partial data.
export function validateDashboardValue(key: DashboardStoreKey, raw: string): string {
  if (new TextEncoder().encode(raw).length > MAX_SHARED_DASHBOARD_BYTES) throw new Error("This dashboard dataset exceeds the 3.5 MB sharing limit. Its local copy has been kept.");
  const value: unknown = JSON.parse(raw);
  if (!record(value) || value.version !== 1) throw new Error("Unsupported dashboard data version.");
  let normalized: unknown;
  if (key === PPC_DASHBOARD_CATALOG_STORAGE_KEY) {
    if (!Array.isArray(value.tags) || !Array.isArray(value.customProducts) || !record(value.productOverrides)) throw new Error("Invalid product catalog.");
    const catalog = parseDashboardCatalogStore(raw);
    if (catalog.tags.length !== value.tags.length || catalog.customProducts.length !== value.customProducts.length || Object.keys(catalog.productOverrides).length !== Object.keys(value.productOverrides).length) throw new Error("Some catalog records are invalid. The original data has been kept.");
    normalized = catalog;
  } else {
    const field = key === PPC_DASHBOARD_STORAGE_KEY ? "reports" : "entries";
    if (!record(value[field])) throw new Error("Invalid dashboard records.");
    const entries = key === PPC_DASHBOARD_STORAGE_KEY ? parsePpcDashboardStore(raw).reports
      : key === PPC_PERFORMANCE_CACHE_KEY ? parsePerformanceCache(raw)
      : key === ACCOUNT_CAMPAIGN_SNAPSHOT_STORAGE_KEY ? parseAccountCampaignSnapshotCache(raw)
      : key === PPC_CAMPAIGN_CSV_CACHE_KEY ? parseCampaignCsvImportCache(raw)
      : parseUntargetedOpportunityCache(raw);
    if (Object.keys(entries).length !== Object.keys(value[field]).length) throw new Error("Some saved dashboard records are invalid. The original data has been kept.");
    normalized = { version: 1, [field]: entries };
  }
  return JSON.stringify(normalized);
}

export function dashboardRecordCount(key: DashboardStoreKey, raw: string): number {
  const value = JSON.parse(validateDashboardValue(key, raw));
  return key === PPC_DASHBOARD_CATALOG_STORAGE_KEY
    ? value.tags.length + value.customProducts.length + Object.keys(value.productOverrides).length + value.hiddenPipelineProductIds.length + (value.productOrderIds?.length ?? 0)
    : Object.keys(value.reports ?? value.entries).length;
}

export function parseDashboardDocument(value: unknown, key: DashboardStoreKey): DashboardDocument {
  if (!record(value) || value.version !== 1 || value.key !== key || typeof value.value !== "string"
    || typeof value.savedAt !== "string" || !Number.isFinite(Date.parse(value.savedAt))
    || typeof value.operationId !== "string" || typeof value.actor !== "string") throw new Error("The shared dashboard response is invalid.");
  return { version: 1, key, value: validateDashboardValue(key, value.value), savedAt: value.savedAt, operationId: value.operationId, actor: value.actor };
}
