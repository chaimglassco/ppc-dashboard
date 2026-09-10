"use client";

import { ArrowRight, BarChart3, ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { withPpcBasePath } from "@/lib/glassco-apps";
import { getPipelineAuthorizationHeader } from "@/lib/pipeline-session";
import { getScaleInsightsCampaignTrendHref, parseCampaignSpendBaseline, type CampaignSpendBaseline } from "../domain/campaign-weekly-comparison";
import ws from "./ppc-performance-workspace.module.css";
import styles from "./campaign-weekly-comparison.module.css";

type BaselineLoadState = {
  key: string;
  status: "idle" | "loading" | "authorization" | "ready" | "error";
  message: string;
  baseline?: CampaignSpendBaseline;
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

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  } catch {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }
}

export function CampaignWeeklyComparison({ asin, country = "US", weekStart, refreshVersion }: { asin: string; country?: string; weekStart: string; refreshVersion: number }) {
  const comparisonKey = `${country}:${asin.toUpperCase()}:${weekStart}`;
  const cacheRef = useRef(new Map<string, { generation: string; baseline: CampaignSpendBaseline }>());
  const [retryVersion, setRetryVersion] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [loadState, setLoadState] = useState<BaselineLoadState>({ key: "", status: "idle", message: "" });
  const generation = `${refreshVersion}:${retryVersion}`;

  useEffect(() => {
    if (!asin) return;
    const controller = new AbortController();
    const requestTimer = window.setTimeout(() => {
      const cached = cacheRef.current.get(comparisonKey);
      if (cached && cached.generation === generation) {
        setLoadState({ key: comparisonKey, status: "ready", message: "", baseline: cached.baseline });
        return;
      }
      setShowAll(false);
      setLoadState({ key: comparisonKey, status: "loading", message: "Loading previous-week campaign Spend…" });
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
              setLoadState({ key: comparisonKey, status: "authorization", message: "Connect Scale Insights to load previous-week campaign Spend.", authorizationUrl: authorizationUrl.toString() });
              return;
            }
          }
        }
        if (!response.ok || !value || typeof value !== "object") {
          const message = value && typeof value === "object" && typeof (value as { error?: unknown }).error === "string"
            ? String((value as { error: string }).error)
            : "Previous-week campaign Spend is unavailable.";
          throw new Error(message);
        }
        const baseline = parseCampaignSpendBaseline((value as { comparison?: unknown }).comparison);
        if (!baseline || baseline.asin !== asin.toUpperCase() || baseline.country !== country || baseline.currentPeriod.startDate !== weekStart) {
          throw new Error("Scale Insights returned an invalid campaign Spend baseline.");
        }
        cacheRef.current.set(comparisonKey, { generation, baseline });
        setLoadState({ key: comparisonKey, status: "ready", message: "", baseline });
      }).catch(error => {
        if (controller.signal.aborted || (error as Error).name === "AbortError") return;
        setLoadState({ key: comparisonKey, status: "error", message: error instanceof Error ? error.message : "Previous-week campaign Spend is unavailable." });
      });
    }, 0);
    return () => { window.clearTimeout(requestTimer); controller.abort(); };
  }, [asin, comparisonKey, country, generation, weekStart]);

  const displayedState = !asin
    ? { key: comparisonKey, status: "idle" as const, message: "Add an ASIN to load campaign Spend." }
    : loadState.key === comparisonKey
      ? loadState
      : { key: comparisonKey, status: "loading" as const, message: "Loading previous-week campaign Spend…" };
  const baseline = displayedState.baseline;
  const visibleCampaigns = baseline ? (showAll ? baseline.campaigns : baseline.campaigns.slice(0, INITIAL_CAMPAIGN_COUNT)) : [];
  const previousTotal = baseline?.campaigns.reduce((total, campaign) => total + campaign.previousSpend, 0) ?? 0;

  return <section className={`${ws.card} ${styles.comparisonCard}`} aria-labelledby="campaign-comparison-heading">
    <header className={styles.comparisonHeader}>
      <div><h3 id="campaign-comparison-heading"><BarChart3 aria-hidden="true" />Campaign Week-over-Week Comparison</h3><p>Stage 1: previous-week campaign Spend. Current-week Spend will be connected next.</p></div>
      {baseline ? <span className={styles.finalBadge}>Spend baseline</span> : null}
    </header>

    {displayedState.status === "loading" ? <div className={styles.stateMessage} role="status"><RefreshCw className={styles.loadingIcon} aria-hidden="true" /><span>{displayedState.message}</span></div> : null}
    {displayedState.status === "idle" ? <div className={styles.stateMessage}><span>{displayedState.message}</span></div> : null}
    {displayedState.status === "authorization" ? <div className={styles.stateMessage}><span>{displayedState.message}</span><a href={displayedState.authorizationUrl}>Connect Scale Insights</a></div> : null}
    {displayedState.status === "error" ? <div className={`${styles.stateMessage} ${styles.errorState}`} role="alert"><span>{displayedState.message}</span><button type="button" onClick={() => setRetryVersion(value => value + 1)}><RefreshCw aria-hidden="true" />Retry</button></div> : null}

    {baseline ? <>
      <div className={styles.periodComparison} aria-label="Campaign Spend reporting periods">
        <span><small>Previous week</small><strong>{formatPeriod(baseline.previousPeriod.startDate, baseline.previousPeriod.endDate)}</strong></span>
        <ArrowRight aria-hidden="true" />
        <span><small>Current week</small><strong>{formatPeriod(baseline.currentPeriod.startDate, baseline.currentPeriod.endDate)}</strong></span>
        {baseline.freshness.previousDataAsOf ? <small>Previous data as of {baseline.freshness.previousDataAsOf}</small> : null}
      </div>
      {baseline.warnings.length ? <ul className={styles.warnings}>{baseline.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : null}
      {baseline.campaigns.length ? <div className={styles.baselineTable}>
        <div className={styles.baselineSummary}><strong>{baseline.campaigns.length} campaign{baseline.campaigns.length === 1 ? "" : "s"}</strong><span>Previous Spend: {formatCurrency(previousTotal, baseline.currency)}</span></div>
        <div className={styles.tableScroll}>
          <table aria-label="Previous and current week campaign Spend">
            <thead><tr><th>Campaign</th><th>Previous Week Spend</th><th>Current Week Spend</th></tr></thead>
            <tbody>{visibleCampaigns.map(campaign => <tr key={`${campaign.sponsoredType ?? "unknown"}:${campaign.campaignId ?? campaign.campaignName}`}>
              <th scope="row">{campaign.campaignId && campaign.sponsoredType != null
                ? <a href={getScaleInsightsCampaignTrendHref({ campaignId: campaign.campaignId, sponsoredType: campaign.sponsoredType }, baseline.previousPeriod.startDate, baseline.previousPeriod.endDate)} target="_blank" rel="noopener noreferrer"><span>{campaign.campaignName}</span><ExternalLink aria-hidden="true" /></a>
                : <span className={styles.campaignName}>{campaign.campaignName}</span>}</th>
              <td data-label="Previous Week Spend"><strong>{formatCurrency(campaign.previousSpend, baseline.currency)}</strong></td>
              <td data-label="Current Week Spend"><span className={styles.pendingValue} aria-label="Current week Spend pending">—</span></td>
            </tr>)}</tbody>
          </table>
        </div>
        {baseline.campaigns.length > INITIAL_CAMPAIGN_COUNT ? <button type="button" className={styles.showAllButton} aria-label={showAll ? "Show first 10 campaigns" : `Show all ${baseline.campaigns.length} campaigns`} onClick={() => setShowAll(value => !value)}>{showAll ? "Show first 10" : `Show all ${baseline.campaigns.length}`}</button> : null}
      </div> : <p className={styles.emptyCategory}>No previous-week campaigns with Spend were returned for this ASIN.</p>}
    </> : null}
  </section>;
}
