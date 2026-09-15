export type UntargetedOpportunityType = "Search term" | "Product ASIN";

export type UntargetedSalesOpportunity = {
  term: string;
  type: UntargetedOpportunityType;
  sourceCampaignId?: string;
  sourceAdGroupId?: string;
  sourceKeyword?: string;
  sourceMatchType?: string;
  sales: number;
  orders: number;
  spend: number;
  impressions: number;
  clicks: number;
  acos: number | null;
};

export type UntargetedSalesOpportunities = {
  asin: string;
  country: string;
  currency: string;
  period: { startDate: string; endDate: string };
  dataState: "Final" | "Partial";
  ppcClicks?: number;
  freshness: { searchDataAsOf: string; coverageDataAsOf: string };
  opportunities: UntargetedSalesOpportunity[];
  warnings: string[];
};

export const PPC_UNTARGETED_OPPORTUNITIES_CACHE_KEY = "glassco.ppcUntargetedOpportunitiesCache.v1";
export const untargetedOpportunityCacheKey = (country: string, asin: string, weekStart: string) => `${country.trim().toUpperCase()}:${asin.trim().toUpperCase()}:${weekStart}`;
export type UntargetedOpportunityCache = Record<string, UntargetedSalesOpportunities>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNonNegative(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function parseUntargetedSalesOpportunities(value: unknown): UntargetedSalesOpportunities | null {
  if (!isRecord(value) || !isRecord(value.period) || !isRecord(value.freshness) || !Array.isArray(value.opportunities) || !Array.isArray(value.warnings)) return null;
  const asin = text(value.asin).toUpperCase();
  const country = text(value.country).toUpperCase();
  const currency = text(value.currency).toUpperCase();
  const startDate = text(value.period.startDate);
  const endDate = text(value.period.endDate);
  const dataState = value.dataState === "Final" || value.dataState === "Partial" ? value.dataState : null;
  const ppcClicks = value.ppcClicks == null ? undefined : finiteNonNegative(value.ppcClicks);
  if (!/^[A-Z0-9]{10}$/.test(asin) || !/^[A-Z]{2}$/.test(country) || !/^[A-Z]{3}$/.test(currency) || !isoDate(startDate) || !isoDate(endDate) || startDate > endDate || !dataState || (value.ppcClicks != null && (ppcClicks == null || !Number.isInteger(ppcClicks)))) return null;

  const opportunities: UntargetedSalesOpportunity[] = [];
  for (const candidate of value.opportunities) {
    if (!isRecord(candidate)) return null;
    const term = text(candidate.term);
    const type = candidate.type === "Search term" || candidate.type === "Product ASIN" ? candidate.type : null;
    const sales = finiteNonNegative(candidate.sales);
    const orders = finiteNonNegative(candidate.orders);
    const spend = finiteNonNegative(candidate.spend);
    const impressions = finiteNonNegative(candidate.impressions);
    const clicks = finiteNonNegative(candidate.clicks);
    const acos = candidate.acos == null ? null : finiteNonNegative(candidate.acos);
    const sourceCampaignId = candidate.sourceCampaignId == null ? undefined : text(candidate.sourceCampaignId);
    const sourceAdGroupId = candidate.sourceAdGroupId == null ? undefined : text(candidate.sourceAdGroupId);
    const sourceKeyword = candidate.sourceKeyword == null ? undefined : text(candidate.sourceKeyword);
    const sourceMatchType = candidate.sourceMatchType == null ? undefined : text(candidate.sourceMatchType);
    if (!term || !type || sales == null || orders == null || !Number.isInteger(orders) || spend == null || impressions == null || !Number.isInteger(impressions) || clicks == null || !Number.isInteger(clicks) || (candidate.acos != null && acos == null)) return null;
    if ((candidate.sourceCampaignId != null && !sourceCampaignId) || (candidate.sourceAdGroupId != null && !sourceAdGroupId) || (candidate.sourceKeyword != null && !sourceKeyword) || (candidate.sourceMatchType != null && !sourceMatchType)) return null;
    if (type === "Product ASIN" && !/^[A-Z0-9]{10}$/.test(term)) return null;
    opportunities.push({ term, type, sourceCampaignId, sourceAdGroupId, sourceKeyword, sourceMatchType, sales, orders, spend, impressions, clicks, acos });
  }
  if (!value.warnings.every(warning => typeof warning === "string")) return null;
  return {
    asin,
    country,
    currency,
    period: { startDate, endDate },
    dataState,
    ...(ppcClicks == null ? {} : { ppcClicks }),
    freshness: { searchDataAsOf: text(value.freshness.searchDataAsOf), coverageDataAsOf: text(value.freshness.coverageDataAsOf) },
    opportunities: opportunities.toSorted((first, second) => second.sales - first.sales || second.orders - first.orders || first.term.localeCompare(second.term)),
    warnings: value.warnings.map(warning => String(warning).trim()).filter(Boolean),
  };
}

export function parseUntargetedOpportunityCache(value: string | null): UntargetedOpportunityCache {
  if (!value) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return {};
  }
  if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.entries)) return {};
  return Object.fromEntries(Object.entries(parsed.entries).flatMap(([key, candidate]) => {
    const report = parseUntargetedSalesOpportunities(candidate);
    if (!report || key !== untargetedOpportunityCacheKey(report.country, report.asin, report.period.startDate)) return [];
    return [[key, report]];
  }));
}

export function withUntargetedOpportunityCacheEntry(cache: UntargetedOpportunityCache, report: UntargetedSalesOpportunities, maximumEntries = 50) {
  const key = untargetedOpportunityCacheKey(report.country, report.asin, report.period.startDate);
  const entries = [...Object.entries(cache).filter(([entryKey]) => entryKey !== key), [key, report] as const];
  return Object.fromEntries(entries.slice(-Math.max(1, maximumEntries))) as UntargetedOpportunityCache;
}
