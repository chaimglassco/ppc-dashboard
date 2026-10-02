"use client";

import { ArrowDown, ArrowUp, Check, ChevronsUpDown, Copy, ExternalLink, SquarePlus, Target, RefreshCw } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { withPpcBasePath } from "@/lib/glassco-apps";
import { getPipelineAuthorizationHeader } from "@/lib/pipeline-session";
import {
  parseUntargetedOpportunityCache,
  parseUntargetedSalesOpportunities,
  PPC_UNTARGETED_OPPORTUNITIES_CACHE_KEY,
  PPC_OPPORTUNITY_HISTORY_CACHE_KEY,
  untargetedOpportunityCacheKey,
  withUntargetedOpportunityCacheEntry,
  type UntargetedOpportunityCache,
  type UntargetedOpportunityType,
  type UntargetedSalesOpportunities,
} from "../domain/untargeted-sales-opportunities";
import { getScaleInsightsKeywordCampaignCreationHref, getScaleInsightsSearchTermHref } from "../domain/ppc-analysis-navigation";
import { addDaysIso } from "../domain/ppc-dashboard-state";
import { combineOpportunityWeeks, opportunityWeekStarts, parseOpportunityHistoryCache } from "../domain/opportunity-history";
import { dashboardStorage } from "../state/shared-dashboard-client";
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

export type OpportunityPpcClickTotal = { asin: string; country: string; weekStart: string; ppcClicks: number };

const INITIAL_ROW_COUNT = 10;
const COPY_FEEDBACK_MS = 2_000;
const EMPTY_SELECTED_TERMS = new Set<string>();
type SortMetric = "impressions" | "clicks" | "spend" | "sales" | "orders" | "acos";
type SortDirection = "asc" | "desc";

const SORT_LABELS: Record<SortMetric, string> = {
  impressions: "Impressions",
  clicks: "Clicks",
  spend: "Spend",
  sales: "Sales",
  orders: "Orders",
  acos: "ACOS",
};

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

function SortableMetricHeader({ metric, total, activeMetric, direction, onSort }: { metric: SortMetric; total: string; activeMetric: SortMetric; direction: SortDirection; onSort: (metric: SortMetric) => void }) {
  const active = metric === activeMetric;
  const nextDirection = active && direction === "desc" ? "lowest to highest" : "highest to lowest";
  const Icon = active ? (direction === "desc" ? ArrowDown : ArrowUp) : ChevronsUpDown;
  return <th scope="col" aria-sort={active ? (direction === "desc" ? "descending" : "ascending") : "none"}>
    <span className={styles.metricColumnHeader}><strong className={styles.metricColumnTotal} aria-label={`Total ${SORT_LABELS[metric]}`}>{total}</strong><button type="button" className={styles.sortButton} aria-label={`Sort ${SORT_LABELS[metric]} ${nextDirection}`} onClick={() => onSort(metric)}>{SORT_LABELS[metric]}<Icon aria-hidden="true" /></button></span>
  </th>;
}

function CopyTermButton({ term }: { term: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const resetTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (resetTimer.current != null) window.clearTimeout(resetTimer.current);
  }, []);
  const copyTerm = async () => {
    if (resetTimer.current != null) window.clearTimeout(resetTimer.current);
    try {
      await navigator.clipboard.writeText(term);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    resetTimer.current = window.setTimeout(() => {
      setCopyState("idle");
      resetTimer.current = null;
    }, COPY_FEEDBACK_MS);
  };
  const label = copyState === "copied" ? `Copied search term ${term}` : copyState === "error" ? `Copy search term ${term} failed` : `Copy search term ${term}`;
  return <button type="button" className={styles.copyTermButton} aria-label={label} title={copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy search term"} onClick={copyTerm}>
    {copyState === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
  </button>;
}

function copyTermForScaleInsights(term: string) {
  if (!navigator.clipboard?.writeText) return;
  void navigator.clipboard.writeText(term).catch(() => undefined);
}

export function UntargetedSalesOpportunities({ asin, country = "US", weekStart, refreshVersion, onPpcClicksLoaded }: { asin: string; country?: string; weekStart: string; refreshVersion: number; onPpcClicksLoaded?: (total: OpportunityPpcClickTotal) => void }) {
  const reportKey = untargetedOpportunityCacheKey(country, asin, weekStart);
  const [scope, setScope] = useState({ anchor: weekStart, week: "all" });
  const scopeWeek = scope.anchor === weekStart ? scope.week : "all";
  const [retryVersion, setRetryVersion] = useState(0);
  const selectionKey = `${reportKey}:${scopeWeek}:${refreshVersion}:${retryVersion}`;
  const cacheRef = useRef<UntargetedOpportunityCache | null>(null);
  if (cacheRef.current === null) {
    cacheRef.current = typeof window === "undefined"
      ? {}
      : parseUntargetedOpportunityCache(dashboardStorage().getItem(PPC_UNTARGETED_OPPORTUNITIES_CACHE_KEY));
  }
  const historyCacheRef = useRef<Record<string, UntargetedSalesOpportunities> | null>(null);
  if (historyCacheRef.current === null) historyCacheRef.current = typeof window === "undefined" ? {} : parseOpportunityHistoryCache(dashboardStorage().getItem(PPC_OPPORTUNITY_HISTORY_CACHE_KEY));
  const handledRefreshes = useRef(new Map<string, number>());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [showAll, setShowAll] = useState(false);
  const [selection, setSelection] = useState<{ key: string; terms: Set<string> }>(() => ({ key: selectionKey, terms: new Set() }));
  const selectedTerms = selection.key === selectionKey ? selection.terms : EMPTY_SELECTED_TERMS;
  const [typeFilter, setTypeFilter] = useState<"All" | UntargetedOpportunityType>("All");
  const [minimumSales, setMinimumSales] = useState("");
  const [maximumAcos, setMaximumAcos] = useState("");
  const [sort, setSort] = useState<{ metric: SortMetric; direction: SortDirection }>({ metric: "sales", direction: "desc" });
  const [loadState, setLoadState] = useState<LoadState>({ key: "", status: "idle", message: "" });

  useEffect(() => {
    if (!asin) return;
    const controller = new AbortController();
    const cached = historyCacheRef.current?.[reportKey];
    const force = refreshVersion > (handledRefreshes.current.get(reportKey) ?? 0);
    handledRefreshes.current.set(reportKey, refreshVersion);
    const weeklyCacheComplete = opportunityWeekStarts(weekStart).every(date => { const saved = cacheRef.current?.[untargetedOpportunityCacheKey(country, asin, date)]; return saved?.complete && saved.performanceRows; });
    if (cached?.complete && weeklyCacheComplete && !force && retryVersion === 0) {
      setLoadState({ key: reportKey, status: "ready", message: "", report: cached });
      return () => controller.abort();
    }
    setShowAll(false);
    setLoadState({ key: reportKey, status: "loading", message: "Loading 12 weeks and checking current targeting…", report: cached });
    const starts = opportunityWeekStarts(weekStart);
    const reports: UntargetedSalesOpportunities[] = [];
    let coverage: UntargetedSalesOpportunities | undefined;
    let authorizationUrl: string | undefined;
    let requestId: string | undefined;
    let completed = 0;
    let rateLimited = false;
    let failureMessage = "";
    const persist = () => {
      try {
        dashboardStorage().setItem(PPC_UNTARGETED_OPPORTUNITIES_CACHE_KEY, JSON.stringify({ version: 1, entries: cacheRef.current }));
      } catch { /* Validated data remains in memory. */ }
    };
    const load = async (date: string, range: boolean) => {
      if (controller.signal.aborted || authorizationUrl || rateLimited) return;
      const key = untargetedOpportunityCacheKey(country, asin, date);
      const saved = cacheRef.current?.[key];
      if (!range && !force && saved?.performanceRows && saved.complete) { reports.push(saved); completed++; return; }
      const query = new URLSearchParams({ asin, country, weekStart: date, weeks: range ? "12" : "1", history: "1" });
      try {
        const response = await fetch(withPpcBasePath(`/api/dashboard/untargeted-opportunities?${query}`), { headers: getPipelineAuthorizationHeader(), cache: "no-store", signal: controller.signal });
        const value = await response.json();
        if (controller.signal.aborted) return;
        if (response.status === 409 && typeof value.authorizationUrl === "string") {
          const url = new URL(value.authorizationUrl);
          if (url.protocol === "https:" && (url.hostname === "vercel.com" || url.hostname.endsWith(".vercel.com"))) authorizationUrl = url.toString();
          throw new Error("Connect Scale Insights to load opportunity history.");
        }
        if (!response.ok) {
          requestId = typeof value.requestId === "string" ? value.requestId : undefined;
          if (response.status === 429) rateLimited = true;
          throw new Error(typeof value.error === "string" ? value.error : "Could not load this reporting period.");
        }
        const result = parseUntargetedSalesOpportunities(value.opportunities);
        const expectedStart = range ? addDaysIso(date, -77) : date;
        if (!result || result.asin !== asin.toUpperCase() || result.country !== country.toUpperCase() || result.period.startDate !== expectedStart || result.period.endDate > addDaysIso(date, 6) || (!range && !result.performanceRows)) throw new Error("Scale Insights returned invalid opportunity history.");
        if (range) coverage = result;
        else { reports.push(result); cacheRef.current = withUntargetedOpportunityCacheEntry(cacheRef.current ?? {}, result, 156); persist(); completed++; }
      } catch (error) {
        if (controller.signal.aborted) return;
        failureMessage = error instanceof Error ? error.message : "Could not load opportunity history.";
        // Stale values may be shown, but are never counted as a successfully refreshed week.
        if (range) coverage = undefined;
        setLoadState(current => current.key === reportKey ? { ...current, message: error instanceof Error ? error.message : "Could not load opportunity history." } : current);
      }
      if (!controller.signal.aborted) setLoadState(current => current.key === reportKey ? { ...current, message: `Loading history: ${completed} of 12 weeks loaded…` } : current);
    };
    const jobs = [{ date: weekStart, range: true }, ...starts.map(date => ({ date, range: false }))];
    let next = 0;
    const worker = async () => { while (next < jobs.length && !controller.signal.aborted && !authorizationUrl && !rateLimited) { const job = jobs[next++]; await load(job.date, job.range); } };
    void Promise.all([worker(), worker()]).then(() => {
      if (controller.signal.aborted) return;
      const combined = rateLimited && cached ? {
        ...cached, complete: false,
        opportunities: cached.opportunities.map(row => ({ ...row, targetingState: "unverified" as const })),
        targetingCoverage: cached.targetingCoverage?.map(row => ({ ...row, state: "unverified" as const })),
        warnings: [...new Set([...cached.warnings, failureMessage, "Showing saved history. Current targeting could not be refreshed; bulk selection is disabled."])],
      } : combineOpportunityWeeks(asin, country, weekStart, reports, coverage);
      if (authorizationUrl) { setLoadState({ key: reportKey, status: "authorization", message: "Connect Scale Insights to retrieve opportunity history.", authorizationUrl, report: combined, requestId }); return; }
      if (!rateLimited && reports.length) {
        historyCacheRef.current = Object.fromEntries([...Object.entries(historyCacheRef.current ?? {}).filter(([key]) => key !== reportKey), [reportKey, combined]].slice(-12));
        try { dashboardStorage().setItem(PPC_OPPORTUNITY_HISTORY_CACHE_KEY, JSON.stringify({ version: 1, entries: historyCacheRef.current })); } catch { /* Keep the report in memory. */ }
      }
      setLoadState({ key: reportKey, status: !rateLimited && reports.length ? "ready" : "error", message: rateLimited || !reports.length ? failureMessage || "No reporting weeks could be loaded." : "", report: combined, requestId });
    });
    return () => controller.abort();
  }, [asin, country, refreshVersion, reportKey, retryVersion, weekStart]);

  const displayedState: LoadState = loadState.key === reportKey ? loadState : { key: reportKey, status: "idle", message: asin ? "Loading opportunity history…" : "Add an ASIN to check untargeted sales opportunities." };
  const historyReport = displayedState.report;
  const selectedWeeklyReport = cacheRef.current?.[untargetedOpportunityCacheKey(country, asin, scopeWeek)];
  const report = useMemo(() => {
    if (!historyReport || scopeWeek === "all") return historyReport;
    if (!selectedWeeklyReport || !historyReport.history?.loadedWeeks.includes(scopeWeek)) return undefined;
    const single = combineOpportunityWeeks(asin, country, weekStart, [selectedWeeklyReport], historyReport);
    return { ...single, period: selectedWeeklyReport.period, dataState: selectedWeeklyReport.dataState, history: historyReport.history, complete: selectedWeeklyReport.complete, warnings: selectedWeeklyReport.warnings.concat(historyReport.warnings.filter(warning => !warning.startsWith("Incomplete history:"))) };
  }, [asin, country, historyReport, scopeWeek, selectedWeeklyReport, weekStart]);
  useEffect(() => {
    const selected = cacheRef.current?.[reportKey];
    if (selected?.ppcClicks == null) return;
    onPpcClicksLoaded?.({ asin: selected.asin, country: selected.country, weekStart: selected.period.startDate, ppcClicks: selected.ppcClicks });
  }, [onPpcClicksLoaded, reportKey, historyReport]);
  const filteredRows = useMemo(() => {
    if (!report) return [];
    const minSales = numericFilter(minimumSales) ?? 0;
    const maxAcos = numericFilter(maximumAcos);
    return report.opportunities.filter(row => (typeFilter === "All" || row.type === typeFilter)
      && row.orders >= 1 && row.sales >= minSales
      && (maxAcos == null || (row.acos != null && row.acos <= maxAcos)));
  }, [maximumAcos, minimumSales, report, typeFilter]);
  const sortedRows = useMemo(() => [...filteredRows].sort((first, second) => {
    if (first.targetingState !== second.targetingState) return first.targetingState === "untargeted" ? -1 : 1;
    const firstValue = first[sort.metric];
    const secondValue = second[sort.metric];
    if (firstValue == null && secondValue == null) return first.term.localeCompare(second.term);
    if (firstValue == null) return 1;
    if (secondValue == null) return -1;
    const difference = sort.direction === "desc" ? secondValue - firstValue : firstValue - secondValue;
    return difference || first.term.localeCompare(second.term);
  }), [filteredRows, sort]);
  const totals = useMemo(() => {
    const values = filteredRows.reduce((current, row) => ({
      impressions: current.impressions + row.impressions,
      clicks: current.clicks + row.clicks,
      spend: current.spend + row.spend,
      sales: current.sales + row.sales,
      orders: current.orders + row.orders,
    }), { impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0 });
    return { ...values, acos: values.sales > 0 ? (values.spend / values.sales) * 100 : null };
  }, [filteredRows]);
  const metricTotals: Record<SortMetric, string> = {
    impressions: new Intl.NumberFormat("en-US").format(totals.impressions),
    clicks: new Intl.NumberFormat("en-US").format(totals.clicks),
    spend: formatCurrency(totals.spend, report?.currency || "USD"),
    sales: formatCurrency(totals.sales, report?.currency || "USD"),
    orders: new Intl.NumberFormat("en-US").format(totals.orders),
    acos: totals.acos == null ? "—" : `${Math.round(totals.acos)}%`,
  };
  const visibleRows = showAll ? sortedRows : sortedRows.slice(0, INITIAL_ROW_COUNT);
  const visibleSearchTerms = visibleRows.filter(row => row.type === "Search term" && row.targetingState === "untargeted" && displayedState.status === "ready").map(row => row.term);
  const allVisibleSearchTermsSelected = visibleSearchTerms.length > 0 && visibleSearchTerms.every(term => selectedTerms.has(term));
  const someVisibleSearchTermsSelected = visibleSearchTerms.some(term => selectedTerms.has(term));
  const selectedTermList = [...selectedTerms].filter(term => report?.opportunities.some(row => row.term === term && row.targetingState === "untargeted"));
  const bulkCampaignHref = getScaleInsightsKeywordCampaignCreationHref(asin, selectedTermList);

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someVisibleSearchTermsSelected && !allVisibleSearchTermsSelected;
  }, [allVisibleSearchTermsSelected, someVisibleSearchTermsSelected]);

  const updateSort = (metric: SortMetric) => {
    setSort(current => current.metric === metric
      ? { metric, direction: current.direction === "desc" ? "asc" : "desc" }
      : { metric, direction: "desc" });
    setShowAll(false);
  };
  const toggleTerm = (term: string) => {
    setSelection(current => {
      const next = new Set(current.key === selectionKey ? current.terms : EMPTY_SELECTED_TERMS);
      if (next.has(term)) next.delete(term);
      else next.add(term);
      return { key: selectionKey, terms: next };
    });
  };
  const toggleVisibleSearchTerms = () => {
    setSelection(current => {
      const next = new Set(current.key === selectionKey ? current.terms : EMPTY_SELECTED_TERMS);
      if (allVisibleSearchTermsSelected) visibleSearchTerms.forEach(term => next.delete(term));
      else visibleSearchTerms.forEach(term => next.add(term));
      return { key: selectionKey, terms: next };
    });
  };

  return <section className={`${ws.card} ${styles.comparisonCard}`} aria-labelledby="untargeted-opportunities-heading">
    <header className={styles.comparisonHeader}>
      <div><h3 id="untargeted-opportunities-heading"><Target aria-hidden="true" />Untargeted Sales Opportunities</h3><p>Converting PPC search terms and product ASINs across the selected reporting scope. Only confirmed untargeted terms can be selected.</p></div>
      {report ? <span className={report.dataState === "Partial" ? styles.partialBadge : styles.finalBadge}>{report.dataState}</span> : null}
    </header>

    {displayedState.status === "idle" ? <div className={styles.stateMessage}><span>{displayedState.message}</span></div> : null}
    {displayedState.status === "loading" ? <div className={styles.stateMessage} role="status"><RefreshCw className={styles.loadingIcon} aria-hidden="true" /><span>{displayedState.message}</span></div> : null}
    {displayedState.status === "authorization" ? <div className={styles.stateMessage}><span>{displayedState.message}</span><a href={displayedState.authorizationUrl}>Connect Scale Insights</a></div> : null}
    {displayedState.status === "unsupported" ? <div className={`${styles.stateMessage} ${styles.capabilityState}`} role="status"><span className={styles.errorCopy}><strong>Opportunity reporting is unavailable</strong><span>{displayedState.message}</span>{displayedState.requestId ? <small>Reference ID: {displayedState.requestId}</small> : null}</span></div> : null}
    {displayedState.status === "error" ? <div className={`${styles.stateMessage} ${styles.errorState}`} role="alert"><span className={styles.errorCopy}><strong>Opportunities could not be loaded</strong><span>{displayedState.message} Use Refresh Data to try again.</span>{displayedState.requestId ? <small>Reference ID: {displayedState.requestId}</small> : null}</span></div> : null}

    <div className={styles.historyControls}><label><span>Reporting week</span><select aria-label="Reporting week" value={scopeWeek} onChange={event => { setScope({ anchor: weekStart, week: event.target.value }); setShowAll(false); }}><option value="all">All 12 weeks</option>{opportunityWeekStarts(weekStart).map(date => <option key={date} value={date}>{formatDate(date)} – {formatDate(addDaysIso(date, 6))}</option>)}</select></label>{historyReport && (!historyReport.complete || displayedState.status === "error") ? <button type="button" disabled={displayedState.status === "loading"} onClick={() => setRetryVersion(version => version + 1)}>Retry missing weeks / targeting</button> : null}</div>
    {scopeWeek !== "all" && !report && displayedState.status !== "loading" ? <p className={styles.emptyCategory}>This week is unavailable. Retry missing weeks to load it.</p> : null}
    {report ? <>
      <div className={styles.opportunityMeta}><span><small>Reporting period</small><strong>{formatDate(report.period.startDate)} – {formatDate(report.period.endDate)}</strong></span><span><small>Matched opportunities</small><strong>{report.opportunities.length}</strong></span><small>{historyReport?.history?.checkedAt ? `Targeting checked ${new Date(historyReport.history.checkedAt).toLocaleString()}. ` : "Targeting not verified. "}{historyReport?.history?.loadedWeeks.length ?? 0} of 12 weeks loaded · {historyReport?.complete ? "Complete" : "Incomplete"}{scopeWeek === "all" ? " · Combined totals" : " · Weekly totals"}</small></div>
      {report.warnings.length ? <ul className={styles.warnings}>{report.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : null}
      <div className={styles.opportunityFilters} aria-label="Opportunity criteria">
        <label><span>Type</span><select aria-label="Opportunity type" value={typeFilter} onChange={event => setTypeFilter(event.target.value as "All" | UntargetedOpportunityType)}><option>All</option><option>Search term</option><option>Product ASIN</option></select></label>
        <label><span>Minimum Sales</span><input aria-label="Minimum PPC Sales" type="number" min="0" step="1" placeholder="Any" value={minimumSales} onChange={event => setMinimumSales(event.target.value)} /></label>
        <label><span>Maximum ACOS</span><span className={styles.percentFilter}><input aria-label="Maximum ACOS" type="number" min="0" step="1" placeholder="Any" value={maximumAcos} onChange={event => setMaximumAcos(event.target.value)} /><i>%</i></span></label>
      </div>
      {filteredRows.length ? <div className={styles.baselineTable}>
        <div className={styles.baselineSummary}><strong>{filteredRows.length} match{filteredRows.length === 1 ? "" : "es"}</strong>
        {filteredRows.some(row => row.type === "Search term") ? <div className={styles.bulkCampaignBar}><span role="status" aria-live="polite" aria-label={`${selectedTerms.size} search term${selectedTerms.size === 1 ? "" : "s"} selected`}><strong>{selectedTerms.size}</strong> search term{selectedTerms.size === 1 ? "" : "s"} selected</span>{selectedTerms.size ? <a className={styles.bulkCampaignButton} href={bulkCampaignHref} target="_blank" rel="noopener noreferrer" aria-label={`Create bulk campaigns for ${selectedTerms.size} selected search ${selectedTerms.size === 1 ? "term" : "terms"}`}><SquarePlus aria-hidden="true" />Create Bulk Campaigns</a> : <button type="button" className={styles.bulkCampaignButton} disabled><SquarePlus aria-hidden="true" />Create Bulk Campaigns</button>}</div> : null}</div>
        <div className={styles.tableScroll}><table className={styles.opportunityTable} aria-label="Untargeted sales opportunities"><thead><tr><th className={styles.selectionCell}><input ref={selectAllRef} type="checkbox" aria-label="Select all visible search terms" checked={allVisibleSearchTermsSelected} disabled={!visibleSearchTerms.length} onChange={toggleVisibleSearchTerms} /></th><th>Search Term</th>{(Object.keys(SORT_LABELS) as SortMetric[]).map(metric => <SortableMetricHeader key={metric} metric={metric} total={metricTotals[metric]} activeMetric={sort.metric} direction={sort.direction} onSort={updateSort} />)}<th title="Most recent reporting week with activity">Last seen</th><th>Weeks appeared</th><th>Status</th></tr></thead><tbody>{visibleRows.map((row, index) => <Fragment key={`${row.type}:${row.term}`}>{row.targetingState !== "untargeted" && (index === 0 || visibleRows[index - 1].targetingState === "untargeted") ? <tr className={styles.targetingUnverifiedGroup}><th colSpan={11} scope="colgroup">Targeting unverified — review required before creating campaigns</th></tr> : null}<tr>
          <td className={styles.selectionCell}>{row.type === "Search term" ? <input disabled={row.targetingState !== "untargeted" || displayedState.status !== "ready"} type="checkbox" aria-label={`Select search term ${row.term}`} checked={selectedTerms.has(row.term)} onChange={() => toggleTerm(row.term)} /> : null}</td>
          <th scope="row"><span className={styles.opportunityTerm}>{row.type === "Product ASIN" ? <a className={styles.productAsinLink} href={`https://www.amazon.com/dp/${encodeURIComponent(row.term)}`} target="_blank" rel="noopener noreferrer"><span>{row.term}</span></a> : <span className={styles.campaignName}>{row.term}</span>}<CopyTermButton term={row.term} /><a className={styles.sourceLink} href={getScaleInsightsSearchTermHref(asin, report.period.startDate, report.period.endDate)} target="_blank" rel="noopener noreferrer" aria-label={`Open Scale Insights Search terms for ${row.term}`} title="Open Scale Insights Search terms and copy this value for Instant Search" onClick={() => copyTermForScaleInsights(row.term)}><ExternalLink aria-hidden="true" /></a></span></th>
          <td>{new Intl.NumberFormat("en-US").format(row.impressions)}</td><td>{new Intl.NumberFormat("en-US").format(row.clicks)}</td><td>{formatCurrency(row.spend, report.currency)}</td><td><strong>{formatCurrency(row.sales, report.currency)}</strong></td><td>{row.orders}</td><td>{row.acos == null ? "—" : `${Math.round(row.acos)}%`}</td><td>{row.lastSeen ? formatDate(row.lastSeen) : "—"}</td><td>{row.weeksAppeared ?? 1}</td><td><span className={row.targetingState === "untargeted" ? styles.untargetedBadge : styles.unverifiedBadge}>{row.targetingState === "untargeted" ? "Not targeted" : "Targeting unverified"}</span></td>
        </tr></Fragment>)}</tbody></table></div>
        {filteredRows.length > INITIAL_ROW_COUNT ? <button type="button" className={styles.showAllButton} onClick={() => setShowAll(value => !value)}>{showAll ? "Show first 10" : `Show all ${filteredRows.length}`}</button> : null}
      </div> : <p className={styles.emptyCategory}>No sales opportunities match these criteria.</p>}
    </> : null}
  </section>;
}
