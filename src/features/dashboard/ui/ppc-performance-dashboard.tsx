"use client";

import Image from "next/image";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BarChart3, Bold, CalendarDays, Check, CheckCircle2, ClipboardList, DollarSign,
  FileText, Flag, Italic, List, ListOrdered, Plus, RefreshCw, Save, ShoppingCart, SlidersHorizontal, Trash2, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { withPpcBasePath } from "@/lib/glassco-apps";
import { getPipelineAuthorizationHeader } from "@/lib/pipeline-session";
import {
  PPC_DASHBOARD_STORAGE_KEY, addDaysIso, addMonthsIso, createWeeklyPpcReport, currency,
  formatReportingMonthRange, formatWeekRange, formatWeeklyGoalTarget, formatWeeklyGoalValue, getIsoWeekNumber, getSelectedMonthWeekStarts, parsePpcDashboardStore, percentage, reportKey,
  startOfWeekIso, withCalculatedPerformance, type ActionItem, type DashboardProduct, type GoalOutcome, type GoalStatus,
  WEEKLY_GOAL_OPTIONS, weeklyGoalActualValue, weeklyGoalLabel, weeklyGoalUnit, type GoalDataState, type WeeklyGoal, type WeeklyGoalMetric, type WeeklyPpcReport,
} from "../domain/ppc-dashboard-state";
import {
  PPC_DASHBOARD_CATALOG_STORAGE_KEY, createDashboardTagId, emptyDashboardCatalog, mergeDashboardProducts,
  parseDashboardCatalogStore, reorderVisibleProducts, type DashboardCatalogProduct, type DashboardCatalogStore, type ManagedDashboardProduct,
} from "../domain/ppc-dashboard-catalog";
import { ProductPortfolioPanel, type ProductFormValue } from "./product-portfolio-panel";
import { ProductPerformanceChat, type PerformanceChatPeriod } from "./product-performance-chat";
import { PPC_PERFORMANCE_CACHE_KEY, parsePerformanceCache, parsePerformanceSnapshot, performanceCacheKey, type PerformanceCache } from "../domain/ppc-performance-cache";
import { getScaleInsightsAnalysisHref, PPC_ANALYSIS_COLUMNS } from "../domain/ppc-analysis-navigation";
import styles from "./ppc-performance-dashboard.module.css";

type MetricField = "spend" | "ppcSales" | "organicSales" | "totalSales" | "ppcOrders" | "organicOrders" | "totalOrders" | "acos" | "tacos";
type MetricDefinition = { field: MetricField; label: string; prefix?: string; suffix?: string; calculated?: boolean; imported?: boolean };
type PerformanceLoadState = {
  key: string;
  status: "idle" | "loading" | "authorization" | "ready" | "error";
  message: string;
  warnings: string[];
  authorizationUrl?: string;
};

const ACTIVE_GOAL_STATUSES: GoalStatus[] = ["On Track", "At Risk"];
const AUTO_SAVE_DELAY_MS = 500;
const BUDGET_HISTORY_PAGE_SIZE = 5;
const PERFORMANCE_BACKFILL_CONCURRENCY = 2;
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const METRIC_GROUPS: { title: string; displayTitle: string; metrics: MetricDefinition[] }[] = [
  { title: "Sales", displayTitle: "Sales Metrics", metrics: [
    { field: "spend", label: "Spend", prefix: "$", imported: true }, { field: "ppcSales", label: "PPC Sales", prefix: "$", imported: true },
    { field: "organicSales", label: "Organic Sales", prefix: "$", calculated: true }, { field: "totalSales", label: "Total Sales", prefix: "$", imported: true },
  ] },
  { title: "Orders", displayTitle: "Order Volume", metrics: [
    { field: "ppcOrders", label: "PPC Orders", imported: true }, { field: "organicOrders", label: "Organic Orders", calculated: true }, { field: "totalOrders", label: "Total Orders", imported: true },
  ] },
  { title: "Efficiency", displayTitle: "Efficiency & Targets", metrics: [
    { field: "acos", label: "ACOS", suffix: "%", calculated: true }, { field: "tacos", label: "TACOS", suffix: "%", calculated: true },
  ] },
];

function numericValue(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function roundedMetricValue(value: number) {
  return Number.isFinite(value) && value > 0 ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value)) : "";
}

function previousMetricValue(metric: MetricDefinition, value: number) {
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value || 0));
  return `${metric.prefix ?? ""}${formatted}${metric.suffix ?? ""}`;
}

function metricDeltaPercentage(current: number, previous?: number) {
  if (previous == null || previous === 0) return null;
  return Math.round(Math.abs(((current - previous) / previous) * 100));
}

function lowerIsBetter(field: MetricField) {
  return field === "spend" || field === "acos" || field === "tacos";
}

function dailyLimitFromWeekly(weeklyLimit: number) {
  return Math.round((weeklyLimit / 7) * 100) / 100;
}

function preciseCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 }).format(value || 0);
}

function MetricInput({ metric, report, previousValue, importedLocked, warning, targetAcos, onChange }: { metric: MetricDefinition; report: WeeklyPpcReport; previousValue?: number; importedLocked: boolean; warning?: boolean; targetAcos?: number; onChange: (field: MetricField, value: number) => void }) {
  const readOnly = Boolean(metric.calculated || (metric.imported && importedLocked));
  const comparison = previousValue == null ? 0 : report[metric.field] - previousValue;
  const comparisonDirection = comparison > 0 ? "increased" : comparison < 0 ? "decreased" : "unchanged";
  const deltaPercentage = metricDeltaPercentage(report[metric.field], previousValue);
  const favorable = comparison !== 0 && (lowerIsBetter(metric.field) ? comparison < 0 : comparison > 0);
  const trendTone = comparison === 0 ? styles.metricNeutral : favorable ? styles.metricIncrease : styles.metricDecrease;
  const trendLabel = deltaPercentage == null ? "New" : `${deltaPercentage}%`;
  const targetDifference = warning && targetAcos ? Math.round(Math.max(0, report.acos - targetAcos)) : 0;
  return <label className={`${styles.metricCard} ${readOnly ? styles.calculatedMetric : ""} ${warning ? styles.metricWarning : ""}`} data-warning={warning || undefined}>
    <span className={styles.metricCardHeader}><span>{metric.label}</span>{previousValue != null && comparison !== 0 ? <span className={`${styles.metricDelta} ${trendTone}`} aria-label={`${metric.label} ${comparisonDirection} by ${trendLabel} from previous week`}>{comparison > 0 ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}{trendLabel}</span> : null}</span>
    <span className={`${styles.metricInputWrap} ${metric.suffix ? styles.metricPercentWrap : ""}`}>{metric.prefix ? <i>{metric.prefix}</i> : null}<input aria-label={metric.label} aria-describedby={warning ? "acos-target-warning" : undefined} aria-readonly={readOnly || undefined} readOnly={readOnly} inputMode="numeric" value={roundedMetricValue(report[metric.field])} placeholder="0" onChange={event => { if (!readOnly) onChange(metric.field, numericValue(event.target.value)); }} />{metric.suffix ? <i>{metric.suffix}</i> : null}</span>
    {warning ? <span id="acos-target-warning" className={styles.metricCardHint}>+{targetDifference}% above target ({new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(targetAcos || 0)}%)</span> : metric.field === "tacos" ? <span className={styles.metricCardHint}>Total advertising ratio</span> : <span className={styles.metricCardHint} aria-hidden="true">&nbsp;</span>}
    <span className={`${styles.metricPreviousRow} ${styles.metricPrevious}`} aria-label={previousValue == null ? `Previous ${metric.label}: unavailable` : `Previous ${metric.label}: ${previousMetricValue(metric, previousValue)}, ${comparisonDirection}`}>
      <small>Prev. Week</small>
      <strong>{previousValue == null ? "—" : previousMetricValue(metric, previousValue)}</strong>
    </span>
  </label>;
}

function WeeklyGoalRow({ goal, report, dataState, onUpdate, onResolve, onRemove }: { goal: WeeklyGoal; report: WeeklyPpcReport; dataState: GoalDataState | null; onUpdate: (patch: Partial<WeeklyGoal>) => void; onResolve: (status: GoalOutcome) => void; onRemove: () => void }) {
  const [targetEditing, setTargetEditing] = useState(false);
  const label = goal.metric ? weeklyGoalLabel(goal.metric) : goal.title || "Choose goal";
  const actualState = goal.metric ? dataState : null;
  const actual = actualState ? formatWeeklyGoalValue(goal, weeklyGoalActualValue(goal, report)) : "";
  const selectMetric = (metric: WeeklyGoalMetric) => onUpdate({
    metric, title: weeklyGoalLabel(metric), unit: weeklyGoalUnit(metric), target: "", actual: "",
  });

  return <div className={styles.goalRow}>
    <div className={styles.goalDefinition}>
      <label>Goal<select aria-label={`Goal metric ${goal.id}`} value={goal.metric ?? ""} onChange={event => selectMetric(event.target.value as WeeklyGoalMetric)}><option value="" disabled>Choose goal</option>{WEEKLY_GOAL_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      {goal.metric === "organicOrders" ? <label>Measure<select aria-label="Organic Order measurement" value={weeklyGoalUnit(goal.metric, goal.unit)} onChange={event => onUpdate({ unit: event.target.value as "number" | "percentage", target: "", actual: "" })}><option value="number">Number</option><option value="percentage">Percentage</option></select></label> : null}
    </div>
    <div className={styles.goalMetrics}>
      <label>Target<input aria-label={`${label} target`} inputMode="decimal" value={targetEditing ? goal.target.replace(/[^0-9.-]/g, "") : formatWeeklyGoalTarget(goal)} onFocus={() => setTargetEditing(true)} onBlur={() => setTargetEditing(false)} onChange={event => onUpdate({ target: event.target.value })} /></label>
      <label>Actual<span className={styles.goalActualField}><input aria-label={`${label} actual`} aria-readonly="true" readOnly value={actual} placeholder="—" /><small className={actualState === "Final" ? styles.goalActualFinal : actualState === "Partial" ? styles.goalActualPartial : styles.goalActualWaiting}>{actualState ?? (goal.metric ? "Waiting" : "Select goal")}</small></span></label>
      <label>Status<select aria-label={`${label} status`} className={statusTone(goal.status)} value={goal.status} onChange={event => onUpdate({ status: event.target.value as GoalStatus })}>{ACTIVE_GOAL_STATUSES.map(status => <option className={statusTone(status)} key={status}>{status}</option>)}</select></label>
      <div className={styles.goalOutcomeActions}><button type="button" className={styles.goalAchievedButton} aria-label={`Mark ${label} achieved`} title="Mark achieved" onClick={() => onResolve("Achieved")}><CheckCircle2 aria-hidden="true" /></button><button type="button" className={styles.goalMissedButton} aria-label={`Mark ${label} missed`} title="Mark missed" onClick={() => onResolve("Missed")}><X aria-hidden="true" /></button><button type="button" className={styles.goalDeleteButton} aria-label={`Remove ${label}`} onClick={onRemove}><Trash2 aria-hidden="true" /></button></div>
    </div>
  </div>;
}

function FormattedTextarea({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const applyFormat = (format: "bold" | "italic" | "bullet" | "numbered") => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    let replacement = selected;
    let selectionStart = start;
    let selectionEnd = end;

    if (format === "bold" || format === "italic") {
      const marker = format === "bold" ? "**" : "_";
      const content = selected || (format === "bold" ? "bold text" : "italic text");
      replacement = `${marker}${content}${marker}`;
      selectionStart = start + marker.length;
      selectionEnd = selectionStart + content.length;
    } else {
      if (!selected) {
        replacement = format === "bullet" ? "• " : "1. ";
      } else {
        replacement = selected.split("\n").map((line, index) => `${format === "bullet" ? "•" : `${index + 1}.`} ${line.replace(/^\s*(?:[-•]|\d+\.)\s*/, "")}`).join("\n");
      }
      selectionStart = start + replacement.length;
      selectionEnd = start + replacement.length;
    }

    onChange(`${value.slice(0, start)}${replacement}${value.slice(end)}`);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const continueList = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || !event.shiftKey) return;
    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const currentLine = value.slice(lineStart, start);
    const bullet = currentLine.match(/^(\s*)•\s?/);
    const numbered = currentLine.match(/^(\s*)(\d+)\.\s?/);
    if (!bullet && !numbered) return;

    event.preventDefault();
    const continuation = bullet ? `\n${bullet[1]}• ` : `\n${numbered?.[1] ?? ""}${Number(numbered?.[2] ?? 0) + 1}. `;
    const nextCursor = start + continuation.length;
    onChange(`${value.slice(0, start)}${continuation}${value.slice(end)}`);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  return <div className={styles.textAreaLabel}><span>{label}</span><span className={styles.formatToolbar} role="toolbar" aria-label={`${label} formatting`}>
    <button type="button" aria-label={`Bold ${label}`} onClick={() => applyFormat("bold")}><Bold aria-hidden="true" /></button>
    <button type="button" aria-label={`Italic ${label}`} onClick={() => applyFormat("italic")}><Italic aria-hidden="true" /></button>
    <button type="button" aria-label={`Bulleted list ${label}`} onClick={() => applyFormat("bullet")}><List aria-hidden="true" /></button>
    <button type="button" aria-label={`Numbered list ${label}`} onClick={() => applyFormat("numbered")}><ListOrdered aria-hidden="true" /></button>
  </span><textarea ref={textareaRef} className={styles.notesArea} aria-label={label} value={value} onChange={event => onChange(event.target.value)} onKeyDown={continueList} placeholder={placeholder} /></div>;
}

function statusTone(status: string) {
  if (status === "Completed" || status === "Achieved" || status === "On Track") return styles.success;
  if (status === "Needs Review" || status === "At Risk") return styles.warning;
  if (status === "Missed") return styles.danger;
  return styles.info;
}

function priorityTone(priority: ActionItem["priority"]) {
  if (priority === "High") return styles.priorityHigh;
  if (priority === "Low") return styles.priorityLow;
  return styles.priorityMedium;
}

export function PpcPerformanceDashboard({ initialToday }: { initialToday: string }) {
  const initialWeekStart = startOfWeekIso(initialToday);
  const initialMonthKey = initialToday.slice(0, 7);
  const [pipelineProducts, setPipelineProducts] = useState<DashboardProduct[]>([]);
  const [catalog, setCatalog] = useState<DashboardCatalogStore>(emptyDashboardCatalog);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedWeekStart, setSelectedWeekStart] = useState(initialWeekStart);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([initialMonthKey]);
  const [draftSelectedMonths, setDraftSelectedMonths] = useState<string[]>([initialMonthKey]);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [goalHistoryOpen, setGoalHistoryOpen] = useState(false);
  const [budgetHistoryView, setBudgetHistoryView] = useState({ key: "", page: 1 });
  const [monthPickerYear, setMonthPickerYear] = useState(Number(initialToday.slice(0, 4)));
  const currentWeekStart = initialWeekStart;
  const [reports, setReports] = useState<Record<string, WeeklyPpcReport>>({});
  const [dirtyReportKeys, setDirtyReportKeys] = useState<Set<string>>(() => new Set());
  const [saveNotice, setSaveNotice] = useState("");
  const [performanceLoad, setPerformanceLoad] = useState<PerformanceLoadState>({ key: "", status: "idle", message: "", warnings: [] });
  const [performanceRefresh, setPerformanceRefresh] = useState(0);
  const [performanceCache, setPerformanceCache] = useState<PerformanceCache>({});
  const cacheRef = useRef<PerformanceCache>({});
  const refreshRequest = useRef("");
  const budgetEditStartRef = useRef<{ key: string; value: number } | null>(null);
  const [cacheReady, setCacheReady] = useState(false);

  const loadProducts = useCallback(async (signal?: AbortSignal) => {
    setProductsLoading(true);
    setProductsError("");
    try {
      const response = await fetch(withPpcBasePath("/api/dashboard/products"), { headers: getPipelineAuthorizationHeader(), cache: "no-store", signal });
      const value: unknown = await response.json();
      if (!response.ok || !value || typeof value !== "object") throw new Error("Could not load Pipeline products.");
      const candidates = (value as { products?: unknown }).products;
      const nextProducts = Array.isArray(candidates) ? candidates as DashboardProduct[] : [];
      setPipelineProducts(nextProducts);
      setSelectedProductId(current => current || nextProducts[0]?.id || "");
    } catch (error) {
      if ((error as Error).name !== "AbortError") setProductsError(error instanceof Error ? error.message : "Could not load Pipeline products.");
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    const storageTimer = window.setTimeout(() => {
      const storedCatalog = parseDashboardCatalogStore(window.localStorage.getItem(PPC_DASHBOARD_CATALOG_STORAGE_KEY));
      setReports(parsePpcDashboardStore(window.localStorage.getItem(PPC_DASHBOARD_STORAGE_KEY)).reports);
      setCatalog(storedCatalog);
      cacheRef.current = parsePerformanceCache(window.localStorage.getItem(PPC_PERFORMANCE_CACHE_KEY));
      setPerformanceCache(cacheRef.current);
      setCacheReady(true);
      setSelectedProductId(current => current || storedCatalog.customProducts[0]?.id || "");
    }, 0);
    const controller = new AbortController();
    const productTimer = window.setTimeout(() => void loadProducts(controller.signal), 0);
    return () => { window.clearTimeout(storageTimer); window.clearTimeout(productTimer); controller.abort(); };
  }, [loadProducts]);

  useEffect(() => {
    if (dirtyReportKeys.size === 0) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [dirtyReportKeys.size]);

  useEffect(() => {
    if (dirtyReportKeys.size === 0) return;
    const pendingKeys = [...dirtyReportKeys];
    const pendingReports = Object.fromEntries(
      pendingKeys.flatMap(key => reports[key] ? [[key, reports[key]]] : []),
    ) as Record<string, WeeklyPpcReport>;

    const autoSaveTimer = window.setTimeout(() => {
      try {
        const savedAt = new Date().toISOString();
        const storedReports = parsePpcDashboardStore(window.localStorage.getItem(PPC_DASHBOARD_STORAGE_KEY)).reports;
        const savedReports = Object.fromEntries(
          Object.entries(pendingReports).map(([key, pendingReport]) => [key, { ...pendingReport, updatedAt: savedAt }]),
        ) as Record<string, WeeklyPpcReport>;

        window.localStorage.setItem(PPC_DASHBOARD_STORAGE_KEY, JSON.stringify({
          version: 1,
          reports: { ...storedReports, ...savedReports },
        }));
        setReports(current => ({ ...current, ...savedReports }));
        setDirtyReportKeys(current => {
          const next = new Set(current);
          pendingKeys.forEach(key => next.delete(key));
          return next;
        });
        setSaveNotice("Changes saved automatically");
      } catch {
        setSaveNotice("Auto-save failed — use Save Changes");
      }
    }, AUTO_SAVE_DELAY_MS);

    return () => window.clearTimeout(autoSaveTimer);
  }, [dirtyReportKeys, reports]);

  useEffect(() => {
    if (!monthPickerOpen && !goalHistoryOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMonthPickerOpen(false);
      setGoalHistoryOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [goalHistoryOpen, monthPickerOpen]);

  const products = useMemo(() => mergeDashboardProducts(pipelineProducts, catalog), [catalog, pipelineProducts]);
  const weekStarts = useMemo(() => getSelectedMonthWeekStarts(selectedMonths, currentWeekStart), [currentWeekStart, selectedMonths]);
  const reportingMonthLabel = useMemo(() => formatReportingMonthRange(weekStarts), [weekStarts]);
  const activeWeekStart = weekStarts.includes(selectedWeekStart) ? selectedWeekStart : weekStarts[0] ?? selectedWeekStart;
  const selectedProduct = products.find(product => product.id === selectedProductId) ?? null;
  const selectedProductTag = selectedProduct ? catalog.tags.find(tag => tag.id === selectedProduct.tagId) ?? null : null;
  const selectedKey = selectedProductId && activeWeekStart ? reportKey(selectedProductId, activeWeekStart) : "";
  const selectedAsin = selectedProduct?.asin?.trim() || "";
  const snapshotKey = performanceCacheKey(selectedAsin, activeWeekStart);
  const cachedPerformance = performanceCache[snapshotKey];
  const goalDataState: GoalDataState | null = cachedPerformance
    ? cachedPerformance.endDate >= addDaysIso(activeWeekStart, 6) ? "Final" : "Partial"
    : null;
  const dirty = selectedKey ? dirtyReportKeys.has(selectedKey) : false;
  const previousWeekStart = addDaysIso(activeWeekStart, -7);
  const previousDraft = selectedProductId && activeWeekStart ? reports[reportKey(selectedProductId, previousWeekStart)] ?? null : null;
  const previousSnapshot = performanceCache[performanceCacheKey(selectedAsin, previousWeekStart)];
  const previousReport = previousSnapshot && selectedProductId
    ? { ...(previousDraft ?? createWeeklyPpcReport(selectedProductId, previousWeekStart)), ...previousSnapshot.metrics }
    : previousDraft;
  const savedReport = selectedKey ? reports[selectedKey] ?? createWeeklyPpcReport(selectedProductId, activeWeekStart, previousReport) : null;
  const report = savedReport && cachedPerformance ? { ...savedReport, ...cachedPerformance.metrics } : savedReport;
  const chatPeriods: PerformanceChatPeriod[] = [...new Set([activeWeekStart, previousWeekStart, ...weekStarts])].slice(0, 60).flatMap(weekStart => {
    if (weekStart === activeWeekStart && report) return [{ weekStart, dataState: goalDataState, report }];
    const storedReport = selectedProductId ? reports[reportKey(selectedProductId, weekStart)] : null;
    const snapshot = performanceCache[performanceCacheKey(selectedAsin, weekStart)];
    if (!storedReport && !snapshot) return [];
    const periodReport = { ...(storedReport ?? createWeeklyPpcReport(selectedProductId, weekStart)), ...(snapshot?.metrics ?? {}) };
    const dataState: GoalDataState | null = snapshot ? snapshot.endDate >= addDaysIso(weekStart, 6) ? "Final" : "Partial" : null;
    return [{ weekStart, dataState, report: periodReport }];
  });
  const carryForwardResult = report?.previousWeekResult || previousReport?.previousWeekResult || "";
  const budgetHistoryPageCount = Math.max(1, Math.ceil((report?.budgetHistory.length ?? 0) / BUDGET_HISTORY_PAGE_SIZE));
  const budgetHistoryPage = budgetHistoryView.key === selectedKey ? Math.min(budgetHistoryView.page, budgetHistoryPageCount) : 1;
  const visibleBudgetHistory = report?.budgetHistory.slice((budgetHistoryPage - 1) * BUDGET_HISTORY_PAGE_SIZE, budgetHistoryPage * BUDGET_HISTORY_PAGE_SIZE) ?? [];
  const productGoalHistory = useMemo(() => Object.values(reports)
    .filter(candidate => candidate.productId === selectedProductId)
    .flatMap(candidate => candidate.goalHistory.map(goal => ({ ...goal, weekStart: candidate.weekStart })))
    .sort((first, second) => second.resolvedAt.localeCompare(first.resolvedAt)), [reports, selectedProductId]);
  const displayedPerformanceLoad: PerformanceLoadState = !selectedKey
    ? { key: "", status: "idle", message: "", warnings: [] }
    : !selectedAsin
      ? { key: selectedKey, status: "idle", message: "Add an ASIN to retrieve Scale Insights performance.", warnings: [] }
      : performanceLoad.key === snapshotKey
        ? performanceLoad
        : cachedPerformance
          ? { key: snapshotKey, status: "ready", message: `Saved Scale Insights data through ${cachedPerformance.freshness.salesDataThrough || cachedPerformance.endDate}. Refresh to update.`, warnings: cachedPerformance.warnings }
        : { key: selectedKey, status: "loading", message: "Retrieving Scale Insights performance…", warnings: [] };
  const importedMetricsLocked = !!cachedPerformance || displayedPerformanceLoad.status === "ready";
  const budgetUsage = report ? percentage(report.spend, report.weeklyBudget) : 0;
  const budgetBalance = report ? report.weeklyBudget - report.spend : 0;
  const isOverspent = budgetBalance < 0;
  const isAcosAboveTarget = Boolean(report && report.targetAcos > 0 && report.acos > report.targetAcos);

  useEffect(() => {
    if (!cacheReady || !selectedKey || !selectedAsin) return;
    const controller = new AbortController();
    const requestTimer = window.setTimeout(() => {
      const forceActiveRefresh = refreshRequest.current === snapshotKey;
      if (forceActiveRefresh) refreshRequest.current = "";

      const activeCached = cacheRef.current[snapshotKey];
      if (activeCached && !forceActiveRefresh) {
        setPerformanceLoad({ key: snapshotKey, status: "ready", message: `Saved Scale Insights data through ${activeCached.freshness.salesDataThrough || activeCached.endDate}. Refresh to update.`, warnings: activeCached.warnings });
      } else {
        setPerformanceLoad({ key: snapshotKey, status: "loading", message: "Retrieving Scale Insights performance…", warnings: [] });
      }

      const orderedWeeks = [activeWeekStart, ...weekStarts.filter(weekStart => weekStart !== activeWeekStart)];
      const pendingWeeks = orderedWeeks.filter(weekStart => {
        const key = performanceCacheKey(selectedAsin, weekStart);
        return (weekStart === activeWeekStart && forceActiveRefresh) || !cacheRef.current[key];
      });
      let nextWeekIndex = 0;

      const fetchNextWeek = async () => {
        while (!controller.signal.aborted) {
          const weekStart = pendingWeeks[nextWeekIndex];
          nextWeekIndex += 1;
          if (!weekStart) return;
          const key = performanceCacheKey(selectedAsin, weekStart);
          const isActiveWeek = weekStart === activeWeekStart;
          const query = new URLSearchParams({ asin: selectedAsin, country: "US", weekStart });

          try {
            const response = await fetch(withPpcBasePath(`/api/dashboard/performance?${query}`), {
              headers: getPipelineAuthorizationHeader(), cache: "no-store", signal: controller.signal,
            });
            const value: unknown = await response.json();
            if (controller.signal.aborted) return;
            if (response.status === 409 && value && typeof value === "object") {
              const candidate = value as { authorizationRequired?: unknown; authorizationUrl?: unknown };
              if (candidate.authorizationRequired === true && typeof candidate.authorizationUrl === "string") {
                const authorizationUrl = new URL(candidate.authorizationUrl);
                if (authorizationUrl.protocol === "https:" && (authorizationUrl.hostname === "vercel.com" || authorizationUrl.hostname.endsWith(".vercel.com"))) {
                  if (isActiveWeek) {
                    setPerformanceLoad({
                      key: snapshotKey,
                      status: "authorization",
                      message: "Connect Scale Insights once to retrieve weekly performance.",
                      warnings: [],
                      authorizationUrl: authorizationUrl.toString(),
                    });
                  }
                  continue;
                }
              }
            }
            if (!response.ok || !value || typeof value !== "object") {
              const message = value && typeof value === "object" && typeof (value as { error?: unknown }).error === "string"
                ? String((value as { error: string }).error)
                : "Scale Insights performance is unavailable.";
              throw new Error(message);
            }
            const performance = parsePerformanceSnapshot((value as { performance?: unknown }).performance);
            if (!performance?.metrics || performance.asin !== selectedAsin.toUpperCase() || performance.startDate !== weekStart) {
              throw new Error("Scale Insights returned an invalid performance response.");
            }

            if (isActiveWeek) {
              setReports(current => {
                const currentReport = current[selectedKey] ?? createWeeklyPpcReport(selectedProductId, activeWeekStart, current[reportKey(selectedProductId, addDaysIso(activeWeekStart, -7))]);
                return { ...current, [selectedKey]: withCalculatedPerformance({ ...currentReport, ...performance.metrics }) };
              });
            }

            const nextCache = { ...cacheRef.current, [key]: performance };
            cacheRef.current = nextCache;
            setPerformanceCache(nextCache);
            let storageWarning = "";
            try {
              window.localStorage.setItem(PPC_PERFORMANCE_CACHE_KEY, JSON.stringify({ version: 1, entries: nextCache }));
            } catch { storageWarning = "This browser could not save these metrics. They will be lost when you close or reload the page."; }

            if (isActiveWeek) {
              const through = performance.freshness.salesDataThrough || performance.endDate;
              setPerformanceLoad({ key: snapshotKey, status: "ready", message: `Scale Insights synced through ${through}.`, warnings: [...performance.warnings, ...(storageWarning ? [storageWarning] : [])] });
            }
          } catch (error) {
            if (isActiveWeek && !controller.signal.aborted && (error as Error).name !== "AbortError") {
              setPerformanceLoad({ key: snapshotKey, status: "error", message: error instanceof Error ? error.message : "Scale Insights performance is unavailable.", warnings: cacheRef.current[snapshotKey] ? ["Refresh failed. Previously saved metrics are still displayed."] : [] });
            }
          }
        }
      };

      if (pendingWeeks.length) {
        const workerCount = Math.min(PERFORMANCE_BACKFILL_CONCURRENCY, pendingWeeks.length);
        void Promise.all(Array.from({ length: workerCount }, () => fetchNextWeek()));
      }
    }, 0);
    return () => { window.clearTimeout(requestTimer); controller.abort(); };
  }, [activeWeekStart, cacheReady, performanceRefresh, selectedAsin, selectedKey, selectedProductId, snapshotKey, weekStarts]);

  const replaceReport = (nextReport: WeeklyPpcReport) => {
    if (!selectedKey) return;
    setReports(current => ({ ...current, [selectedKey]: nextReport }));
    setDirtyReportKeys(current => new Set(current).add(selectedKey));
    setSaveNotice("Saving changes…");
  };
  const patchReport = (patch: Partial<WeeklyPpcReport>) => { if (report) replaceReport(withCalculatedPerformance({ ...report, ...patch })); };
  const selectProduct = (productId: string) => { setSelectedProductId(productId); setSaveNotice(""); };
  const selectWeek = (weekStart: string) => { setSelectedWeekStart(weekStart); setSaveNotice(""); };
  const commitSelectedMonths = (monthKeys: string[]) => {
    const nextMonths = [...new Set(monthKeys)].sort();
    const nextWeekStarts = getSelectedMonthWeekStarts(nextMonths, currentWeekStart);
    setSelectedMonths(nextMonths);
    setSelectedWeekStart(current => nextWeekStarts.includes(current) ? current : nextWeekStarts[0] ?? current);
  };
  const shiftReportingMonths = (months: number) => commitSelectedMonths(selectedMonths.map(monthKey => addMonthsIso(`${monthKey}-01`, months).slice(0, 7)));
  const openMonthPicker = () => {
    setMonthPickerYear(Number(selectedMonths.at(-1)?.slice(0, 4) || initialToday.slice(0, 4)));
    setDraftSelectedMonths(selectedMonths);
    setMonthPickerOpen(true);
  };
  const toggleDraftMonth = (monthIndex: number) => {
    const monthKey = `${monthPickerYear}-${String(monthIndex + 1).padStart(2, "0")}`;
    setDraftSelectedMonths(current => current.includes(monthKey) ? current.filter(candidate => candidate !== monthKey) : [...current, monthKey].sort());
  };
  const selectPickerYear = () => setDraftSelectedMonths(current => [...new Set([
    ...current,
    ...MONTH_NAMES.map((_, monthIndex) => `${monthPickerYear}-${String(monthIndex + 1).padStart(2, "0")}`),
  ])].sort());
  const applySelectedMonths = () => {
    if (!draftSelectedMonths.length) return;
    commitSelectedMonths(draftSelectedMonths);
    setMonthPickerOpen(false);
  };

  const finishBudgetEdit = (rawValue: string) => {
    if (!report || !selectedKey) return;
    const to = numericValue(rawValue);
    const from = budgetEditStartRef.current?.key === selectedKey ? budgetEditStartRef.current.value : report.weeklyBudget;
    budgetEditStartRef.current = null;
    if (from === to) return;
    const suffix = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : String(Date.now());
    patchReport({
      weeklyBudget: to,
      dailyBudget: dailyLimitFromWeekly(to),
      budgetHistory: [{ id: `budget-change-${suffix}`, changedAt: new Date().toISOString(), from, to }, ...report.budgetHistory].slice(0, 100),
    });
    setBudgetHistoryView({ key: selectedKey, page: 1 });
  };

  const persistCatalog = (nextCatalog: DashboardCatalogStore) => {
    try {
      window.localStorage.setItem(PPC_DASHBOARD_CATALOG_STORAGE_KEY, JSON.stringify(nextCatalog));
      setCatalog(nextCatalog);
      return "";
    } catch {
      return "This browser could not save the product catalog. Remove a large image or free browser storage and try again.";
    }
  };
  const createTag = (name: string) => {
    const existing = catalog.tags.find(tag => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (existing) return { id: existing.id, error: "" };
    const suffix = typeof crypto.randomUUID === "function" ? crypto.randomUUID().slice(0, 8) : String(Date.now());
    const tag = { id: createDashboardTagId(name, suffix), name: name.trim().slice(0, 40) };
    const error = persistCatalog({ ...catalog, tags: [...catalog.tags, tag] });
    return { id: error ? "" : tag.id, error };
  };
  const saveProduct = (value: ProductFormValue) => {
    if (!value.id) {
      const suffix = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const product: DashboardCatalogProduct = { id: `dashboard-${suffix}`, source: "dashboard", stageId: "dashboard", status: "Active", name: value.name, asin: value.asin, sku: value.sku, tagId: value.tagId, imageDataUrl: value.imageDataUrl };
      const error = persistCatalog({ ...catalog, customProducts: [product, ...catalog.customProducts], productOrderIds: [product.id, ...products.map(existing => existing.id)] });
      if (error) return error;
      selectProduct(product.id);
      return "";
    }
    if (value.source === "dashboard") {
      return persistCatalog({ ...catalog, customProducts: catalog.customProducts.map(product => product.id === value.id ? { ...product, name: value.name, asin: value.asin, sku: value.sku, tagId: value.tagId, imageDataUrl: value.imageDataUrl } : product) });
    }
    return persistCatalog({ ...catalog, productOverrides: { ...catalog.productOverrides, [value.id]: { name: value.name, asin: value.asin, sku: value.sku, tagId: value.tagId, imageDataUrl: value.imageDataUrl } } });
  };
  const deleteProduct = (product: ManagedDashboardProduct) => {
    const nextCatalog = product.source === "dashboard"
      ? { ...catalog, customProducts: catalog.customProducts.filter(candidate => candidate.id !== product.id) }
      : { ...catalog, hiddenPipelineProductIds: [...new Set([...catalog.hiddenPipelineProductIds, product.id])] };
    persistCatalog(nextCatalog);
    if (selectedProductId === product.id) selectProduct(products.find(candidate => candidate.id !== product.id)?.id ?? "");
  };
  const reorderProducts = (sourceId: string, targetId: string, visibleIds: string[]) => persistCatalog({
    ...catalog,
    productOrderIds: reorderVisibleProducts(products.map(product => product.id), visibleIds, sourceId, targetId),
  });

  const updateGoal = (goalId: string, patch: Partial<WeeklyGoal>) => {
    if (report) patchReport({ goals: report.goals.map(goal => goal.id === goalId ? { ...goal, ...patch } : goal) });
  };
  const addGoal = () => {
    if (!report) return;
    patchReport({ goals: [...report.goals, { id: `goal-${Date.now()}`, title: "Choose goal", target: "", actual: "", status: "On Track" }] });
  };
  const resolveGoal = (goalId: string, status: GoalOutcome) => {
    if (!report) return;
    const goal = report.goals.find(candidate => candidate.id === goalId);
    if (!goal) return;
    const actual = goalDataState ? formatWeeklyGoalValue(goal, weeklyGoalActualValue(goal, report)) : "";
    patchReport({
      goals: report.goals.filter(candidate => candidate.id !== goalId),
      goalHistory: [{ ...goal, actual, status, resolvedAt: new Date().toISOString(), ...(goalDataState ? { dataState: goalDataState } : {}) }, ...report.goalHistory].slice(0, 100),
    });
  };
  const removeGoal = (goalId: string) => { if (report) patchReport({ goals: report.goals.filter(goal => goal.id !== goalId) }); };
  const updateAction = (actionId: string, patch: Partial<ActionItem>) => {
    if (report) patchReport({ actions: report.actions.map(action => action.id === actionId ? { ...action, ...patch } : action) });
  };
  const addAction = () => {
    if (!report) return;
    patchReport({ actions: [...report.actions, { id: `action-${Date.now()}`, title: "New action item", priority: "Medium", dueDate: "", done: false }] });
  };
  const removeAction = (actionId: string) => { if (report) patchReport({ actions: report.actions.filter(action => action.id !== actionId) }); };

  const saveReport = () => {
    if (!report || !selectedKey) return;
    const saved = { ...report, status: "Completed" as const, updatedAt: new Date().toISOString() };
    const storedReports = parsePpcDashboardStore(window.localStorage.getItem(PPC_DASHBOARD_STORAGE_KEY)).reports;
    window.localStorage.setItem(PPC_DASHBOARD_STORAGE_KEY, JSON.stringify({ version: 1, reports: { ...storedReports, [selectedKey]: saved } }));
    setReports(current => ({ ...current, [selectedKey]: saved }));
    setDirtyReportKeys(current => { const next = new Set(current); next.delete(selectedKey); return next; });
    setSaveNotice("Weekly report saved");
  };

  return <section className={styles.dashboard} aria-label="Weekly PPC Performance Notes">
    <ProductPortfolioPanel products={products} tags={catalog.tags} loading={productsLoading} error={productsError} selectedProductId={selectedProductId} onSelectProduct={selectProduct} onRetry={() => void loadProducts()} onCreateTag={createTag} onSaveProduct={saveProduct} onDeleteProduct={deleteProduct} onReorderProducts={reorderProducts} />

    <aside className={styles.periodsPanel} aria-labelledby="periods-heading">
      <div className={styles.panelHeader}>
        <div className={styles.headingRow}><div><span className={styles.eyebrow}>TIMELINE</span><h2 id="periods-heading">Reporting Periods</h2></div></div>
        <div className={styles.monthPickerRow}><div className={styles.monthPicker} role="group" aria-label="Month navigation"><button type="button" aria-label="Previous selected month range" onClick={() => shiftReportingMonths(-1)}><ArrowLeft /></button><strong>{reportingMonthLabel}</strong><button type="button" aria-label="Next selected month range" onClick={() => shiftReportingMonths(1)}><ArrowRight /></button></div><button type="button" className={styles.calendarPickerButton} aria-label={`Choose reporting months, ${reportingMonthLabel}`} onClick={openMonthPicker}><CalendarDays aria-hidden="true" /></button></div>
      </div>
      <div className={styles.periodList} aria-label="Reporting periods">{weekStarts.map(weekStart => {
        const periodDraft = selectedProductId ? reports[reportKey(selectedProductId, weekStart)] : null;
        const periodSnapshot = performanceCache[performanceCacheKey(selectedAsin, weekStart)];
        const periodReport = periodSnapshot ? { ...periodDraft, ...periodSnapshot.metrics } : periodDraft;
        const periodStatus = periodReport?.status ?? "Draft";
        const isCurrent = weekStart === currentWeekStart;
        const isSelected = weekStart === activeWeekStart;
        return <button type="button" key={weekStart} aria-pressed={isSelected} className={`${styles.periodCard} ${isSelected ? styles.selectedPeriod : ""}`} onClick={() => selectWeek(weekStart)}>
          {isCurrent ? <span className={styles.currentBadge}>Current</span> : null}
          <span className={styles.periodTop}><strong>{formatWeekRange(weekStart)}</strong><span className={styles.periodMeta}><small>Week {getIsoWeekNumber(weekStart)}</small>{periodStatus === "Draft" ? null : <i className={statusTone(periodStatus)}>{periodStatus}</i>}</span></span>
          <span className={styles.periodStats}><span><small>Spend</small><strong>{currency(periodReport?.spend ?? 0)}</strong></span><span><small>PPC Sales</small><strong>{currency(periodReport?.ppcSales ?? 0)}</strong></span><span><small>PPC Order</small><strong>{periodReport?.ppcOrders ?? 0}</strong></span><span><small>ACOS</small><strong>{Math.round(periodReport?.acos ?? 0)}%</strong></span></span>
        </button>;
      })}</div>
    </aside>

    <main className={styles.workspace}>
      {!selectedProduct || !report ? <div className={styles.workspaceEmpty}><BarChart3 aria-hidden="true" /><h2>Select a product</h2><p>Choose a Pipeline product to start its weekly PPC documentation.</p></div> : <>
        <header className={styles.workspaceHeader}>
          <div className={styles.workspaceProduct}>{selectedProduct.imageDataUrl ? <span className={styles.workspaceProductImage}><Image src={selectedProduct.imageDataUrl} alt={`${selectedProduct.name} product`} width={62} height={62} unoptimized /></span> : null}<div><span className={styles.eyebrow}>WEEKLY PPC PERFORMANCE</span><div className={styles.titleRow}><h2>{selectedProduct.name}</h2>{selectedProductTag ? <span>{selectedProductTag.name}</span> : null}</div><p>ASIN: {selectedProduct.asin ? <a href={`https://www.amazon.com/dp/${encodeURIComponent(selectedProduct.asin)}`} target="_blank" rel="noopener noreferrer" aria-label={`Open selected product ASIN ${selectedProduct.asin} on Amazon`}>{selectedProduct.asin}</a> : <strong>N/A</strong>}<i />SKU: {selectedProduct.sku ? <a href={`https://sellercentral.amazon.com/myinventory/inventory?searchField=sku&searchTerm=${encodeURIComponent(selectedProduct.sku)}`} target="_blank" rel="noopener noreferrer" aria-label={`Open selected product SKU ${selectedProduct.sku} in Seller Central`}>{selectedProduct.sku}</a> : <strong>N/A</strong>}</p></div></div>
          {selectedAsin ? <nav className={styles.asinNavigation} aria-label={`Scale Insights analysis for ASIN ${selectedAsin}`}>{PPC_ANALYSIS_COLUMNS.map(column => <div key={column.key} className={styles.asinNavigationColumn} role="group" aria-label={column.label}>{column.sections.map(section => <a key={section.slug} href={getScaleInsightsAnalysisHref(selectedAsin, section.slug, activeWeekStart, addDaysIso(activeWeekStart, 6))} target="_blank" rel="noopener noreferrer">{section.label}</a>)}</div>)}</nav> : null}
          <div className={styles.saveArea}><div><button type="button" className={styles.primaryButton} onClick={saveReport}><Save />{dirty ? "Save Changes" : "Weekly Report"}</button></div><small className={dirty ? styles.unsaved : styles.saved}>{dirty ? saveNotice || "Saving changes…" : saveNotice || (report.updatedAt ? `Saved ${new Date(report.updatedAt).toLocaleString()}` : "Not saved yet")}</small></div>
        </header>

        <div className={styles.workspaceScroll}>
          <div className={styles.twoColumn}>
            <section className={styles.card} aria-labelledby="goals-heading"><div className={styles.cardTitle}><h3 id="goals-heading"><Flag />Weekly Goals</h3><div className={styles.goalHeaderActions}><button type="button" onClick={() => setGoalHistoryOpen(true)}>Goal History</button><button type="button" onClick={addGoal}><Plus />Add Goal</button></div></div><div className={styles.goalList}>{report.goals.map(goal => <WeeklyGoalRow key={goal.id} goal={goal} report={report} dataState={goalDataState} onUpdate={patch => updateGoal(goal.id, patch)} onResolve={status => resolveGoal(goal.id, status)} onRemove={() => removeGoal(goal.id)} />)}</div></section>

            <section className={styles.card} aria-labelledby="budget-heading">
              <div className={styles.cardTitle}><h3 id="budget-heading"><DollarSign />Budget Tracking</h3></div>
              <div className={styles.budgetGrid}>
                <label><span>Weekly limit</span><span className={styles.moneyInput}><i>$</i><input aria-label="Weekly limit" inputMode="decimal" value={report.weeklyBudget || ""} placeholder="0" onFocus={() => { budgetEditStartRef.current = { key: selectedKey, value: report.weeklyBudget }; }} onChange={event => { const weeklyBudget = numericValue(event.target.value); patchReport({ weeklyBudget, dailyBudget: dailyLimitFromWeekly(weeklyBudget) }); }} onBlur={event => finishBudgetEdit(event.currentTarget.value)} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} /></span></label>
                <div><span>Daily limit</span><strong>{preciseCurrency(dailyLimitFromWeekly(report.weeklyBudget))}</strong></div>
                <label><span>Actual spend</span><span className={styles.moneyInput}><i>$</i><input aria-label="Actual spend" aria-readonly={importedMetricsLocked || undefined} readOnly={importedMetricsLocked} inputMode="numeric" value={roundedMetricValue(report.spend)} placeholder="0" onChange={event => patchReport({ spend: numericValue(event.target.value) })} /></span></label>
                <div className={isOverspent ? styles.budgetOver : ""}><span>{isOverspent ? "Overspent" : "Remaining"}</span><strong>{currency(Math.abs(budgetBalance))}</strong></div>
              </div>
              <div className={styles.progressTrack} aria-label={`${budgetUsage}% of weekly budget used`}><span className={budgetUsage >= 100 ? styles.progressDanger : budgetUsage >= 80 ? styles.progressWarning : ""} style={{ width: `${Math.min(100, budgetUsage)}%` }} /></div><small>{budgetUsage}% of the weekly budget used</small>
              <div className={styles.budgetHistory}>
                <h4>Budget History</h4>
                <table aria-label="Budget change history">
                  <thead><tr><th>Date of Change</th><th>From</th><th>To</th></tr></thead>
                  <tbody>{visibleBudgetHistory.length ? visibleBudgetHistory.map(change => <tr key={change.id}><td>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(change.changedAt))}</td><td>{preciseCurrency(change.from)}</td><td>{preciseCurrency(change.to)}</td></tr>) : <tr><td colSpan={3}>No budget changes recorded yet.</td></tr>}</tbody>
                </table>
                {budgetHistoryPageCount > 1 ? <nav className={styles.budgetHistoryPagination} aria-label="Budget history pages">
                  <button type="button" aria-label="Previous budget history page" disabled={budgetHistoryPage === 1} onClick={() => setBudgetHistoryView({ key: selectedKey, page: budgetHistoryPage - 1 })}><ArrowLeft aria-hidden="true" /></button>
                  {Array.from({ length: budgetHistoryPageCount }, (_, index) => index + 1).map(page => <button type="button" key={page} aria-label={`Budget history page ${page}`} aria-current={page === budgetHistoryPage ? "page" : undefined} onClick={() => setBudgetHistoryView({ key: selectedKey, page })}>{page}</button>)}
                  <button type="button" aria-label="Next budget history page" disabled={budgetHistoryPage === budgetHistoryPageCount} onClick={() => setBudgetHistoryView({ key: selectedKey, page: budgetHistoryPage + 1 })}><ArrowRight aria-hidden="true" /></button>
                </nav> : null}
              </div>
            </section>
          </div>

<section className={styles.card} aria-labelledby="metrics-heading"><div className={styles.cardTitle}><div className={styles.performanceHeading}><h3 id="metrics-heading"><BarChart3 />Weekly Performance</h3><label className={styles.targetAcosField}><span>Target ACOS</span><span><input aria-label="Target ACOS" inputMode="decimal" value={report.targetAcos || ""} placeholder="0" onChange={event => patchReport({ targetAcos: numericValue(event.target.value) })} /><i>%</i></span></label></div><div className={styles.performanceSync}><span role="status" className={displayedPerformanceLoad.status === "error" ? styles.performanceError : ""}>{displayedPerformanceLoad.message}</span>{displayedPerformanceLoad.authorizationUrl ? <a href={displayedPerformanceLoad.authorizationUrl}>Connect Scale Insights</a> : null}<button type="button" disabled={displayedPerformanceLoad.status === "loading" || !selectedAsin} onClick={() => { refreshRequest.current = snapshotKey; setPerformanceRefresh(value => value + 1); }}><RefreshCw aria-hidden="true" />Refresh</button></div></div>{displayedPerformanceLoad.warnings.length ? <ul className={styles.performanceWarnings}>{displayedPerformanceLoad.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : null}<div className={styles.metricsGroups}>{METRIC_GROUPS.map(group => <section className={styles.metricGroup} key={group.title} aria-label={`${group.title} metrics`}><h4>{group.title === "Sales" ? <DollarSign aria-hidden="true" /> : group.title === "Orders" ? <ShoppingCart aria-hidden="true" /> : <SlidersHorizontal aria-hidden="true" />}{group.displayTitle}</h4><div className={styles.metricGroupGrid}>{group.metrics.map(metric => <MetricInput key={metric.field} metric={metric} report={report} previousValue={previousReport?.[metric.field]} importedLocked={importedMetricsLocked} warning={metric.field === "acos" && isAcosAboveTarget} targetAcos={metric.field === "acos" ? report.targetAcos : undefined} onChange={(field, value) => patchReport({ [field]: value })} />)}</div></section>)}</div></section>

          <div className={styles.twoColumn}>
            <section className={styles.card} aria-labelledby="previous-heading"><div className={styles.cardTitle}><h3 id="previous-heading"><CheckCircle2 />Previous Week Result</h3></div>{previousReport ? <div className={styles.previousSummary}>{previousReport.status === "Draft" ? null : <span className={statusTone(previousReport.status)}>{previousReport.status}</span>}<p>{previousReport.previousWeekResult || previousReport.notes || "No outcome summary was entered."}</p></div> : null}<FormattedTextarea label="Carry-forward result and lessons" value={carryForwardResult} onChange={previousWeekResult => patchReport({ previousWeekResult })} placeholder="What goal was achieved or missed, why, and what should carry into this week?" /></section>
            <section className={styles.card} aria-labelledby="notes-heading"><div className={styles.cardTitle}><h3 id="notes-heading"><FileText />Weekly Summary & Notes</h3></div><FormattedTextarea label="Performance documentation" value={report.notes} onChange={notes => patchReport({ notes })} placeholder="Executive summary, wins, underperformance, bid changes, negative keywords, learnings, and priorities for next week..." /></section>
          </div>

          <section className={styles.card} aria-labelledby="actions-heading"><div className={styles.cardTitle}><h3 id="actions-heading"><ClipboardList />Next-Week Action Plan</h3><button type="button" onClick={addAction}><Plus />Add Item</button></div><div className={styles.actionList}>{report.actions.map(action => <div className={styles.actionRow} key={action.id}><button type="button" className={action.done ? styles.actionDone : ""} aria-label={action.done ? `Mark ${action.title} incomplete` : `Mark ${action.title} complete`} onClick={() => updateAction(action.id, { done: !action.done })}>{action.done ? <Check /> : null}</button><input aria-label="Action item" value={action.title} onChange={event => updateAction(action.id, { title: event.target.value })} /><select aria-label={`${action.title} priority`} className={priorityTone(action.priority)} value={action.priority} onChange={event => updateAction(action.id, { priority: event.target.value as ActionItem["priority"] })}><option>High</option><option>Medium</option><option>Low</option></select><button type="button" aria-label={`Remove ${action.title}`} onClick={() => removeAction(action.id)}><Trash2 /></button></div>)}</div></section>
        </div>
      </>}
    </main>

    {selectedProduct && report ? <ProductPerformanceChat product={selectedProduct} activeWeekStart={activeWeekStart} periods={chatPeriods} /> : null}

    {monthPickerOpen ? <div className={styles.monthDialogBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) setMonthPickerOpen(false); }}>
      <section className={styles.monthDialog} role="dialog" aria-modal="true" aria-labelledby="month-dialog-heading">
        <header><div><span className={styles.eyebrow}>REPORTING PERIOD</span><h2 id="month-dialog-heading">Choose months</h2><p>Select every month you want to display. Boundary weeks are included.</p></div><button type="button" aria-label="Close month picker" onClick={() => setMonthPickerOpen(false)}><X aria-hidden="true" /></button></header>
        <div className={styles.monthDialogYear}><button type="button" aria-label="Previous year" onClick={() => setMonthPickerYear(year => year - 1)}><ArrowLeft aria-hidden="true" /></button><strong>{monthPickerYear}</strong><button type="button" aria-label="Next year" onClick={() => setMonthPickerYear(year => year + 1)}><ArrowRight aria-hidden="true" /></button></div>
        <div className={styles.monthGrid}>{MONTH_NAMES.map((monthName, monthIndex) => {
          const monthValue = `${monthPickerYear}-${String(monthIndex + 1).padStart(2, "0")}`;
          const isSelectedMonth = draftSelectedMonths.includes(monthValue);
          const isCurrentMonth = initialToday.startsWith(monthValue);
          return <button type="button" key={monthName} className={`${styles.monthOption} ${isSelectedMonth ? styles.monthOptionSelected : ""} ${isCurrentMonth ? styles.monthOptionCurrent : ""}`} aria-label={`${monthName} ${monthPickerYear}`} aria-pressed={isSelectedMonth} aria-current={isCurrentMonth ? "date" : undefined} onClick={() => toggleDraftMonth(monthIndex)}><span>{monthName}</span>{isCurrentMonth ? <small>Current</small> : null}</button>;
        })}</div>
        <footer className={styles.monthDialogFooter}><span>{draftSelectedMonths.length} month{draftSelectedMonths.length === 1 ? "" : "s"} selected</span><div><button type="button" onClick={() => setDraftSelectedMonths([])}>Clear</button><button type="button" onClick={selectPickerYear}>Select {monthPickerYear}</button><button type="button" className={styles.applyMonths} disabled={!draftSelectedMonths.length} onClick={applySelectedMonths}>Apply months</button></div></footer>
      </section>
    </div> : null}
    {goalHistoryOpen ? <div className={styles.monthDialogBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) setGoalHistoryOpen(false); }}>
      <section className={styles.goalHistoryDialog} role="dialog" aria-modal="true" aria-labelledby="goal-history-heading">
        <header><div><span className={styles.eyebrow}>WEEKLY GOALS</span><h2 id="goal-history-heading">Goal History</h2><p>Achieved and missed goals for {selectedProduct?.name ?? "this product"}.</p></div><button type="button" aria-label="Close goal history" onClick={() => setGoalHistoryOpen(false)}><X aria-hidden="true" /></button></header>
        <div className={styles.goalHistoryList}>{productGoalHistory.length ? productGoalHistory.map(goal => <article key={`${goal.weekStart}:${goal.id}:${goal.resolvedAt}`}><div><strong>{goal.metric ? weeklyGoalLabel(goal.metric) : goal.title}</strong><small>{formatWeekRange(goal.weekStart)} · Target {formatWeeklyGoalTarget(goal) || "—"} · Actual {goal.actual || "—"}{goal.dataState ? ` · ${goal.dataState}` : ""}</small><small>Recorded {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(goal.resolvedAt))}</small></div><span className={statusTone(goal.status)}>{goal.status}</span></article>) : <p className={styles.goalHistoryEmpty}>No achieved or missed goals yet.</p>}</div>
      </section>
    </div> : null}
  </section>;
}
