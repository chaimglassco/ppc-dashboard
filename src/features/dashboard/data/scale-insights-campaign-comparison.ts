import {
  createCampaignComparisonRow,
  type CampaignSpendBaseline,
  type CampaignPeriodMetrics,
  type CampaignWeeklyComparison,
} from "../domain/campaign-weekly-comparison";
import {
  ScaleInsightsDataError,
  unwrapScaleInsightsPayload,
  type ScaleInsightsToolCaller,
} from "./scale-insights-performance";

export type ScaleInsightsCampaignComparisonParams = {
  asin: string;
  country: string;
  previousStartDate: string;
  previousEndDate: string;
  currentStartDate: string;
  currentEndDate: string;
  dataState: "Final" | "Partial";
};

type ToolProperty = Record<string, unknown>;

export type ScaleInsightsCampaignToolCapabilities = {
  grouping?: { key: string; value: string };
  limitKey?: string;
  offsetKey?: string;
  pageKey?: string;
  cursorKey?: string;
};

type ProviderCampaign = {
  campaignId: string;
  sponsoredType: number;
  campaignName: string;
  metrics: CampaignPeriodMetrics;
};

type CampaignMetricSelection = "all" | "spend";

type ProviderPage = {
  campaigns: ProviderCampaign[];
  currency: string;
  dataAsOf: string;
  totalCount: number | null;
  nextCursor: string;
};

type ProviderPeriod = {
  campaigns: Map<string, ProviderCampaign>;
  currency: string;
  dataAsOf: string;
  warnings: string[];
};

const PAGE_SIZE = 500;
const MAX_CAMPAIGNS = 5_000;
const MAX_PAGES = 20;
const CAMPAIGN_ID_KEYS = [
  "campaign_id", "campaignId", "CampaignId", "CampaignID", "amazon_campaign_id", "amazonCampaignId", "AmazonCampaignId",
  "entity_id", "entityId", "EntityId", "reference_id", "referenceId", "ReferenceId", "id", "Id", "ID",
];
const CAMPAIGN_NAME_KEYS = [
  "campaign_name", "campaignName", "CampaignName", "campaign", "Campaign", "entity_name", "entityName", "EntityName",
  "reference_name", "referenceName", "ReferenceName", "name", "Name", "title", "Title",
];
const SPONSORED_TYPE_KEYS = [
  "sponsored_type", "sponsoredType", "SponsoredType", "sponsored_ads_type", "sponsoredAdsType", "SponsoredAdsType",
  "sponsored_ad_type", "sponsoredAdType", "SponsoredAdType", "campaign_type", "campaignType", "CampaignType",
  "ad_type", "adType", "AdType", "ad_type_name", "adTypeName", "AdTypeName",
];
const SALES_KEYS = [
  "total_sales", "sales", "PPCSales", "ppc_sales", "PpcSales", "ppcSales", "advertising_sales", "advertisingSales",
  "attributed_sales", "attributedSales", "Sales",
];
const SPEND_KEYS = [
  "total_spend", "spend", "PPCSpend", "ppc_spend", "ppcSpend", "PPCCost", "ppc_cost", "PpcCost", "ppcCost",
  "ad_spend", "adSpend", "advertising_cost", "advertisingCost", "cost", "Cost", "Spend",
];
const ORDERS_KEYS = [
  "total_orders", "orders", "PPCOrders", "ppc_orders", "PpcOrders", "ppcOrders", "order_count", "orderCount",
  "attributed_orders", "attributedOrders", "Orders",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numericValue(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  const normalized = value.trim().replace(/[,$£€¥]/g, "");
  return /^\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

function finiteNonNegative(value: unknown, field: string) {
  const number = numericValue(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new ScaleInsightsDataError("invalid_response", `Scale Insights returned an invalid campaign ${field}.`);
  }
  return number;
}

function integerValue(value: unknown, field: string) {
  const number = finiteNonNegative(value, field);
  if (!Number.isInteger(number)) throw new ScaleInsightsDataError("invalid_response", `Scale Insights returned a non-integer campaign ${field}.`);
  return number;
}

function normalizedKey(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function directRecordValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && !isRecord(record[key]) && !Array.isArray(record[key])) return record[key];
  }
  const normalizedKeys = new Set(keys.map(normalizedKey));
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined && value !== null && !isRecord(value) && !Array.isArray(value) && normalizedKeys.has(normalizedKey(key))) return value;
  }
  return undefined;
}

function recordValue(record: Record<string, unknown>, keys: string[], depth = 2): unknown {
  const direct = directRecordValue(record, keys);
  if (direct !== undefined && direct !== null) return direct;
  if (depth <= 0) return undefined;
  for (const value of Object.values(record)) {
    if (!isRecord(value)) continue;
    const nested = recordValue(value, keys, depth - 1);
    if (nested !== undefined && nested !== null) return nested;
  }
  return undefined;
}

function campaignIdValue(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  const text = stringValue(value);
  return /^[A-Za-z0-9_-]+$/.test(text) ? text : "";
}

function sponsoredTypeValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 9) return value;
  const text = stringValue(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^\d$/.test(text)) return Number(text);
  if (text === "SP" || text.includes("SPONSOREDPRODUCT")) return 0;
  if (text === "SB" || text.includes("SPONSOREDBRAND") || text.includes("HEADLINE")) return 1;
  if (text === "SD" || text.includes("SPONSOREDDISPLAY")) return 2;
  return null;
}

function campaignFromRecord(record: Record<string, unknown>, metricSelection: CampaignMetricSelection): ProviderCampaign | null {
  const campaignId = campaignIdValue(recordValue(record, CAMPAIGN_ID_KEYS));
  const campaignName = stringValue(recordValue(record, CAMPAIGN_NAME_KEYS));
  const sponsoredType = sponsoredTypeValue(recordValue(record, SPONSORED_TYPE_KEYS))
    ?? sponsoredTypeValue(recordValue(record, ["type", "Type"]));
  if (!campaignName || (metricSelection === "all" && (!campaignId || sponsoredType == null))) return null;

  const rawSales = recordValue(record, SALES_KEYS);
  const rawSpend = recordValue(record, SPEND_KEYS);
  const rawOrders = recordValue(record, ORDERS_KEYS);
  if (rawSpend == null || (metricSelection === "all" && (rawSales == null || rawOrders == null))) return null;
  const sales = rawSales == null ? 0 : finiteNonNegative(rawSales, "Sales");
  const spend = finiteNonNegative(rawSpend, "Spend");
  const orders = rawOrders == null ? 0 : integerValue(rawOrders, "Orders");
  return { campaignId, campaignName, sponsoredType: sponsoredType ?? -1, metrics: { sales, spend, orders } };
}

function collectCampaignRows(value: unknown, metricSelection: CampaignMetricSelection, depth = 0): ProviderCampaign[] {
  if (depth > 5) return [];
  if (typeof value === "string" && /^[\[{]/.test(value.trim())) {
    try {
      return collectCampaignRows(JSON.parse(value), metricSelection, depth + 1);
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) {
    return value.flatMap(candidate => {
      if (!isRecord(candidate)) return [];
      const campaign = campaignFromRecord(candidate, metricSelection);
      return campaign ? [campaign] : collectCampaignRows(candidate, metricSelection, depth + 1);
    });
  }
  if (!isRecord(value)) return [];
  return Object.values(value).flatMap(candidate => collectCampaignRows(candidate, metricSelection, depth + 1));
}

function parseTextRows(value: string, metricSelection: CampaignMetricSelection) {
  const text = value.trim();
  if (!text) return [];
  const jsonCandidates = [text, ...[...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map(match => match[1].trim())];
  for (const candidate of jsonCandidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      const campaigns = collectCampaignRows(parsed, metricSelection);
      if (campaigns.length) return campaigns;
    } catch {
      continue;
    }
  }

  // Scale Insights can place a display table in MCP text content while keeping totals in structuredContent.
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.includes("|"));
  for (let index = 0; index < lines.length - 2; index += 1) {
    const headers = lines[index].replace(/^\||\|$/g, "").split("|").map(value => value.trim());
    const separator = lines[index + 1].replace(/^\||\|$/g, "").split("|").map(value => value.trim());
    if (headers.length < 4 || separator.length !== headers.length || !separator.every(value => /^:?-{3,}:?$/.test(value))) continue;
    const records: Record<string, unknown>[] = [];
    for (const line of lines.slice(index + 2)) {
      const cells = line.replace(/^\||\|$/g, "").split("|").map(value => value.trim());
      if (cells.length !== headers.length) break;
      records.push(Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex]])));
    }
    const campaigns = records.flatMap(record => {
      const campaign = campaignFromRecord(record, metricSelection);
      return campaign ? [campaign] : [];
    });
    if (campaigns.length) return campaigns;
  }
  return [];
}

function collectMcpContentRows(result: unknown, metricSelection: CampaignMetricSelection) {
  if (!isRecord(result) || !Array.isArray(result.content)) return [];
  return result.content.flatMap(block => isRecord(block) && block.type === "text" && typeof block.text === "string" ? parseTextRows(block.text, metricSelection) : []);
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function providerScope(payload: Record<string, unknown>) {
  return isRecord(payload.agg) ? payload.agg : payload;
}

function assertScope(payload: Record<string, unknown>, country: string, startDate: string, endDate: string) {
  const scope = providerScope(payload);
  const returnedCountry = stringValue(scope.Country ?? scope.country ?? payload.Country ?? payload.country).toUpperCase();
  const returnedStart = stringValue(scope.StartDate ?? scope.start_date ?? scope.startDate ?? payload.StartDate ?? payload.start_date);
  const returnedEnd = stringValue(scope.EndDate ?? scope.end_date ?? scope.endDate ?? payload.EndDate ?? payload.end_date);
  if (returnedCountry !== country || returnedStart !== startDate || returnedEnd !== endDate) {
    throw new ScaleInsightsDataError("invalid_response", "Scale Insights returned campaign data for a different marketplace or date range.");
  }
}

function parseProviderPage(result: unknown, country: string, startDate: string, endDate: string, metricSelection: CampaignMetricSelection): ProviderPage {
  const payload = unwrapScaleInsightsPayload(result);
  assertScope(payload, country, startDate, endDate);
  const scope = providerScope(payload);
  const metadata = isRecord(payload.oppMeta) ? payload.oppMeta : isRecord(payload.meta) ? payload.meta : isRecord(payload.Meta) ? payload.Meta : {};
  const campaigns = collectCampaignRows(payload, metricSelection);
  if (!campaigns.length) campaigns.push(...collectMcpContentRows(result, metricSelection));
  const totalCount = numberOrNull(metadata.total_count ?? metadata.totalCount ?? metadata.TotalCount);
  if (totalCount != null && totalCount > 0 && campaigns.length === 0) {
    throw new ScaleInsightsDataError("invalid_response", "Scale Insights returned campaign results without readable campaign rows.");
  }
  return {
    campaigns,
    currency: stringValue(scope.Currency ?? scope.currency ?? payload.Currency ?? payload.currency) || "USD",
    dataAsOf: stringValue(metadata.data_as_of ?? metadata.dataAsOf ?? metadata.DataAsOf),
    totalCount,
    nextCursor: stringValue(metadata.next_cursor ?? metadata.nextCursor ?? payload.next_cursor ?? payload.nextCursor),
  };
}

function enumStrings(property: ToolProperty) {
  const direct = Array.isArray(property.enum) ? property.enum.filter((value): value is string => typeof value === "string") : [];
  const variants = [...(Array.isArray(property.oneOf) ? property.oneOf : []), ...(Array.isArray(property.anyOf) ? property.anyOf : [])];
  const directConst = typeof property.const === "string" ? [property.const] : [];
  return [...direct, ...directConst, ...variants.flatMap(value => {
    if (!isRecord(value)) return [];
    const enumValues = Array.isArray(value.enum) ? value.enum.filter((item): item is string => typeof item === "string") : [];
    return typeof value.const === "string" ? [...enumValues, value.const] : enumValues;
  })];
}

export function getScaleInsightsCampaignToolCapabilities(inputSchema: unknown): ScaleInsightsCampaignToolCapabilities {
  const properties = isRecord(inputSchema) && isRecord(inputSchema.properties) ? inputSchema.properties : {};
  const propertyNames = new Set(Object.keys(properties));
  const groupingKey = [
    "dimension", "entity_type", "entityType", "level", "group_by", "groupBy", "breakdown", "grouping", "view",
    "view_by", "viewBy", "report_type", "reportType", "report_scope", "reportScope", "report_level", "reportLevel",
    "aggregate_by", "aggregateBy", "aggregation", "aggregation_level", "aggregationLevel", "breakdown_by", "breakdownBy",
    "entity", "entity_level", "entityLevel", "granularity", "scope",
  ].find(key => propertyNames.has(key)) ?? Object.entries(properties).find(([, property]) => {
    if (!isRecord(property)) return false;
    return enumStrings(property).some(candidate => ["campaign", "campaigns"].includes(candidate.toLowerCase()));
  })?.[0];
  let grouping: ScaleInsightsCampaignToolCapabilities["grouping"];
  if (groupingKey) {
    const property = isRecord(properties[groupingKey]) ? properties[groupingKey] : {};
    const value = enumStrings(property).find(candidate => candidate.toLowerCase() === "campaign" || candidate.toLowerCase() === "campaigns") || "campaign";
    grouping = { key: groupingKey, value };
  }
  const findProperty = (keys: string[]) => keys.find(key => propertyNames.has(key));
  return {
    ...(grouping ? { grouping } : {}),
    limitKey: findProperty(["limit", "page_size", "pageSize"]),
    offsetKey: findProperty(["offset"]),
    pageKey: findProperty(["page", "page_number", "pageNumber"]),
    cursorKey: findProperty(["cursor"]),
  };
}

function campaignKey(campaign: Pick<ProviderCampaign, "campaignId" | "sponsoredType" | "campaignName">) {
  return campaign.campaignId
    ? `${campaign.sponsoredType}:${campaign.campaignId}`
    : `${campaign.sponsoredType}:name:${campaign.campaignName.toLocaleLowerCase()}`;
}

function mergeProviderCampaign(target: Map<string, ProviderCampaign>, campaign: ProviderCampaign) {
  const key = campaignKey(campaign);
  const existing = target.get(key);
  if (!existing) {
    target.set(key, campaign);
    return;
  }
  target.set(key, {
    ...campaign,
    metrics: {
      sales: existing.metrics.sales + campaign.metrics.sales,
      spend: existing.metrics.spend + campaign.metrics.spend,
      orders: existing.metrics.orders + campaign.metrics.orders,
    },
  });
}

async function loadProviderPeriod(
  asin: string,
  country: string,
  startDate: string,
  endDate: string,
  callTool: ScaleInsightsToolCaller,
  capabilities: ScaleInsightsCampaignToolCapabilities,
  metricSelection: CampaignMetricSelection = "all",
): Promise<ProviderPeriod> {
  const campaigns = new Map<string, ProviderCampaign>();
  const warnings: string[] = [];
  let currency = "USD";
  let dataAsOf = "";
  let cursor = "";
  let offset = 0;
  let pageNumber = 1;
  let totalCount: number | null = null;

  for (let pageIndex = 0; pageIndex < MAX_PAGES && campaigns.size < MAX_CAMPAIGNS; pageIndex += 1) {
    const args: Record<string, unknown> = {
      asin_list: [asin],
      country,
      start_date: startDate,
      end_date: endDate,
      mode: "raw",
      summary_only: false,
    };
    if (capabilities.grouping) args[capabilities.grouping.key] = capabilities.grouping.value;
    if (capabilities.limitKey) args[capabilities.limitKey] = PAGE_SIZE;
    if (capabilities.offsetKey) args[capabilities.offsetKey] = offset;
    if (capabilities.pageKey) args[capabilities.pageKey] = pageNumber;
    if (capabilities.cursorKey && cursor) args[capabilities.cursorKey] = cursor;

    const providerPage = parseProviderPage(await callTool("get_ads_performance", args), country, startDate, endDate, metricSelection);
    currency = providerPage.currency || currency;
    dataAsOf = providerPage.dataAsOf || dataAsOf;
    totalCount = providerPage.totalCount ?? totalCount;
    providerPage.campaigns.forEach(campaign => mergeProviderCampaign(campaigns, campaign));

    if (totalCount == null || campaigns.size >= totalCount) break;
    const canContinueWithCursor = Boolean(capabilities.cursorKey && providerPage.nextCursor && providerPage.nextCursor !== cursor);
    const canContinueWithOffset = Boolean(capabilities.offsetKey && providerPage.campaigns.length);
    const canContinueWithPage = Boolean(capabilities.pageKey && providerPage.campaigns.length);
    if (!canContinueWithCursor && !canContinueWithOffset && !canContinueWithPage) {
      warnings.push(`Scale Insights returned ${campaigns.size} of ${totalCount} campaigns for ${startDate} through ${endDate}.`);
      break;
    }
    cursor = providerPage.nextCursor;
    offset += providerPage.campaigns.length;
    pageNumber += 1;
  }

  if (totalCount != null && campaigns.size < totalCount && !warnings.length) {
    warnings.push(`Campaign comparison was limited to ${campaigns.size} of ${totalCount} campaigns for ${startDate} through ${endDate}.`);
  }
  return { campaigns, currency, dataAsOf, warnings };
}

const EMPTY_METRICS: CampaignPeriodMetrics = { sales: 0, spend: 0, orders: 0 };

export async function loadScaleInsightsCampaignComparison(
  params: ScaleInsightsCampaignComparisonParams,
  callTool: ScaleInsightsToolCaller,
  capabilities: ScaleInsightsCampaignToolCapabilities = {},
): Promise<CampaignWeeklyComparison> {
  const [previous, current] = await Promise.all([
    loadProviderPeriod(params.asin, params.country, params.previousStartDate, params.previousEndDate, callTool, capabilities),
    loadProviderPeriod(params.asin, params.country, params.currentStartDate, params.currentEndDate, callTool, capabilities),
  ]);
  const keys = new Set([...previous.campaigns.keys(), ...current.campaigns.keys()]);
  const campaigns = [...keys].map(key => {
    const previousCampaign = previous.campaigns.get(key);
    const currentCampaign = current.campaigns.get(key);
    const identity = currentCampaign ?? previousCampaign;
    if (!identity) throw new ScaleInsightsDataError("invalid_response", "Scale Insights returned an unreadable campaign identity.");
    return createCampaignComparisonRow({
      campaignId: identity.campaignId,
      sponsoredType: identity.sponsoredType,
      campaignName: currentCampaign?.campaignName || previousCampaign?.campaignName || "Unnamed campaign",
      previousActive: Boolean(previousCampaign),
      currentActive: Boolean(currentCampaign),
      previous: previousCampaign?.metrics ?? EMPTY_METRICS,
      current: currentCampaign?.metrics ?? EMPTY_METRICS,
    });
  }).toSorted((first, second) => first.campaignName.localeCompare(second.campaignName));

  const warnings = [...previous.warnings, ...current.warnings];
  if (previous.currency !== current.currency) warnings.push("Scale Insights returned different currencies for the compared periods.");
  return {
    asin: params.asin,
    country: params.country,
    currency: current.currency || previous.currency || "USD",
    dataState: params.dataState,
    previousPeriod: { startDate: params.previousStartDate, endDate: params.previousEndDate },
    currentPeriod: { startDate: params.currentStartDate, endDate: params.currentEndDate },
    freshness: { previousDataAsOf: previous.dataAsOf, currentDataAsOf: current.dataAsOf },
    campaigns,
    warnings,
  };
}

export async function loadScaleInsightsCampaignSpendBaseline(
  params: ScaleInsightsCampaignComparisonParams,
  callTool: ScaleInsightsToolCaller,
  capabilities: ScaleInsightsCampaignToolCapabilities = {},
): Promise<CampaignSpendBaseline> {
  const previous = await loadProviderPeriod(
    params.asin,
    params.country,
    params.previousStartDate,
    params.previousEndDate,
    callTool,
    capabilities,
    "spend",
  );
  return {
    asin: params.asin,
    country: params.country,
    currency: previous.currency || "USD",
    dataState: params.dataState,
    previousPeriod: { startDate: params.previousStartDate, endDate: params.previousEndDate },
    currentPeriod: { startDate: params.currentStartDate, endDate: params.currentEndDate },
    freshness: { previousDataAsOf: previous.dataAsOf },
    campaigns: [...previous.campaigns.values()]
      .map(campaign => ({
        campaignId: campaign.campaignId || null,
        sponsoredType: campaign.sponsoredType >= 0 ? campaign.sponsoredType : null,
        campaignName: campaign.campaignName,
        previousSpend: campaign.metrics.spend,
      }))
      .toSorted((first, second) => second.previousSpend - first.previousSpend || first.campaignName.localeCompare(second.campaignName)),
    warnings: previous.warnings,
  };
}
