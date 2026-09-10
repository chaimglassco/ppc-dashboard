export type CampaignComparisonMetric = "sales" | "spend" | "orders";
export type CampaignComparisonDirection = "decline" | "increase";

export type CampaignPeriodMetrics = {
  sales: number;
  spend: number;
  orders: number;
};

export type CampaignMetricDelta = {
  absolute: number;
  percentage: number | null;
};

export type CampaignComparisonRow = {
  campaignId: string;
  sponsoredType: number;
  campaignName: string;
  previousActive: boolean;
  currentActive: boolean;
  previous: CampaignPeriodMetrics;
  current: CampaignPeriodMetrics;
  delta: Record<CampaignComparisonMetric, CampaignMetricDelta>;
};

export type CampaignComparisonPeriod = {
  startDate: string;
  endDate: string;
};

export type CampaignWeeklyComparison = {
  asin: string;
  country: string;
  currency: string;
  dataState: "Final" | "Partial";
  previousPeriod: CampaignComparisonPeriod;
  currentPeriod: CampaignComparisonPeriod;
  freshness: { previousDataAsOf: string; currentDataAsOf: string };
  campaigns: CampaignComparisonRow[];
  warnings: string[];
};

export type CampaignMoverCategory = {
  id: `${CampaignComparisonMetric}-${CampaignComparisonDirection}`;
  metric: CampaignComparisonMetric;
  direction: CampaignComparisonDirection;
  label: string;
};

export const CAMPAIGN_MOVER_CATEGORIES: CampaignMoverCategory[] = [
  { id: "sales-decline", metric: "sales", direction: "decline", label: "Sales Decline" },
  { id: "sales-increase", metric: "sales", direction: "increase", label: "Sales Increase" },
  { id: "spend-decline", metric: "spend", direction: "decline", label: "Spend Decline" },
  { id: "spend-increase", metric: "spend", direction: "increase", label: "Spend Increase" },
  { id: "orders-decline", metric: "orders", direction: "decline", label: "Orders Decline" },
  { id: "orders-increase", metric: "orders", direction: "increase", label: "Orders Increase" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNonNegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parsePeriod(value: unknown): CampaignComparisonPeriod | null {
  if (!isRecord(value)) return null;
  const startDate = stringValue(value.startDate);
  const endDate = stringValue(value.endDate);
  return isIsoDate(startDate) && isIsoDate(endDate) && startDate <= endDate ? { startDate, endDate } : null;
}

function parseMetrics(value: unknown): CampaignPeriodMetrics | null {
  if (!isRecord(value)) return null;
  const sales = finiteNonNegative(value.sales);
  const spend = finiteNonNegative(value.spend);
  const orders = finiteNonNegative(value.orders);
  if (sales == null || spend == null || orders == null || !Number.isInteger(orders)) return null;
  return { sales, spend, orders };
}

function metricDelta(current: number, previous: number): CampaignMetricDelta {
  return {
    absolute: current - previous,
    percentage: previous === 0 ? null : ((current - previous) / previous) * 100,
  };
}

export function createCampaignComparisonRow(input: Omit<CampaignComparisonRow, "delta">): CampaignComparisonRow {
  return {
    ...input,
    delta: {
      sales: metricDelta(input.current.sales, input.previous.sales),
      spend: metricDelta(input.current.spend, input.previous.spend),
      orders: metricDelta(input.current.orders, input.previous.orders),
    },
  };
}

export function getCampaignMovers(campaigns: CampaignComparisonRow[], category: CampaignMoverCategory) {
  const direction = category.direction === "decline" ? -1 : 1;
  return campaigns
    .filter(campaign => Math.sign(campaign.delta[category.metric].absolute) === direction)
    .toSorted((first, second) => {
      const deltaDifference = Math.abs(second.delta[category.metric].absolute) - Math.abs(first.delta[category.metric].absolute);
      return deltaDifference || first.campaignName.localeCompare(second.campaignName);
    });
}

export function getCampaignMoverTotal(campaigns: CampaignComparisonRow[], category: CampaignMoverCategory) {
  return getCampaignMovers(campaigns, category).reduce((total, campaign) => total + campaign.delta[category.metric].absolute, 0);
}

export function getScaleInsightsCampaignTrendHref(campaign: Pick<CampaignComparisonRow, "campaignId" | "sponsoredType">, startDate: string, endDate: string) {
  const url = new URL("https://portal.scaleinsights.com/PopupWindow/PPCTrendForCampaign");
  url.searchParams.set("from", startDate);
  url.searchParams.set("to", endDate);
  url.searchParams.set("campaignId", campaign.campaignId);
  url.searchParams.set("sponsoredType", String(campaign.sponsoredType));
  return url.toString();
}

export function parseCampaignWeeklyComparison(value: unknown): CampaignWeeklyComparison | null {
  if (!isRecord(value)) return null;
  const asin = stringValue(value.asin).toUpperCase();
  const country = stringValue(value.country).toUpperCase();
  const currency = stringValue(value.currency).toUpperCase();
  const dataState = value.dataState === "Final" || value.dataState === "Partial" ? value.dataState : null;
  const previousPeriod = parsePeriod(value.previousPeriod);
  const currentPeriod = parsePeriod(value.currentPeriod);
  const freshnessValue = isRecord(value.freshness) ? value.freshness : null;
  if (!/^[A-Z0-9]{10}$/.test(asin) || !/^[A-Z]{2}$/.test(country) || !/^[A-Z]{3}$/.test(currency) || !dataState || !previousPeriod || !currentPeriod || !freshnessValue || !Array.isArray(value.campaigns) || !Array.isArray(value.warnings)) return null;

  const campaigns: CampaignComparisonRow[] = [];
  for (const candidate of value.campaigns) {
    if (!isRecord(candidate)) return null;
    const campaignId = stringValue(candidate.campaignId);
    const sponsoredType = finiteNonNegative(candidate.sponsoredType);
    const campaignName = stringValue(candidate.campaignName);
    const previous = parseMetrics(candidate.previous);
    const current = parseMetrics(candidate.current);
    if (!campaignId || sponsoredType == null || !Number.isInteger(sponsoredType) || !campaignName || typeof candidate.previousActive !== "boolean" || typeof candidate.currentActive !== "boolean" || !previous || !current) return null;
    campaigns.push(createCampaignComparisonRow({
      campaignId,
      sponsoredType,
      campaignName,
      previousActive: candidate.previousActive,
      currentActive: candidate.currentActive,
      previous,
      current,
    }));
  }

  const warnings = value.warnings.every(warning => typeof warning === "string") ? value.warnings.map(warning => warning.trim()).filter(Boolean) : null;
  if (!warnings) return null;
  return {
    asin,
    country,
    currency,
    dataState,
    previousPeriod,
    currentPeriod,
    freshness: {
      previousDataAsOf: stringValue(freshnessValue.previousDataAsOf),
      currentDataAsOf: stringValue(freshnessValue.currentDataAsOf),
    },
    campaigns,
    warnings,
  };
}
