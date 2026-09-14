"use client";

import { ExternalLink, Target, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { withPpcBasePath } from "@/lib/glassco-apps";
import { getPipelineAuthorizationHeader } from "@/lib/pipeline-session";
import {
  parseUntargetedOpportunityCache,
  parseUntargetedSalesOpportunities,
  PPC_UNTARGETED_OPPORTUNITIES_CACHE_KEY,
  untargetedOpportunityCacheKey,
  withUntargetedOpportunityCacheEntry,
  type UntargetedOpportunityCache,
  type UntargetedOpportunityType,
  type UntargetedSalesOpportunities,
} from "../domain/untargeted-sales-opportunities";
import ws from "./ppc-performance-workspace.module.css";
import styles from "./campaign-weekly-comparison.module.css";

type LoadState = {
  key: string;
  status: "idle" | "loading" | "authorization" | "ready" | "unsupported" | "error";
  message: string;
  report?: UntargetedSalesOpportunities;
  authorizationUrl?: string;
  requestId?: string;
};

const INITIAL_ROW_COUNT = 10;

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  } catch {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00.000Z`));
}

function numericFilter(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function UntargetedSalesOpportunities({ asin, country = "US", weekStart, refreshVersion }: { asin: string; country?: string; weekStart: string; refreshVersion: number }) {
  const reportKey = untargetedOpportunityCacheKey(country, asin, weekStart);
  const cacheRef = useRef<UntargetedOpportunityCache | null>(null);
  if (cacheRef.current === null) {
    cacheRef.current = typeof window === "undefined"
      ? {}
      : parseUntargetedOpportunityCache(window.localStorage.getItem(PPC_UNTARGETED_OPPORTUNITIES_CACHE_KEY));
  }
  const handledRefreshes = useRef(new Map<string, number>());
  const [showAll, setShowAll] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"All" | UntargetedOpportunityType>("All");
  const [minimumSales, setMinimumSales] = useState("");
  const [maximumAcos, setMaximumAcos] = useState("");
  const [loadState, setLoadState] = useState<LoadState>({ key: "", status: "idle", message: "" });

  useEffect(() => {
    if (!asin) return;
    const controller = new AbortController();
    const cached = (cacheRef.current ?? {})[reportKey];
    const handledRefresh = handledRefreshes.current.get(reportKey) ?? 0;
    if (refreshVersion <= handledRefresh) {
      setLoadState(cached
        ? { key: reportKey, status: "ready", message: "", report: cached }
        : { key: reportKey, status: "idle", message: "This report loads with Refresh Data and reuses the latest saved result for this product and week." });
      return () => controller.abort();
    }
    handledRefreshes.current.set(reportKey, refreshVersion);
    setShowAll(false);
    setLoadState({ key: reportKey, status: "loading", message: "Checking converting PPC search terms against exact-target coverage…", report: cached });
    const query = new URLSearchParams({ asin, country, weekStart });
    void fetch(withPpcBasePath(`/api/dashboard/untargeted-opportunities?${query}`), {
      headers: getPipelineAuthorizationHeader(), cache: "no-store", signal: controller.signal,
    }).then(async response => {
      const value: unknown = await response.json();
      if (controller.signal.aborted) return;
      if (response.status === 409 && value && typeof value === "object") {
        const candidate = value as { authorizationRequired?: unknown; authorizationUrl?: unknown };
        if (candidate.authorizationRequired === true && typeof candidate.authorizationUrl === "string") {
          const authorizationUrl = new URL(candidate.authorizationUrl);
          if (authorizationUrl.protocol === "https:" && (authorizationUrl.hostname === "vercel.com" || authorizationUrl.hostname.endsWith(".vercel.com"))) {
            setLoadState({ key: reportKey, status: "authorization", message: "Connect Scale Insights to find untargeted sales opportunities.", authorizationUrl: authorizationUrl.toString(), report: cached });
            return;
          }
        }
      }
      if (!response.ok || !value || typeof value !== "object") {
        const candidate = value && typeof value === "object" ? value as { error?: unknown; code?: unknown; requestId?: unknown } : {};
        if (candidate.code === "opportunity_capability_missing") {
          setLoadState({ key: reportKey, status: "unsupported", message: "The connected Scale Insights account does not expose both PPC search-term and exact-coverage reporting.", requestId: typeof candidate.requestId === "string" ? candidate.requestId : undefined, report: cached });
          return;
        }
        const error = new Error(typeof candidate.error === "string" ? candidate.error : "Untargeted sales opportunities are temporarily unavailable.") as Error & { requestId?: string };
        if (typeof candidate.requestId === "string") error.requestId = candidate.requestId;
        throw error;
      }
      const report = parseUntargetedSalesOpportunities((value as { opportunities?: unknown }).opportunities);
      if (!report || report.asin !== asin.toUpperCase() || report.country !== country || report.period.startDate !== weekStart) throw new Error("Scale Insights returned invalid opportunity data.");
      cacheRef.current = withUntargetedOpportunityCacheEntry(cacheRef.current ?? {}, report);
      try {
        window.localStorage.setItem(PPC_UNTARGETED_OPPORTUNITIES_CACHE_KEY, JSON.stringify({ version: 1, entries: cacheRef.current }));
      } catch {
        // Keep the validated result in memory when browser storage is unavailable.
      }
      setLoadState({ key: reportKey, status: "ready", message: "", report });
    }).catch(error => {
      if (controller.signal.aborted || (error as Error).name === "AbortError") return;
      setLoadState({ key: reportKey, status: "error", message: error instanceof Error ? error.message : "Untargeted sales opportunities are temporarily unavailable.", requestId: (error as Error & { requestId?: string }).requestId, report: cached });
    });
    return () => controller.abort();
  }, [asin, country, refreshVersion, reportKey, weekStart]);

  const displayedState: LoadState = !asin
    ? { key: reportKey, status: "idle", message: "Add an ASIN to check untargeted sales opportunities." }
    : loadState.key === reportKey
      ? loadState
      : { key: reportKey, status: "idle", message: "This report loads with Refresh Data and reuses the latest saved result for this product and week." };
  const report = displayedState.report;
  const filteredRows = useMemo(() => {
    if (!report) return [];
    const minSales = numericFilter(minimumSales) ?? 0;
    const maxAcos = numericFilter(maximumAcos);
    return report.opportunities.filter(row => (typeFilter === "All" || row.type === typeFilter)
      && row.orders >= 1 && row.sales >= minSales
      && (maxAcos == null || (row.acos != null && row.acos <= maxAcos)));
  }, [maximumAcos, minimumSales, report, typeFilter]);
  const visibleRows = showAll ? filteredRows : filteredRows.slice(0, INITIAL_ROW_COUNT);

  return <section className={`${ws.card} ${styles.comparisonCard}`} aria-labelledby="untargeted-opportunities-heading">
    <header className={styles.comparisonHeader}>
      <div><h3 id="untargeted-opportunities-heading"><Target aria-hidden="true" />Untargeted Sales Opportunities</h3><p>PPC search terms and product ASINs with at least one attributed order and no exact PPC target.</p></div>
      {report ? <span className={report.dataState === "Partial" ? styles.partialBadge : styles.finalBadge}>{report.dataState}</span> : null}
    </header>

    {displayedState.status === "idle" ? <div className={styles.stateMessage}><span>{displayedState.message}</span></div> : null}
    {displayedState.status === "loading" ? <div className={styles.stateMessage} role="status"><RefreshCw className={styles.loadingIcon} aria-hidden="true" /><span>{displayedState.message}</span></div> : null}
    {displayedState.status === "authorization" ? <div className={styles.stateMessage}><span>{displayedState.message}</span><a href={displayedState.authorizationUrl}>Connect Scale Insights</a></div> : null}
    {displayedState.status === "unsupported" ? <div className={`${styles.stateMessage} ${styles.capabilityState}`} role="status"><span className={styles.errorCopy}><strong>Opportunity reporting is unavailable</strong><span>{displayedState.message}</span>{displayedState.requestId ? <small>Reference ID: {displayedState.requestId}</small> : null}</span></div> : null}
    {displayedState.status === "error" ? <div className={`${styles.stateMessage} ${styles.errorState}`} role="alert"><span className={styles.errorCopy}><strong>Opportunities could not be loaded</strong><span>{displayedState.message} Use Refresh Data to try again.</span>{displayedState.requestId ? <small>Reference ID: {displayedState.requestId}</small> : null}</span></div> : null}

    {report ? <>
      <div className={styles.opportunityMeta}><span><small>Reporting period</small><strong>{formatDate(report.period.startDate)} – {formatDate(report.period.endDate)}</strong></span><span><small>Matched opportunities</small><strong>{report.opportunities.length}</strong></span><small>Orders ≥ 1 and explicitly not exact-targeted.</small></div>
      {report.warnings.length ? <ul className={styles.warnings}>{report.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : null}
      <div className={styles.opportunityFilters} aria-label="Opportunity criteria">
        <label><span>Type</span><select aria-label="Opportunity type" value={typeFilter} onChange={event => setTypeFilter(event.target.value as "All" | UntargetedOpportunityType)}><option>All</option><option>Search term</option><option>Product ASIN</option></select></label>
        <label><span>Minimum Sales</span><input aria-label="Minimum PPC Sales" type="number" min="0" step="1" placeholder="Any" value={minimumSales} onChange={event => setMinimumSales(event.target.value)} /></label>
        <label><span>Maximum ACOS</span><span className={styles.percentFilter}><input aria-label="Maximum ACOS" type="number" min="0" step="1" placeholder="Any" value={maximumAcos} onChange={event => setMaximumAcos(event.target.value)} /><i>%</i></span></label>
      </div>
      {filteredRows.length ? <div className={styles.baselineTable}>
        <div className={styles.baselineSummary}><strong>{filteredRows.length} match{filteredRows.length === 1 ? "" : "es"}</strong><span>Filtered locally — no additional MCP usage</span></div>
        <div className={styles.tableScroll}><table aria-label="Untargeted sales opportunities"><thead><tr><th>Search Term</th><th>Impressions</th><th>Clicks</th><th>Spend</th><th>Sales</th><th>Orders</th><th>ACOS</th><th>Status</th></tr></thead><tbody>{visibleRows.map(row => <tr key={`${row.type}:${row.term}`}>
          <th scope="row">{row.type === "Product ASIN" ? <a href={`https://www.amazon.com/dp/${encodeURIComponent(row.term)}`} target="_blank" rel="noopener noreferrer"><span>{row.term}</span><ExternalLink aria-hidden="true" /></a> : <span className={styles.campaignName}>{row.term}</span>}</th>
          <td>{new Intl.NumberFormat("en-US").format(row.impressions)}</td><td>{new Intl.NumberFormat("en-US").format(row.clicks)}</td><td>{formatCurrency(row.spend, report.currency)}</td><td><strong>{formatCurrency(row.sales, report.currency)}</strong></td><td>{row.orders}</td><td>{row.acos == null ? "—" : `${Math.round(row.acos)}%`}</td><td><span className={styles.untargetedBadge}>Not targeted</span></td>
        </tr>)}</tbody></table></div>
        {filteredRows.length > INITIAL_ROW_COUNT ? <button type="button" className={styles.showAllButton} onClick={() => setShowAll(value => !value)}>{showAll ? "Show first 10" : `Show all ${filteredRows.length}`}</button> : null}
      </div> : <p className={styles.emptyCategory}>No confirmed untargeted sales opportunities match these criteria.</p>}
    </> : null}
  </section>;
}
