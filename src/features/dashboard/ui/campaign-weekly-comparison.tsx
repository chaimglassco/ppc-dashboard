"use client";

import { ArrowDown, ArrowRight, ArrowUp, BarChart3, ChevronDown, ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { withPpcBasePath } from "@/lib/glassco-apps";
import { getPipelineAuthorizationHeader } from "@/lib/pipeline-session";
import {
  CAMPAIGN_MOVER_CATEGORIES,
  getCampaignMovers,
  getScaleInsightsCampaignTrendHref,
  parseCampaignWeeklyComparison,
  type CampaignComparisonMetric,
  type CampaignComparisonRow,
  type CampaignMoverCategory,
  type CampaignWeeklyComparison,
} from "../domain/campaign-weekly-comparison";
import ws from "./ppc-performance-workspace.module.css";
import styles from "./campaign-weekly-comparison.module.css";

type ComparisonLoadState = {
  key: string;
  status: "idle" | "loading" | "authorization" | "ready" | "error";
  message: string;
  comparison?: CampaignWeeklyComparison;
  authorizationUrl?: string;
};

const INITIAL_CAMPAIGN_COUNT = 10;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}T12:00:00.000Z`));
}

function formatPeriod(startDate: string, endDate: string) {
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function currencyFormatter(currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

function signedCurrency(value: number, currency: string) {
  const formatted = currencyFormatter(currency).format(Math.abs(value));
  return value > 0 ? `+${formatted}` : value < 0 ? `−${formatted}` : formatted;
}

function signedNumber(value: number) {
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.abs(value));
  return value > 0 ? `+${formatted}` : value < 0 ? `−${formatted}` : formatted;
}

function signedPercentage(value: number | null, previousActive: boolean) {
  if (value == null) return previousActive ? "—" : "New activity";
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(Math.abs(value));
  return value > 0 ? `+${formatted}%` : value < 0 ? `−${formatted}%` : `${formatted}%`;
}

function metricValue(value: number, metric: CampaignComparisonMetric, currency: string) {
  return metric === "orders"
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)
    : currencyFormatter(currency).format(value);
}

function metricLabel(metric: CampaignComparisonMetric) {
  if (metric === "sales") return "Sales";
  if (metric === "spend") return "Spend";
  return "Orders";
}

function CampaignMetricChange({ campaign, metric, currency, primary }: { campaign: CampaignComparisonRow; metric: CampaignComparisonMetric; currency: string; primary: boolean }) {
  const delta = campaign.delta[metric];
  const tone = metric === "spend" ? styles.deltaNeutral : delta.absolute > 0 ? styles.deltaIncrease : styles.deltaDecline;
  return <td className={primary ? styles.primaryMetric : undefined} data-label={metricLabel(metric)}>
    <span className={styles.metricValues} aria-label={`${metricLabel(metric)} from ${metricValue(campaign.previous[metric], metric, currency)} to ${metricValue(campaign.current[metric], metric, currency)}`}>
      <span>{metricValue(campaign.previous[metric], metric, currency)}</span><ArrowRight aria-hidden="true" /><strong>{metricValue(campaign.current[metric], metric, currency)}</strong>
    </span>
    <span className={`${styles.metricChange} ${tone}`}>
      {delta.absolute > 0 ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}
      <span>{metric === "orders" ? signedNumber(delta.absolute) : signedCurrency(delta.absolute, currency)}</span>
      <small>{signedPercentage(delta.percentage, campaign.previousActive)}</small>
    </span>
  </td>;
}

function CampaignMoverAccordion({ category, comparison, comparisonKey }: { category: CampaignMoverCategory; comparison: CampaignWeeklyComparison; comparisonKey: string }) {
  const [showAll, setShowAll] = useState(false);
  const movers = getCampaignMovers(comparison.campaigns, category);
  const visibleMovers = showAll ? movers : movers.slice(0, INITIAL_CAMPAIGN_COUNT);
  const total = movers.reduce((sum, campaign) => sum + campaign.delta[category.metric].absolute, 0);
  const totalLabel = category.metric === "orders" ? signedNumber(total) : signedCurrency(total, comparison.currency);

  return <details className={styles.moverAccordion} key={`${comparisonKey}:${category.id}`}>
    <summary>
      <span className={`${styles.categoryIcon} ${category.metric === "spend" ? styles.spendIcon : category.direction === "decline" ? styles.declineIcon : styles.increaseIcon}`}>
        {category.direction === "decline" ? <ArrowDown aria-hidden="true" /> : <ArrowUp aria-hidden="true" />}
      </span>
      <strong>{category.label}</strong>
      <span className={styles.categorySummary}>{movers.length} campaign{movers.length === 1 ? "" : "s"}<i aria-hidden="true" />{totalLabel}</span>
      <ChevronDown className={styles.chevron} aria-hidden="true" />
    </summary>
    <div className={styles.accordionContent}>
      {movers.length ? <>
        <div className={styles.tableScroll}>
          <table aria-label={`${category.label} campaign comparison`}>
            <thead><tr><th>Campaign</th><th className={category.metric === "sales" ? styles.primaryMetric : undefined}>Sales</th><th className={category.metric === "spend" ? styles.primaryMetric : undefined}>Spend</th><th className={category.metric === "orders" ? styles.primaryMetric : undefined}>Orders</th></tr></thead>
            <tbody>{visibleMovers.map(campaign => <tr key={`${campaign.sponsoredType}:${campaign.campaignId}`}>
              <th scope="row">
                <a href={getScaleInsightsCampaignTrendHref(campaign, comparison.currentPeriod.startDate, comparison.currentPeriod.endDate)} target="_blank" rel="noopener noreferrer">
                  <span>{campaign.campaignName}</span><ExternalLink aria-hidden="true" />
                </a>
                {!campaign.currentActive ? <small>No current-period activity</small> : !campaign.previousActive ? <small>New activity</small> : null}
              </th>
              <CampaignMetricChange campaign={campaign} metric="sales" currency={comparison.currency} primary={category.metric === "sales"} />
              <CampaignMetricChange campaign={campaign} metric="spend" currency={comparison.currency} primary={category.metric === "spend"} />
              <CampaignMetricChange campaign={campaign} metric="orders" currency={comparison.currency} primary={category.metric === "orders"} />
            </tr>)}</tbody>
          </table>
        </div>
        {movers.length > INITIAL_CAMPAIGN_COUNT ? <button type="button" className={styles.showAllButton} aria-label={showAll ? `Show first 10 ${category.label} campaigns` : `Show all ${movers.length} ${category.label} campaigns`} onClick={() => setShowAll(value => !value)}>{showAll ? "Show first 10" : `Show all ${movers.length}`}</button> : null}
      </> : <p className={styles.emptyCategory}>No campaigns had a {category.label.toLowerCase()} in this matched comparison.</p>}
    </div>
  </details>;
}

export function CampaignWeeklyComparison({ asin, country = "US", weekStart, refreshVersion }: { asin: string; country?: string; weekStart: string; refreshVersion: number }) {
  const comparisonKey = `${country}:${asin.toUpperCase()}:${weekStart}`;
  const cacheRef = useRef(new Map<string, { generation: string; comparison: CampaignWeeklyComparison }>());
  const [retryVersion, setRetryVersion] = useState(0);
  const [loadState, setLoadState] = useState<ComparisonLoadState>({ key: "", status: "idle", message: "" });
  const generation = `${refreshVersion}:${retryVersion}`;

  useEffect(() => {
    if (!asin) return;
    const controller = new AbortController();
    const requestTimer = window.setTimeout(() => {
      const cached = cacheRef.current.get(comparisonKey);
      if (cached && cached.generation === generation) {
        setLoadState({ key: comparisonKey, status: "ready", message: "", comparison: cached.comparison });
        return;
      }
      setLoadState({ key: comparisonKey, status: "loading", message: "Comparing campaign performance…" });
      const query = new URLSearchParams({ asin, country, weekStart });
      void fetch(withPpcBasePath(`/api/dashboard/campaign-comparison?${query}`), {
        headers: getPipelineAuthorizationHeader(), cache: "no-store", signal: controller.signal,
      }).then(async response => {
        const value: unknown = await response.json();
        if (controller.signal.aborted) return;
        if (response.status === 409 && value && typeof value === "object") {
          const candidate = value as { authorizationRequired?: unknown; authorizationUrl?: unknown };
          if (candidate.authorizationRequired === true && typeof candidate.authorizationUrl === "string") {
            const authorizationUrl = new URL(candidate.authorizationUrl);
            if (authorizationUrl.protocol === "https:" && (authorizationUrl.hostname === "vercel.com" || authorizationUrl.hostname.endsWith(".vercel.com"))) {
              setLoadState({ key: comparisonKey, status: "authorization", message: "Connect Scale Insights to compare campaign performance.", authorizationUrl: authorizationUrl.toString() });
              return;
            }
          }
        }
        if (!response.ok || !value || typeof value !== "object") {
          const message = value && typeof value === "object" && typeof (value as { error?: unknown }).error === "string"
            ? String((value as { error: string }).error)
            : "Campaign comparison is unavailable.";
          throw new Error(message);
        }
        const comparison = parseCampaignWeeklyComparison((value as { comparison?: unknown }).comparison);
        if (!comparison || comparison.asin !== asin.toUpperCase() || comparison.country !== country || comparison.currentPeriod.startDate !== weekStart) {
          throw new Error("Scale Insights returned an invalid campaign comparison.");
        }
        cacheRef.current.set(comparisonKey, { generation, comparison });
        setLoadState({ key: comparisonKey, status: "ready", message: "", comparison });
      }).catch(error => {
        if (controller.signal.aborted || (error as Error).name === "AbortError") return;
        setLoadState({ key: comparisonKey, status: "error", message: error instanceof Error ? error.message : "Campaign comparison is unavailable." });
      });
    }, 0);
    return () => { window.clearTimeout(requestTimer); controller.abort(); };
  }, [asin, comparisonKey, country, generation, weekStart]);

  const displayedState = !asin
    ? { key: comparisonKey, status: "idle" as const, message: "Add an ASIN to compare campaign performance." }
    : loadState.key === comparisonKey
      ? loadState
      : { key: comparisonKey, status: "loading" as const, message: "Comparing campaign performance…" };
  const comparison = displayedState.comparison;
  return <section className={`${ws.card} ${styles.comparisonCard}`} aria-labelledby="campaign-comparison-heading">
    <header className={styles.comparisonHeader}>
      <div><h3 id="campaign-comparison-heading"><BarChart3 aria-hidden="true" />Campaign Week-over-Week Comparison</h3><p>See which campaigns moved PPC sales, spend, and orders between matched reporting periods.</p></div>
      {comparison ? <span className={comparison.dataState === "Partial" ? styles.partialBadge : styles.finalBadge}>{comparison.dataState}</span> : null}
    </header>

    {displayedState.status === "loading" ? <div className={styles.stateMessage} role="status"><RefreshCw className={styles.loadingIcon} aria-hidden="true" /><span>{displayedState.message}</span></div> : null}
    {displayedState.status === "idle" ? <div className={styles.stateMessage}><span>{displayedState.message}</span></div> : null}
    {displayedState.status === "authorization" ? <div className={styles.stateMessage}><span>{displayedState.message}</span><a href={displayedState.authorizationUrl}>Connect Scale Insights</a></div> : null}
    {displayedState.status === "error" ? <div className={`${styles.stateMessage} ${styles.errorState}`} role="alert"><span>{displayedState.message}</span><button type="button" onClick={() => setRetryVersion(value => value + 1)}><RefreshCw aria-hidden="true" />Retry</button></div> : null}

    {comparison ? <>
      <div className={styles.periodComparison} aria-label="Compared reporting periods">
        <span><small>Previous</small><strong>{formatPeriod(comparison.previousPeriod.startDate, comparison.previousPeriod.endDate)}</strong></span>
        <ArrowRight aria-hidden="true" />
        <span><small>Selected</small><strong>{formatPeriod(comparison.currentPeriod.startDate, comparison.currentPeriod.endDate)}</strong></span>
        {comparison.freshness.currentDataAsOf ? <small>Data as of {comparison.freshness.currentDataAsOf}</small> : null}
      </div>
      {comparison.warnings.length ? <ul className={styles.warnings}>{comparison.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : null}
      <div className={styles.accordionList}>{CAMPAIGN_MOVER_CATEGORIES.map(category => <CampaignMoverAccordion key={`${comparisonKey}:${category.id}`} category={category} comparison={comparison} comparisonKey={comparisonKey} />)}</div>
    </> : null}
  </section>;
}
