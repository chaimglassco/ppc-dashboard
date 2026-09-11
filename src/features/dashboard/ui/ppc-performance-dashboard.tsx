"use client";

import Image from "next/image";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BarChart3, Bold, CalendarDays, Check, CheckCircle2, Clock3, Copy, DollarSign,
  FileText, Flag, Italic, Underline, List, ListOrdered, Plus, RefreshCw, Tag, SlidersHorizontal, Trash2, X,
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
  PPC_DASHBOARD_CATALOG_STORAGE_KEY, createDashboardTagId, emptyDashboardCatalog, mergeDashboardProducts, orderDashboardProductsByTag,
  parseDashboardCatalogStore, reorderVisibleProducts, type DashboardCatalogProduct, type DashboardCatalogStore, type ManagedDashboardProduct,
} from "../domain/ppc-dashboard-catalog";
import { ProductPortfolioPanel, type ProductFormValue } from "./product-portfolio-panel";
import { ProductPerformanceChat, type PerformanceChatPeriod } from "./product-performance-chat";
import { CampaignWeeklyComparison } from "./campaign-weekly-comparison";
import { PPC_PERFORMANCE_CACHE_KEY, parsePerformanceCache, parsePerformanceSnapshot, performanceCacheKey, type PerformanceCache } from "../domain/ppc-performance-cache";
import { getScaleInsightsAnalysisHref, PPC_ANALYSIS_COLUMNS } from "../domain/ppc-analysis-navigation";
import styles from "./ppc-performance-dashboard.module.css";
import periods from "./ppc-reporting-periods.module.css";
import ws from "./ppc-performance-workspace.module.css";

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
  return Number.isFinite(value) ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(Math.max(0, value))) : "0";
}

function formatPeriodCardRange(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
  const startMonth = month.format(start);
  const endMonth = month.format(end);
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  if (startYear !== endYear) return `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${endYear}`;
  if (startMonth === endMonth) return `${startMonth} ${startDay} – ${endDay}, ${endYear}`;
  return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${endYear}`;
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

function RadialGauge({ value, label }: { value: number; label: string }) {
  const circumference = 87.96;
  const progress = Math.min(100, Math.max(0, value));
  const dash = (progress / 100) * circumference;
  return <span className={ws.radialGauge} aria-hidden="true">
    <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="14" /><circle cx="18" cy="18" r="14" strokeDasharray={`${dash} ${circumference}`} /></svg>
    <strong>{label}</strong>
  </span>;
}

function MetricInput({ metric, report, previousValue, comparisonAvailable, importedLocked, warning, targetAcos, onChange }: { metric: MetricDefinition; report: WeeklyPpcReport; previousValue?: number; comparisonAvailable: boolean; importedLocked: boolean; warning?: boolean; targetAcos?: number; onChange: (field: MetricField, value: number) => void }) {
  const readOnly = Boolean(metric.calculated || (metric.imported && importedLocked));
  const displayValue = roundedMetricValue(report[metric.field]);
  const comparison = previousValue == null ? 0 : report[metric.field] - previousValue;
  const comparisonDirection = comparison > 0 ? "increased" : comparison < 0 ? "decreased" : "unchanged";
  const deltaPercentage = metricDeltaPercentage(report[metric.field], previousValue);
  const favorable = comparison !== 0 && (lowerIsBetter(metric.field) ? comparison < 0 : comparison > 0);
  const trendTone = comparison === 0 ? ws.metricNeutral : favorable ? ws.metricIncrease : ws.metricDecrease;
  const trendLabel = deltaPercentage == null ? "New" : `${deltaPercentage}%`;
  const targetDifference = warning && targetAcos ? Math.round(Math.max(0, report.acos - targetAcos)) : 0;
  const isEfficiency = metric.field === "acos" || metric.field === "tacos";
  const showSalesTrend = metric.field === "totalSales" && comparisonAvailable && previousValue != null && previousValue > 0;
  return <label className={`${ws.metricCard} ${isEfficiency ? ws.efficiencyMetric : ""}`} data-warning={warning || (isEfficiency && report.tacos >= 30) || undefined}>
    <span className={ws.metricCardHeader}><span>{metric.field === "spend" ? "Total Spend" : metric.field === "organicOrders" ? "Org. Orders" : metric.label}</span>{metric.field !== "totalSales" && comparisonAvailable && previousValue != null && comparison !== 0 ? <span className={`${ws.metricDelta} ${trendTone}`} aria-label={`${metric.label} ${comparisonDirection} by ${trendLabel} from previous week`}>{comparison > 0 ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}{trendLabel}</span> : null}</span>
    {isEfficiency ? <RadialGauge value={report[metric.field]} label={`${displayValue}%`} /> : null}
    <span className={ws.metricInputWrap}>{metric.prefix ? <i>{metric.prefix}</i> : null}<input aria-label={metric.label} aria-describedby={warning ? "acos-target-warning" : undefined} aria-readonly={readOnly || undefined} readOnly={readOnly} inputMode="numeric" size={Math.max(1, displayValue.length)} style={{ width: `${Math.max(1, displayValue.length)}ch` }} value={displayValue} placeholder="0" onChange={event => { if (!readOnly) onChange(metric.field, numericValue(event.target.value)); }} />{metric.suffix ? <i>{metric.suffix}</i> : null}</span>
    {warning ? <span id="acos-target-warning" className={ws.metricCardHint}>Target: {new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(targetAcos || 0)}% · +{targetDifference}% over limit</span> : metric.field === "tacos" ? <span className={ws.metricCardHint}>{report.tacos < 30 ? "Healthy" : "Above target"} · Target &lt; 30%</span> : showSalesTrend ? <span className={`${ws.salesCardTrend} ${trendTone}`} aria-label={`Sales ${comparisonDirection} by ${trendLabel} from previous week`}>{comparison >= 0 ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}Sales {comparison >= 0 ? "+" : "−"}{deltaPercentage}% WoW</span> : <span className={ws.metricCardHint} aria-hidden="true">&nbsp;</span>}
    <span className={ws.metricPreviousRow} aria-label={previousValue == null ? `Previous ${metric.label}: unavailable` : comparisonAvailable ? `Previous ${metric.label}: ${previousMetricValue(metric, previousValue)}, ${comparisonDirection}` : `Previous ${metric.label}: ${previousMetricValue(metric, previousValue)}`}>
      <small>Prev. Week</small>
      <strong>{previousValue == null ? "—" : previousMetricValue(metric, previousValue)}</strong>
    </span>
  </label>;
}

function CopyAsinButton({ asin }: { asin: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const resetTimer = useRef<number | null>(null);
  useEffect(() => () => { if (resetTimer.current != null) window.clearTimeout(resetTimer.current); }, []);
  const copyAsin = async () => {
    try {
      await navigator.clipboard.writeText(asin);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    if (resetTimer.current != null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setCopyState("idle"), 1_500);
  };
  const label = copyState === "copied" ? `Copied ASIN ${asin}` : copyState === "error" ? `Copy ASIN ${asin} failed` : `Copy ASIN ${asin}`;
  return <button type="button" className={ws.copyAsinButton} aria-label={label} title={copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy ASIN"} onClick={copyAsin}>
    {copyState === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
  </button>;
}

function ConversionRateCard({ value, previousValue, comparisonAvailable }: { value?: number; previousValue?: number; comparisonAvailable: boolean }) {
  const available = value != null;
  const formattedValue = available ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value)) : "—";
  const comparison = available && previousValue != null ? value - previousValue : 0;
  const comparisonDirection = comparison > 0 ? "increased" : comparison < 0 ? "decreased" : "unchanged";
  const deltaPercentage = available ? metricDeltaPercentage(value, previousValue) : null;
  const trendLabel = deltaPercentage == null ? "New" : `${deltaPercentage}%`;
  return <div className={ws.metricCard} aria-label={available ? `PPC Conversion Rate ${formattedValue}%` : "PPC Conversion Rate unavailable"}>
    <span className={ws.metricCardHeader}><span>PPC Conv. Rate</span>{comparisonAvailable && previousValue != null && comparison !== 0 ? <span className={`${ws.metricDelta} ${comparison > 0 ? ws.metricIncrease : ws.metricDecrease}`} aria-label={`PPC Conversion Rate ${comparisonDirection} by ${trendLabel} from previous week`}>{comparison > 0 ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}{trendLabel}</span> : null}</span>
    <strong className={ws.metricDisplayValue}>{formattedValue}{available ? "%" : ""}</strong>
    <span className={ws.metricCardHint}>{available ? "PPC orders ÷ PPC clicks" : "Waiting for Scale Insights clicks"}</span>
    <span className={ws.metricPreviousRow} aria-label={previousValue == null ? "Previous PPC Conversion Rate: unavailable" : comparisonAvailable ? `Previous PPC Conversion Rate: ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(previousValue))}%, ${comparisonDirection}` : `Previous PPC Conversion Rate: ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(previousValue))}%`}><small>Prev. Week</small><strong>{previousValue == null ? "—" : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(previousValue))}%`}</strong></span>
  </div>;
}

function WeeklyGoalRow({ goal, report, dataState, onUpdate, onResolve, onRemove }: { goal: WeeklyGoal; report: WeeklyPpcReport; dataState: GoalDataState | null; onUpdate: (patch: Partial<WeeklyGoal>) => void; onResolve: (status: GoalOutcome) => void; onRemove: () => void }) {
  const [targetEditing, setTargetEditing] = useState(false);
  const isCustomGoal = goal.custom === true || (!goal.metric && goal.title !== "Choose goal");
  const label = goal.metric ? weeklyGoalLabel(goal.metric) : goal.title || "Choose goal";
  const actualState = goal.metric ? dataState : null;
  const actualValue = weeklyGoalActualValue(goal, report);
  const actual = actualState ? formatWeeklyGoalValue(goal, actualValue) : "";
  const targetValue = numericValue(goal.target);
  const goalProgress = targetValue > 0 && actualValue != null
    ? Math.min(100, Math.round((actualValue / targetValue) * 100))
    : 0;
  const selectMetric = (selection: string) => {
    if (selection === "custom") {
      onUpdate({ metric: undefined, title: "Custom goal", unit: undefined, custom: true, target: "", actual: "" });
      return;
    }
    const metric = selection as WeeklyGoalMetric;
    onUpdate({ metric, title: weeklyGoalLabel(metric), unit: weeklyGoalUnit(metric), custom: undefined, target: "", actual: "" });
  };

  return <div className={ws.goalRow}>
    <div className={ws.goalDefinition}>
      <CheckCircle2 aria-hidden="true" /><label><span className={ws.srOnly}>Goal</span><select aria-label={`Goal metric ${goal.id}`} value={goal.metric ?? (isCustomGoal ? "custom" : "")} onChange={event => selectMetric(event.target.value)}><option value="" disabled>Choose goal</option><option value="custom">Custom Goal</option>{WEEKLY_GOAL_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      {goal.metric === "organicOrders" ? <label>Measure<select aria-label="Organic Order measurement" value={weeklyGoalUnit(goal.metric, goal.unit)} onChange={event => onUpdate({ unit: event.target.value as "number" | "percentage", target: "", actual: "" })}><option value="number">Number</option><option value="percentage">Percentage</option></select></label> : null}
      {isCustomGoal ? <label className={ws.customGoalName}>Goal text<input aria-label="Custom goal text" value={goal.title === "Custom goal" ? "" : goal.title} placeholder="Write your goal…" onChange={event => onUpdate({ title: event.target.value || "Custom goal" })} /></label> : null}
    </div>
    <div className={ws.goalProgress}><span><i style={{ width: `${goalProgress}%` }} /></span><div className={ws.goalInlineValues}><label><span>Target</span><input aria-label={`${label} target`} inputMode="decimal" value={targetEditing ? goal.target.replace(/[^0-9.-]/g, "") : formatWeeklyGoalTarget(goal)} placeholder="—" onFocus={() => setTargetEditing(true)} onBlur={() => setTargetEditing(false)} onChange={event => onUpdate({ target: event.target.value })} /></label><label><span>Actual</span><input aria-label={`${label} actual`} aria-readonly="true" readOnly value={actual} placeholder="—" /></label></div></div>
    <div className={ws.goalFooter}><small className={`${ws.goalDataState} ${actualState === "Final" ? ws.goalActualFinal : actualState === "Partial" ? ws.goalActualPartial : ws.goalActualWaiting}`}>{actualState ?? (goal.metric ? "Waiting" : isCustomGoal ? "Manual goal" : "Select goal")}</small><div className={ws.goalStatusActions}><select aria-label={`${label} status`} className={workspaceStatusTone(goal.status)} value={goal.status} onChange={event => onUpdate({ status: event.target.value as GoalStatus })}>{ACTIVE_GOAL_STATUSES.map(status => <option className={workspaceStatusTone(status)} key={status}>{status}</option>)}</select><div className={ws.goalOutcomeActions}><button type="button" aria-label={`Mark ${label} achieved`} title="Mark achieved" onClick={() => onResolve("Achieved")}><CheckCircle2 aria-hidden="true" /></button><button type="button" aria-label={`Mark ${label} missed`} title="Mark missed" onClick={() => onResolve("Missed")}><X aria-hidden="true" /></button><button type="button" aria-label={`Remove ${label}`} onClick={onRemove}><Trash2 aria-hidden="true" /></button></div></div></div>
  </div>;
}

function FormattedTextarea({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const applyFormat = (format: "bold" | "italic" | "underline" | "bullet" | "numbered") => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    let replacement = selected;
    let selectionStart = start;
    let selectionEnd = end;

    if (format === "bold" || format === "italic" || format === "underline") {
      const marker = format === "bold" ? "**" : format === "underline" ? "<u>" : "_";
      const content = selected || `${format} text`;
      replacement = `${marker}${content}${format === "underline" ? "</u>" : marker}`;
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

  return <div className={ws.textAreaLabel}><span className={ws.textAreaHeader}><span>{label}</span><span className={ws.formatToolbar} role="toolbar" aria-label={`${label} formatting`}>
    <button type="button" aria-label={`Bold ${label}`} onClick={() => applyFormat("bold")}><Bold aria-hidden="true" /></button>
    <button type="button" aria-label={`Italic ${label}`} onClick={() => applyFormat("italic")}><Italic aria-hidden="true" /></button>
    <button type="button" aria-label={`Underline ${label}`} onClick={() => applyFormat("underline")}><Underline aria-hidden="true" /></button>
    <button type="button" aria-label={`Bulleted list ${label}`} onClick={() => applyFormat("bullet")}><List aria-hidden="true" /></button>
    <button type="button" aria-label={`Numbered list ${label}`} onClick={() => applyFormat("numbered")}><ListOrdered aria-hidden="true" /></button>
  </span></span><textarea ref={textareaRef} className={ws.notesArea} aria-label={label} value={value} onChange={event => onChange(event.target.value)} onKeyDown={continueList} placeholder={placeholder} /></div>;
}

function statusTone(status: string) {
  if (status === "Completed" || status === "Achieved" || status === "On Track") return styles.success;
  if (status === "Needs Review" || status === "At Risk") return styles.warning;
  if (status === "Missed") return styles.danger;
  return styles.info;
}

function workspaceStatusTone(status: string) {
  if (status === "Completed" || status === "Achieved" || status === "On Track") return ws.success;
  if (status === "Needs Review" || status === "At Risk") return ws.warning;
  if (status === "Missed") return ws.danger;
  return ws.info;
}

function priorityTone(priority: ActionItem["priority"]) {
  if (priority === "High") return ws.priorityHigh;
  if (priority === "Low") return ws.priorityLow;
  return ws.priorityMedium;
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
    let nextProducts: DashboardProduct[] = [];
    try {
      const response = await fetch(withPpcBasePath("/api/dashboard/products"), { headers: getPipelineAuthorizationHeader(), cache: "no-store", signal });
      const value: unknown = await response.json();
      if (!response.ok || !value || typeof value !== "object") throw new Error("Could not load Pipeline products.");
      const candidates = (value as { products?: unknown }).products;
      nextProducts = Array.isArray(candidates) ? candidates as DashboardProduct[] : [];
      setPipelineProducts(nextProducts);
    } catch (error) {
      if ((error as Error).name !== "AbortError") setProductsError(error instanceof Error ? error.message : "Could not load Pipeline products.");
    } finally {
      const storedCatalog = parseDashboardCatalogStore(window.localStorage.getItem(PPC_DASHBOARD_CATALOG_STORAGE_KEY));
      const orderedProducts = orderDashboardProductsByTag(mergeDashboardProducts(nextProducts, storedCatalog), storedCatalog.tags);
      setSelectedProductId(current => current || orderedProducts[0]?.id || "");
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
        setSaveNotice("Auto-save failed — use Save");
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

  const products = useMemo(() => orderDashboardProductsByTag(mergeDashboardProducts(pipelineProducts, catalog), catalog.tags), [catalog, pipelineProducts]);
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
    ? withCalculatedPerformance({ ...(previousDraft ?? createWeeklyPpcReport(selectedProductId, previousWeekStart)), ...previousSnapshot.metrics, ppcClicks: previousSnapshot.metrics.ppcClicks })
    : previousDraft;
  const savedReport = selectedKey ? reports[selectedKey] ?? createWeeklyPpcReport(selectedProductId, activeWeekStart, previousReport) : null;
  const report = savedReport && cachedPerformance ? withCalculatedPerformance({ ...savedReport, ...cachedPerformance.metrics, ppcClicks: cachedPerformance.metrics.ppcClicks }) : savedReport;
  const chatPeriods: PerformanceChatPeriod[] = [...new Set([activeWeekStart, previousWeekStart, ...weekStarts])].slice(0, 60).flatMap(weekStart => {
    if (weekStart === activeWeekStart && report) return [{ weekStart, dataState: goalDataState, report }];
    const storedReport = selectedProductId ? reports[reportKey(selectedProductId, weekStart)] : null;
    const snapshot = performanceCache[performanceCacheKey(selectedAsin, weekStart)];
    if (!storedReport && !snapshot) return [];
    const periodReport = withCalculatedPerformance({ ...(storedReport ?? createWeeklyPpcReport(selectedProductId, weekStart)), ...(snapshot?.metrics ?? {}), ...(snapshot ? { ppcClicks: snapshot.metrics.ppcClicks } : {}) });
    const dataState: GoalDataState | null = snapshot ? snapshot.endDate >= addDaysIso(weekStart, 6) ? "Final" : "Partial" : null;
    return [{ weekStart, dataState, report: periodReport }];
  });
  const previousSummaryText = report?.previousWeekResult || previousReport?.previousWeekResult || previousReport?.notes || "";
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
  const currentPerformanceAvailable = Boolean(report && (importedMetricsLocked || METRIC_GROUPS.some(group => group.metrics.some(metric => report[metric.field] > 0))));
  const budgetUsage = report ? percentage(report.spend, report.weeklyBudget) : 0;
  const budgetBalance = report ? report.weeklyBudget - report.spend : 0;
  const isOverspent = budgetBalance < 0;
  const isAcosAboveTarget = Boolean(report && report.targetAcos > 0 && report.acos > report.targetAcos);
  const activeWeekDay = Math.min(7, Math.max(0, Math.floor((Date.parse(initialToday) - Date.parse(activeWeekStart)) / 86400000) + 1));
  const expectedBudgetUsage = Math.round((activeWeekDay / 7) * 100);
  const budgetPacingDelta = budgetUsage - expectedBudgetUsage;

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
                return { ...current, [selectedKey]: withCalculatedPerformance({ ...currentReport, ...performance.metrics, ppcClicks: performance.metrics.ppcClicks }) };
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

  return <section className={styles.dashboard} aria-label="Weekly PPC Performance Notes">
    <ProductPortfolioPanel products={products} tags={catalog.tags} loading={productsLoading} error={productsError} selectedProductId={selectedProductId} onSelectProduct={selectProduct} onRetry={() => void loadProducts()} onCreateTag={createTag} onSaveProduct={saveProduct} onDeleteProduct={deleteProduct} onReorderProducts={reorderProducts} />

    <aside className={periods.periodsPanel} aria-labelledby="periods-heading">
      <div className={periods.panelHeader}>
        <div className={periods.headingRow}><h2 id="periods-heading">Reporting Periods</h2><button type="button" className={periods.calendarPickerButton} aria-label={`Choose reporting months, ${reportingMonthLabel}`} onClick={openMonthPicker}><CalendarDays aria-hidden="true" /></button></div>
        <div className={periods.monthPicker} role="group" aria-label="Month navigation"><button type="button" aria-label="Previous selected month range" onClick={() => shiftReportingMonths(-1)}><ArrowLeft aria-hidden="true" /></button><strong>{reportingMonthLabel}</strong><button type="button" aria-label="Next selected month range" onClick={() => shiftReportingMonths(1)}><ArrowRight aria-hidden="true" /></button></div>
      </div>
      <div className={periods.periodList} aria-label="Reporting periods">{weekStarts.map(weekStart => {
        const periodDraft = selectedProductId ? reports[reportKey(selectedProductId, weekStart)] : null;
        const periodSnapshot = performanceCache[performanceCacheKey(selectedAsin, weekStart)];
        const periodReport = periodSnapshot ? { ...periodDraft, ...periodSnapshot.metrics } : periodDraft;
        const isCurrent = weekStart === currentWeekStart;
        const periodStatus = periodSnapshot
          ? periodSnapshot.endDate >= addDaysIso(weekStart, 6) ? "Completed" : "Partial"
          : isCurrent ? "Partial" : "Draft";
        const isSelected = weekStart === activeWeekStart;
        return <button type="button" key={weekStart} aria-label={`${formatWeekRange(weekStart)} reporting period`} aria-pressed={isSelected} className={`${periods.periodCard} ${isSelected ? periods.selectedPeriod : ""}`} onClick={() => selectWeek(weekStart)}>
          {isCurrent ? <span className={periods.currentBadge}>Current</span> : null}
          <span className={periods.periodTop}><span className={periods.periodIdentity}><strong>{formatPeriodCardRange(weekStart)}</strong><span className={periods.periodMeta}>{isCurrent ? <><small>Week {getIsoWeekNumber(weekStart)}</small><i aria-hidden="true" /><span><Clock3 aria-hidden="true" />In Review</span></> : selectedProductTag ? <span className={periods.productTag}><Tag aria-hidden="true" />{selectedProductTag.name}</span> : <small>Week {getIsoWeekNumber(weekStart)}</small>}</span></span><span className={`${periods.statusChip} ${periodStatus === "Partial" ? periods.partialStatus : ""}`}>{periodStatus}</span></span>
          <span className={periods.periodStats}><span><small>Spend</small><strong>{currency(periodReport?.spend ?? 0)}</strong></span><span><small>Sales</small><strong>{currency(periodReport?.ppcSales ?? 0)}</strong></span><span><small>Orders</small><strong>{periodReport?.ppcOrders ?? 0}</strong></span><span><small>ACoS</small><strong>{Math.round(periodReport?.acos ?? 0)}%</strong></span></span>
        </button>;
      })}</div>
    </aside>

    <main className={ws.workspace}>
      {!selectedProduct || !report ? <div className={ws.workspaceEmpty}><BarChart3 aria-hidden="true" /><h2>Select a product</h2><p>Choose a Pipeline product to start its weekly PPC documentation.</p></div> : <>
        <header className={ws.workspaceHeader}>
          <div className={ws.workspaceProduct}>{selectedProduct.imageDataUrl ? <span className={ws.workspaceProductImage}><Image src={selectedProduct.imageDataUrl} alt={`${selectedProduct.name} product`} width={44} height={44} unoptimized /></span> : null}<div><span className={ws.eyebrow}>WEEKLY PPC PERFORMANCE</span><div className={ws.titleRow}><h2>{selectedProduct.name}</h2></div><p className={ws.productIdentifiers}><span className={ws.asinIdentifier}>ASIN: {selectedProduct.asin ? <><a href={`https://www.amazon.com/dp/${encodeURIComponent(selectedProduct.asin)}`} target="_blank" rel="noopener noreferrer" aria-label={`Open selected product ASIN ${selectedProduct.asin} on Amazon`}>{selectedProduct.asin}</a><CopyAsinButton key={selectedProduct.asin} asin={selectedProduct.asin} /></> : <strong>N/A</strong>}</span><span>SKU: {selectedProduct.sku ? <a href={`https://sellercentral.amazon.com/myinventory/inventory?searchField=sku&searchTerm=${encodeURIComponent(selectedProduct.sku)}`} target="_blank" rel="noopener noreferrer" aria-label={`Open selected product SKU ${selectedProduct.sku} in Seller Central`}>{selectedProduct.sku}</a> : <strong>N/A</strong>}</span></p></div></div>
          {selectedAsin ? <nav className={ws.asinNavigation} aria-label={`Scale Insights analysis for ASIN ${selectedAsin}`}>{PPC_ANALYSIS_COLUMNS.map(column => <div key={column.key} className={ws.asinNavigationColumn} role="group" aria-label={column.label}>{column.sections.map(section => <a key={section.slug} href={getScaleInsightsAnalysisHref(selectedAsin, section.slug, activeWeekStart, addDaysIso(activeWeekStart, 6))} target="_blank" rel="noopener noreferrer">{section.label}</a>)}</div>)}</nav> : null}
          <div className={ws.saveArea}><button type="button" className={ws.secondaryButton} aria-label="Refresh Data" disabled={displayedPerformanceLoad.status === "loading" || !selectedAsin} onClick={() => { refreshRequest.current = snapshotKey; setPerformanceRefresh(value => value + 1); }}><RefreshCw aria-hidden="true" />Refresh Data</button><small className={dirty ? ws.unsaved : ws.saved}>{dirty ? saveNotice || "Saving changes…" : saveNotice || (report.updatedAt ? `Saved ${new Date(report.updatedAt).toLocaleString()}` : "Changes save automatically")}</small></div>
        </header>

        <div className={ws.workspaceScroll}><div className={ws.workspaceCanvas}>
          <div className={`${ws.twoColumn} ${ws.workspaceTopGrid}`}>
            <section className={`${ws.card} ${ws.goalCard}`} aria-label="Weekly Goals"><div className={ws.cardTitle}><div className={ws.sectionTitleGroup}><h3><Flag />Strategic Weekly Goals</h3><div className={ws.goalHeaderActions}><button type="button" onClick={() => setGoalHistoryOpen(true)}>Goal History</button><button type="button" onClick={addGoal}><Plus />Add Goal</button></div></div></div><div className={ws.goalList}>{report.goals.map(goal => <WeeklyGoalRow key={goal.id} goal={goal} report={report} dataState={goalDataState} onUpdate={patch => updateGoal(goal.id, patch)} onResolve={status => resolveGoal(goal.id, status)} onRemove={() => removeGoal(goal.id)} />)}</div></section>

            <section className={`${ws.card} ${ws.budgetCard}`} aria-labelledby="budget-heading">
              <div className={ws.cardTitle}><h3 id="budget-heading"><DollarSign />Budget Utilization</h3><span className={isOverspent ? ws.pacingDanger : budgetUsage >= 80 ? ws.pacingWarning : ws.pacingHealthy}>{isOverspent ? "Over Budget" : budgetUsage >= 80 ? "Watch Pacing" : "Pacing Optimal"}</span></div>
              <div className={ws.budgetPrimaryGrid}>
                <label><span>Weekly Limit</span><span className={ws.moneyInput}><i>$</i><input aria-label="Weekly limit" inputMode="decimal" style={{ width: `${Math.max(1, roundedMetricValue(report.weeklyBudget).length)}ch` }} value={report.weeklyBudget ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(report.weeklyBudget) : ""} placeholder="0" onFocus={() => { budgetEditStartRef.current = { key: selectedKey, value: report.weeklyBudget }; }} onChange={event => { const weeklyBudget = numericValue(event.target.value); patchReport({ weeklyBudget, dailyBudget: dailyLimitFromWeekly(weeklyBudget) }); }} onBlur={event => finishBudgetEdit(event.currentTarget.value)} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} /></span><small>Daily limit <strong>{preciseCurrency(dailyLimitFromWeekly(report.weeklyBudget))}</strong></small></label>
                <label className={isOverspent ? ws.budgetOver : ""}><span>Spent ({budgetUsage}%)</span><span className={ws.moneyInput}><i>$</i><input aria-label="Actual spend" aria-readonly={importedMetricsLocked || undefined} readOnly={importedMetricsLocked} inputMode="numeric" style={{ width: `${Math.max(1, roundedMetricValue(report.spend).length)}ch` }} value={roundedMetricValue(report.spend)} placeholder="0" onChange={event => patchReport({ spend: numericValue(event.target.value) })} /></span><small>{currency(Math.abs(budgetBalance))} {isOverspent ? "overspent" : "remaining"}</small></label>
              </div>
              <div className={ws.budgetBurnRate}><RadialGauge value={budgetUsage} label={`${budgetUsage}%`} /><div><p><strong>Burn Rate Progress</strong><span>{preciseCurrency(report.spend)} / {preciseCurrency(report.weeklyBudget)}</span></p><div className={ws.progressTrack} aria-label={`${budgetUsage}% of weekly budget used`}><span className={budgetUsage >= 100 ? ws.progressDanger : budgetUsage >= 80 ? ws.progressWarning : ""} style={{ width: `${Math.min(100, budgetUsage)}%` }} /></div><small><span>Expected at day {activeWeekDay}: {expectedBudgetUsage}%</span><strong>{budgetPacingDelta === 0 ? "On pace" : `${budgetPacingDelta > 0 ? "Over" : "Under"}-pacing by ${Math.abs(budgetPacingDelta)}%`}</strong></small></div></div>
              <details className={ws.budgetHistory}><summary>Budget History</summary>
                <table aria-label="Budget change history"><thead><tr><th>Date of Change</th><th>From</th><th>To</th></tr></thead><tbody>{visibleBudgetHistory.length ? visibleBudgetHistory.map(change => <tr key={change.id}><td>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(change.changedAt))}</td><td>{preciseCurrency(change.from)}</td><td>{preciseCurrency(change.to)}</td></tr>) : <tr><td colSpan={3}>No budget changes recorded yet.</td></tr>}</tbody></table>
                {budgetHistoryPageCount > 1 ? <nav className={ws.budgetHistoryPagination} aria-label="Budget history pages"><button type="button" aria-label="Previous budget history page" disabled={budgetHistoryPage === 1} onClick={() => setBudgetHistoryView({ key: selectedKey, page: budgetHistoryPage - 1 })}><ArrowLeft aria-hidden="true" /></button>{Array.from({ length: budgetHistoryPageCount }, (_, index) => index + 1).map(page => <button type="button" key={page} aria-label={`Budget history page ${page}`} aria-current={page === budgetHistoryPage ? "page" : undefined} onClick={() => setBudgetHistoryView({ key: selectedKey, page })}>{page}</button>)}<button type="button" aria-label="Next budget history page" disabled={budgetHistoryPage === budgetHistoryPageCount} onClick={() => setBudgetHistoryView({ key: selectedKey, page: budgetHistoryPage + 1 })}><ArrowRight aria-hidden="true" /></button></nav> : null}
              </details>
            </section>
          </div>

          <section className={`${ws.card} ${ws.performanceCard}`} aria-labelledby="metrics-heading">
            <div className={ws.performanceTitleBar}>
              <div><div className={ws.performanceHeading}><h3 id="metrics-heading"><BarChart3 />Weekly PPC Performance</h3><label className={ws.targetAcosField}><span>Target ACOS:</span><span><input aria-label="Target ACOS" inputMode="decimal" value={report.targetAcos || ""} placeholder="0" onChange={event => patchReport({ targetAcos: numericValue(event.target.value) })} /><i>%</i></span></label></div></div>
              <div className={ws.performanceSync}><span role="status" className={displayedPerformanceLoad.status === "error" ? ws.performanceError : ""}><i />{displayedPerformanceLoad.message}</span>{displayedPerformanceLoad.authorizationUrl ? <a href={displayedPerformanceLoad.authorizationUrl}>Connect Scale Insights</a> : null}</div>
            </div>
            {displayedPerformanceLoad.warnings.length ? <ul className={ws.performanceWarnings}>{displayedPerformanceLoad.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : null}
            <section className={ws.metricGroup} aria-label="Sales metrics"><div className={ws.metricGroupHeading}><h4><DollarSign aria-hidden="true" />Sales &amp; Spend Metrics</h4><span>Total Revenue: <strong>{preciseCurrency(report.totalSales)}</strong></span></div><div className={ws.metricGroupGrid}>{METRIC_GROUPS[0].metrics.map(metric => <MetricInput key={metric.field} metric={metric} report={report} previousValue={previousReport?.[metric.field]} comparisonAvailable={currentPerformanceAvailable} importedLocked={importedMetricsLocked} onChange={(field, value) => patchReport({ [field]: value })} />)}<ConversionRateCard value={report.conversionRate} previousValue={previousReport?.conversionRate} comparisonAvailable={currentPerformanceAvailable} /></div></section>
            <section className={ws.metricGroup} aria-label="Orders metrics">
              <div className={ws.metricGroupHeading}><h4><SlidersHorizontal aria-hidden="true" />Order Volume &amp; Efficiency Targets</h4><div className={ws.efficiencySummary}><span>{roundedMetricValue(report.totalOrders)} Units Sold</span><label className={isAcosAboveTarget ? ws.acosWarning : ws.acosStatus} data-warning={isAcosAboveTarget || undefined}>ACOS <input aria-label="ACOS summary" aria-describedby={isAcosAboveTarget ? "acos-summary-warning" : undefined} readOnly value={roundedMetricValue(report.acos)} />%{isAcosAboveTarget ? " · Attention req." : ""}</label>{isAcosAboveTarget ? <span id="acos-summary-warning" className={ws.srOnly}>Target: {report.targetAcos}% · +{Math.round(report.acos - report.targetAcos)}% over limit</span> : null}</div></div>
              <div className={ws.metricGroupGrid}>
                {METRIC_GROUPS[1].metrics.map(metric => <MetricInput key={metric.field} metric={metric} report={report} previousValue={previousReport?.[metric.field]} comparisonAvailable={currentPerformanceAvailable} importedLocked={importedMetricsLocked} onChange={(field, value) => patchReport({ [field]: value })} />)}
                <MetricInput metric={METRIC_GROUPS[2].metrics[0]} report={report} previousValue={previousReport?.acos} comparisonAvailable={currentPerformanceAvailable} importedLocked={importedMetricsLocked} warning={isAcosAboveTarget} targetAcos={report.targetAcos} onChange={(field, value) => patchReport({ [field]: value })} />
                <MetricInput metric={METRIC_GROUPS[2].metrics[1]} report={report} previousValue={previousReport?.tacos} comparisonAvailable={currentPerformanceAvailable} importedLocked={importedMetricsLocked} onChange={(field, value) => patchReport({ [field]: value })} />
              </div>
            </section>
          </section>

          <div className={ws.twoColumn}>
            <section className={`${ws.card} ${ws.summaryCard}`} aria-labelledby="previous-heading"><div className={ws.cardTitle}><h3 id="previous-heading"><CheckCircle2 />Previous Week Summary</h3></div><label className={ws.readOnlySummary}><span>Performance Documentation</span><textarea aria-label="Previous week performance documentation" readOnly value={previousSummaryText} /></label></section>
            <section className={`${ws.card} ${ws.summaryCard} ${ws.currentSummaryCard}`} aria-labelledby="notes-heading"><div className={ws.cardTitle}><h3 id="notes-heading"><FileText />Current Week Summary</h3></div><FormattedTextarea label="Performance documentation" value={report.notes} onChange={notes => patchReport({ notes })} placeholder="Executive summary, wins, underperformance, bid changes, negative keywords, learnings, and priorities for next week..." /><footer className={ws.summaryFooter}><span className={dirty ? ws.unsaved : ws.autoSaved}>{dirty ? saveNotice || "Saving…" : report.updatedAt ? "Saved locally" : "Not saved yet"}</span><span>Last edited: {report.updatedAt ? new Date(report.updatedAt).toLocaleString() : "—"}</span></footer></section>
          </div>

          <CampaignWeeklyComparison asin={selectedAsin} country="US" weekStart={activeWeekStart} refreshVersion={performanceRefresh} />

          <section className={ws.card} aria-labelledby="actions-heading"><div className={ws.cardTitle}><div><h3 id="actions-heading">Action Items</h3><p className={ws.actionDescription}>Operational tasks generated from this week’s performance analysis</p></div><button type="button" onClick={addAction}><Plus />Add Action Item</button></div><div className={ws.actionList}>{report.actions.map(action => <div className={ws.actionRow} key={action.id}><button type="button" className={action.done ? ws.actionDone : ""} aria-label={action.done ? `Mark ${action.title} incomplete` : `Mark ${action.title} complete`} onClick={() => updateAction(action.id, { done: !action.done })}>{action.done ? <Check /> : null}</button><input aria-label="Action item" value={action.title} onChange={event => updateAction(action.id, { title: event.target.value })} /><select aria-label={`${action.title} priority`} className={priorityTone(action.priority)} value={action.priority} onChange={event => updateAction(action.id, { priority: event.target.value as ActionItem["priority"] })}><option>High</option><option>Medium</option><option>Low</option></select><span className={ws.assigneePlaceholder} aria-label="Assignee unavailable">—</span><button type="button" aria-label={`Remove ${action.title}`} onClick={() => removeAction(action.id)}><Trash2 /></button></div>)}</div></section>
        </div></div>
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
