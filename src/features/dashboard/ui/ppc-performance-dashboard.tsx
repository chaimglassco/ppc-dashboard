"use client";

import Image from "next/image";
import {
  ArrowLeft, ArrowRight, BarChart3, Bold, CalendarDays, Check, CheckCircle2, ClipboardList, DollarSign,
  FileText, Flag, Italic, List, ListOrdered, Plus, Save, Trash2, WalletCards, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { withPpcBasePath } from "@/lib/glassco-apps";
import { getPipelineAuthorizationHeader } from "@/lib/pipeline-session";
import {
  PPC_DASHBOARD_STORAGE_KEY, addDaysIso, addMonthsIso, createWeeklyPpcReport, currency, formatMonth,
  formatWeekRange, getIsoWeekNumber, getMonthWeekStarts, parsePpcDashboardStore, percentage, reportKey,
  startOfWeekIso, type ActionItem, type DashboardProduct, type GoalStatus, type ReportStatus,
  type WeeklyGoal, type WeeklyPpcReport,
} from "../domain/ppc-dashboard-state";
import {
  PPC_DASHBOARD_CATALOG_STORAGE_KEY, createDashboardTagId, emptyDashboardCatalog, mergeDashboardProducts,
  parseDashboardCatalogStore, type DashboardCatalogProduct, type DashboardCatalogStore, type ManagedDashboardProduct,
} from "../domain/ppc-dashboard-catalog";
import { ProductPortfolioPanel, type ProductFormValue } from "./product-portfolio-panel";
import styles from "./ppc-performance-dashboard.module.css";

type MetricField = "spend" | "ppcSales" | "organicSales" | "totalSales" | "ppcOrders" | "organicOrders" | "totalOrders" | "acos" | "tacos";
type MetricDefinition = { field: MetricField; label: string; prefix?: string; suffix?: string };

const REPORT_STATUSES: ReportStatus[] = ["Draft", "In Progress", "Completed", "Needs Review"];
const GOAL_STATUSES: GoalStatus[] = ["On Track", "At Risk", "Achieved", "Missed"];
const AUTO_SAVE_DELAY_MS = 500;
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const METRIC_GROUPS: { title: string; metrics: MetricDefinition[] }[] = [
  { title: "Sales", metrics: [
    { field: "spend", label: "Spend", prefix: "$" }, { field: "ppcSales", label: "PPC Sales", prefix: "$" },
    { field: "organicSales", label: "Organic Sales", prefix: "$" }, { field: "totalSales", label: "Total Sales", prefix: "$" },
  ] },
  { title: "Orders", metrics: [
    { field: "ppcOrders", label: "PPC Orders" }, { field: "organicOrders", label: "Organic Orders" }, { field: "totalOrders", label: "Total Orders" },
  ] },
  { title: "Efficiency", metrics: [
    { field: "acos", label: "ACOS", suffix: "%" }, { field: "tacos", label: "TACOS", suffix: "%" },
  ] },
];

function numericValue(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function dailyLimitFromWeekly(weeklyLimit: number) {
  return Math.round((weeklyLimit / 7) * 100) / 100;
}

function preciseCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 }).format(value || 0);
}

function MetricInput({ metric, report, onChange }: { metric: MetricDefinition; report: WeeklyPpcReport; onChange: (field: MetricField, value: number) => void }) {
  return <label className={styles.metricCard}>
    <span>{metric.label}</span>
    <span className={styles.metricInputWrap}>{metric.prefix ? <i>{metric.prefix}</i> : null}<input aria-label={metric.label} inputMode="decimal" value={report[metric.field] || ""} placeholder="0" onChange={event => onChange(metric.field, numericValue(event.target.value))} />{metric.suffix ? <i>{metric.suffix}</i> : null}</span>
  </label>;
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
      const content = selected || "List item";
      replacement = content.split("\n").map((line, index) => `${format === "bullet" ? "•" : `${index + 1}.`} ${line.replace(/^\s*(?:[-•]|\d+\.)\s*/, "")}`).join("\n");
      selectionEnd = start + replacement.length;
    }

    onChange(`${value.slice(0, start)}${replacement}${value.slice(end)}`);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  return <div className={styles.textAreaLabel}><span>{label}</span><span className={styles.formatToolbar} role="toolbar" aria-label={`${label} formatting`}>
    <button type="button" aria-label={`Bold ${label}`} onClick={() => applyFormat("bold")}><Bold aria-hidden="true" /></button>
    <button type="button" aria-label={`Italic ${label}`} onClick={() => applyFormat("italic")}><Italic aria-hidden="true" /></button>
    <button type="button" aria-label={`Bulleted list ${label}`} onClick={() => applyFormat("bullet")}><List aria-hidden="true" /></button>
    <button type="button" aria-label={`Numbered list ${label}`} onClick={() => applyFormat("numbered")}><ListOrdered aria-hidden="true" /></button>
  </span><textarea ref={textareaRef} className={styles.notesArea} aria-label={label} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></div>;
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
  const [pipelineProducts, setPipelineProducts] = useState<DashboardProduct[]>([]);
  const [catalog, setCatalog] = useState<DashboardCatalogStore>(emptyDashboardCatalog);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedWeekStart, setSelectedWeekStart] = useState(initialWeekStart);
  const [monthAnchor, setMonthAnchor] = useState(initialToday);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState(Number(initialToday.slice(0, 4)));
  const currentWeekStart = initialWeekStart;
  const [reports, setReports] = useState<Record<string, WeeklyPpcReport>>({});
  const [dirtyReportKeys, setDirtyReportKeys] = useState<Set<string>>(() => new Set());
  const [saveNotice, setSaveNotice] = useState("");

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
        setSaveNotice("Auto-save failed — use Save Draft");
      }
    }, AUTO_SAVE_DELAY_MS);

    return () => window.clearTimeout(autoSaveTimer);
  }, [dirtyReportKeys, reports]);

  useEffect(() => {
    if (!monthPickerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMonthPickerOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [monthPickerOpen]);

  const products = useMemo(() => mergeDashboardProducts(pipelineProducts, catalog), [catalog, pipelineProducts]);
  const weekStarts = useMemo(() => {
    if (monthAnchor.slice(0, 7) === initialToday.slice(0, 7)) {
      return Array.from({ length: 6 }, (_, index) => addDaysIso(currentWeekStart, index * -7));
    }
    const monthWeekStarts = monthAnchor ? getMonthWeekStarts(monthAnchor) : [];
    const previousWeekStarts = monthWeekStarts
      .filter(weekStart => weekStart < currentWeekStart)
      .sort((first, second) => second.localeCompare(first));
    return [currentWeekStart, ...previousWeekStarts];
  }, [currentWeekStart, initialToday, monthAnchor]);
  const selectedProduct = products.find(product => product.id === selectedProductId) ?? null;
  const selectedProductTag = selectedProduct ? catalog.tags.find(tag => tag.id === selectedProduct.tagId) ?? null : null;
  const selectedKey = selectedProductId && selectedWeekStart ? reportKey(selectedProductId, selectedWeekStart) : "";
  const dirty = selectedKey ? dirtyReportKeys.has(selectedKey) : false;
  const report = selectedKey ? reports[selectedKey] ?? createWeeklyPpcReport(selectedProductId, selectedWeekStart) : null;
  const previousReport = selectedProductId && selectedWeekStart ? reports[reportKey(selectedProductId, addDaysIso(selectedWeekStart, -7))] ?? null : null;
  const budgetUsage = report ? percentage(report.spend, report.weeklyBudget) : 0;
  const budgetBalance = report ? report.weeklyBudget - report.spend : 0;
  const isOverspent = budgetBalance < 0;

  const replaceReport = (nextReport: WeeklyPpcReport) => {
    if (!selectedKey) return;
    setReports(current => ({ ...current, [selectedKey]: nextReport }));
    setDirtyReportKeys(current => new Set(current).add(selectedKey));
    setSaveNotice("Saving changes…");
  };
  const patchReport = (patch: Partial<WeeklyPpcReport>) => { if (report) replaceReport({ ...report, ...patch }); };
  const selectProduct = (productId: string) => { setSelectedProductId(productId); setSaveNotice(""); };
  const selectWeek = (weekStart: string) => { setSelectedWeekStart(weekStart); setSaveNotice(""); };
  const openMonthPicker = () => { setMonthPickerYear(Number(monthAnchor.slice(0, 4))); setMonthPickerOpen(true); };
  const selectMonth = (monthIndex: number) => { setMonthAnchor(`${monthPickerYear}-${String(monthIndex + 1).padStart(2, "0")}-01`); setMonthPickerOpen(false); };

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
      const error = persistCatalog({ ...catalog, customProducts: [product, ...catalog.customProducts] });
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

  const updateGoal = (goalId: string, patch: Partial<WeeklyGoal>) => {
    if (report) patchReport({ goals: report.goals.map(goal => goal.id === goalId ? { ...goal, ...patch } : goal) });
  };
  const addGoal = () => {
    if (!report) return;
    patchReport({ goals: [...report.goals, { id: `goal-${Date.now()}`, title: "New weekly goal", target: "", actual: "", status: "On Track" }] });
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

  const saveReport = (status: ReportStatus) => {
    if (!report || !selectedKey) return;
    const saved = { ...report, status, updatedAt: new Date().toISOString() };
    const storedReports = parsePpcDashboardStore(window.localStorage.getItem(PPC_DASHBOARD_STORAGE_KEY)).reports;
    window.localStorage.setItem(PPC_DASHBOARD_STORAGE_KEY, JSON.stringify({ version: 1, reports: { ...storedReports, [selectedKey]: saved } }));
    setReports(current => ({ ...current, [selectedKey]: saved }));
    setDirtyReportKeys(current => { const next = new Set(current); next.delete(selectedKey); return next; });
    setSaveNotice(status === "Completed" ? "Weekly report saved" : "Draft saved");
  };

  return <section className={styles.dashboard} aria-label="Weekly PPC Performance Notes">
    <ProductPortfolioPanel products={products} tags={catalog.tags} loading={productsLoading} error={productsError} selectedProductId={selectedProductId} onSelectProduct={selectProduct} onRetry={() => void loadProducts()} onCreateTag={createTag} onSaveProduct={saveProduct} onDeleteProduct={deleteProduct} />

    <aside className={styles.periodsPanel} aria-labelledby="periods-heading">
      <div className={styles.panelHeader}>
        <div className={styles.headingRow}><div><span className={styles.eyebrow}>TIMELINE</span><h2 id="periods-heading">Reporting Periods</h2></div></div>
        <div className={styles.monthPickerRow}><div className={styles.monthPicker} role="group" aria-label="Month navigation"><button type="button" aria-label="Previous month" onClick={() => monthAnchor && setMonthAnchor(addMonthsIso(monthAnchor, -1))}><ArrowLeft /></button><strong>{formatMonth(monthAnchor)}</strong><button type="button" aria-label="Next month" onClick={() => monthAnchor && setMonthAnchor(addMonthsIso(monthAnchor, 1))}><ArrowRight /></button></div><button type="button" className={styles.calendarPickerButton} aria-label={`Choose reporting month, ${formatMonth(monthAnchor)}`} onClick={openMonthPicker}><CalendarDays aria-hidden="true" /></button></div>
      </div>
      <div className={styles.periodList} aria-label="Reporting periods">{weekStarts.map(weekStart => {
        const periodReport = selectedProductId ? reports[reportKey(selectedProductId, weekStart)] : null;
        const isCurrent = weekStart === currentWeekStart;
        const isSelected = weekStart === selectedWeekStart;
        return <button type="button" key={weekStart} aria-pressed={isSelected} className={`${styles.periodCard} ${isSelected ? styles.selectedPeriod : ""}`} onClick={() => selectWeek(weekStart)}>
          {isCurrent ? <span className={styles.currentBadge}>Current</span> : null}
          <span className={styles.periodTop}><span><strong>{formatWeekRange(weekStart)}</strong><small>Week {getIsoWeekNumber(weekStart)}</small></span><i className={statusTone(periodReport?.status ?? "Draft")}>{periodReport?.status ?? "Draft"}</i></span>
          <span className={styles.periodStats}><span><small>Spend</small><strong>{currency(periodReport?.spend ?? 0)}</strong></span><span><small>Sales</small><strong>{currency(periodReport?.totalSales ?? 0)}</strong></span><span><small>Order</small><strong>{periodReport?.totalOrders ?? 0}</strong></span><span><small>ACOS</small><strong>{periodReport?.acos ?? 0}%</strong></span></span>
        </button>;
      })}</div>
    </aside>

    <main className={styles.workspace}>
      {!selectedProduct || !report ? <div className={styles.workspaceEmpty}><BarChart3 aria-hidden="true" /><h2>Select a product</h2><p>Choose a Pipeline product to start its weekly PPC documentation.</p></div> : <>
        <header className={styles.workspaceHeader}>
          <div className={styles.workspaceProduct}>{selectedProduct.imageDataUrl ? <span className={styles.workspaceProductImage}><Image src={selectedProduct.imageDataUrl} alt={`${selectedProduct.name} product`} width={62} height={62} unoptimized /></span> : null}<div><span className={styles.eyebrow}>WEEKLY PPC PERFORMANCE</span><div className={styles.titleRow}><h2>{selectedProduct.name}</h2>{selectedProductTag ? <span>{selectedProductTag.name}</span> : null}</div><p>ASIN: {selectedProduct.asin ? <a href={`https://www.amazon.com/dp/${encodeURIComponent(selectedProduct.asin)}`} target="_blank" rel="noopener noreferrer" aria-label={`Open selected product ASIN ${selectedProduct.asin} on Amazon`}>{selectedProduct.asin}</a> : <strong>N/A</strong>}<i />SKU: {selectedProduct.sku ? <a href={`https://sellercentral.amazon.com/myinventory/inventory?searchField=sku&searchTerm=${encodeURIComponent(selectedProduct.sku)}`} target="_blank" rel="noopener noreferrer" aria-label={`Open selected product SKU ${selectedProduct.sku} in Seller Central`}>{selectedProduct.sku}</a> : <strong>N/A</strong>}<i /><CalendarDays />{formatWeekRange(selectedWeekStart)} · Week {getIsoWeekNumber(selectedWeekStart)}</p></div></div>
          <div className={styles.saveArea}><div><button type="button" className={styles.secondaryButton} onClick={() => saveReport("Draft")}><FileText />Save Draft</button><button type="button" className={styles.primaryButton} onClick={() => saveReport("Completed")}><Save />Save Weekly Report</button></div><small className={dirty ? styles.unsaved : styles.saved}>{dirty ? saveNotice || "Saving changes…" : saveNotice || (report.updatedAt ? `Saved ${new Date(report.updatedAt).toLocaleString()}` : "Local draft not saved yet")}</small></div>
        </header>

        <div className={styles.workspaceScroll}>
          <div className={styles.statusBar}><label>Status<select value={report.status} onChange={event => patchReport({ status: event.target.value as ReportStatus })}>{REPORT_STATUSES.map(status => <option key={status}>{status}</option>)}</select></label><span><CheckCircle2 />Previous week: {previousReport?.status ?? "No saved report"}</span><span><WalletCards />Budget used: {budgetUsage}%</span></div>

          <div className={styles.twoColumn}>
            <section className={styles.card} aria-labelledby="goals-heading"><div className={styles.cardTitle}><h3 id="goals-heading"><Flag />Weekly Goals</h3><button type="button" onClick={addGoal}><Plus />Add Goal</button></div><div className={styles.goalList}>{report.goals.map(goal => <div className={styles.goalRow} key={goal.id}><input className={styles.goalTitleInput} aria-label="Goal title" value={goal.title} onChange={event => updateGoal(goal.id, { title: event.target.value })} /><div className={styles.goalMetrics}><label>Target<input value={goal.target} onChange={event => updateGoal(goal.id, { target: event.target.value })} /></label><label>Actual<input value={goal.actual} onChange={event => updateGoal(goal.id, { actual: event.target.value })} /></label><label>Status<select aria-label={`${goal.title} status`} className={statusTone(goal.status)} value={goal.status} onChange={event => updateGoal(goal.id, { status: event.target.value as GoalStatus })}>{GOAL_STATUSES.map(status => <option key={status}>{status}</option>)}</select></label><button type="button" aria-label={`Remove ${goal.title}`} onClick={() => removeGoal(goal.id)}><Trash2 /></button></div></div>)}</div></section>

            <section className={styles.card} aria-labelledby="budget-heading">
              <div className={styles.cardTitle}><h3 id="budget-heading"><DollarSign />Budget Tracking</h3></div>
              <div className={styles.budgetGrid}>
                <label><span>Weekly limit</span><span className={styles.moneyInput}><i>$</i><input inputMode="decimal" value={report.weeklyBudget || ""} placeholder="0" onChange={event => { const weeklyBudget = numericValue(event.target.value); patchReport({ weeklyBudget, dailyBudget: dailyLimitFromWeekly(weeklyBudget) }); }} /></span></label>
                <div><span>Daily limit</span><strong>{preciseCurrency(dailyLimitFromWeekly(report.weeklyBudget))}</strong></div>
                <label><span>Actual spend</span><span className={styles.moneyInput}><i>$</i><input aria-label="Actual spend" inputMode="decimal" value={report.spend || ""} placeholder="0" onChange={event => patchReport({ spend: numericValue(event.target.value) })} /></span></label>
                <div className={isOverspent ? styles.budgetOver : ""}><span>{isOverspent ? "Overspent" : "Remaining"}</span><strong>{currency(Math.abs(budgetBalance))}</strong></div>
              </div>
              <div className={styles.progressTrack} aria-label={`${budgetUsage}% of weekly budget used`}><span className={budgetUsage >= 100 ? styles.progressDanger : budgetUsage >= 80 ? styles.progressWarning : ""} style={{ width: `${Math.min(100, budgetUsage)}%` }} /></div><small>{budgetUsage}% of the weekly budget used</small>
            </section>
          </div>

          <section className={styles.card} aria-labelledby="metrics-heading"><div className={styles.cardTitle}><h3 id="metrics-heading"><BarChart3 />Weekly Performance</h3><span>Enter verified Seller Central results</span></div><div className={styles.metricsGroups}>{METRIC_GROUPS.map(group => <section className={styles.metricGroup} key={group.title} aria-label={`${group.title} metrics`}><h4>{group.title}</h4><div className={styles.metricGroupGrid}>{group.metrics.map(metric => <MetricInput key={metric.field} metric={metric} report={report} onChange={(field, value) => patchReport({ [field]: value })} />)}</div></section>)}</div></section>

          <div className={styles.twoColumn}>
            <section className={styles.card} aria-labelledby="previous-heading"><div className={styles.cardTitle}><h3 id="previous-heading"><CheckCircle2 />Previous Week Result</h3></div>{previousReport ? <div className={styles.previousSummary}><span className={statusTone(previousReport.status)}>{previousReport.status}</span><strong>{currency(previousReport.totalSales)} total sales · {previousReport.tacos || 0}% TACOS</strong><p>{previousReport.previousWeekResult || previousReport.notes || "No outcome summary was entered."}</p></div> : <p className={styles.mutedCopy}>No saved report exists for {formatWeekRange(addDaysIso(selectedWeekStart, -7))}.</p>}<FormattedTextarea label="Carry-forward result and lessons" value={report.previousWeekResult} onChange={previousWeekResult => patchReport({ previousWeekResult })} placeholder="What goal was achieved or missed, why, and what should carry into this week?" /></section>
            <section className={styles.card} aria-labelledby="notes-heading"><div className={styles.cardTitle}><h3 id="notes-heading"><FileText />Weekly Summary & Notes</h3></div><FormattedTextarea label="Performance documentation" value={report.notes} onChange={notes => patchReport({ notes })} placeholder="Executive summary, wins, underperformance, bid changes, negative keywords, learnings, and priorities for next week..." /></section>
          </div>

          <section className={styles.card} aria-labelledby="actions-heading"><div className={styles.cardTitle}><h3 id="actions-heading"><ClipboardList />Next-Week Action Plan</h3><button type="button" onClick={addAction}><Plus />Add Item</button></div><div className={styles.actionList}>{report.actions.map(action => <div className={styles.actionRow} key={action.id}><button type="button" className={action.done ? styles.actionDone : ""} aria-label={action.done ? `Mark ${action.title} incomplete` : `Mark ${action.title} complete`} onClick={() => updateAction(action.id, { done: !action.done })}>{action.done ? <Check /> : null}</button><input aria-label="Action item" value={action.title} onChange={event => updateAction(action.id, { title: event.target.value })} /><select aria-label={`${action.title} priority`} className={priorityTone(action.priority)} value={action.priority} onChange={event => updateAction(action.id, { priority: event.target.value as ActionItem["priority"] })}><option>High</option><option>Medium</option><option>Low</option></select><button type="button" aria-label={`Remove ${action.title}`} onClick={() => removeAction(action.id)}><Trash2 /></button></div>)}</div></section>
        </div>
      </>}
    </main>

    {monthPickerOpen ? <div className={styles.monthDialogBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) setMonthPickerOpen(false); }}>
      <section className={styles.monthDialog} role="dialog" aria-modal="true" aria-labelledby="month-dialog-heading">
        <header><div><span className={styles.eyebrow}>REPORTING PERIOD</span><h2 id="month-dialog-heading">Choose a month</h2></div><button type="button" aria-label="Close month picker" onClick={() => setMonthPickerOpen(false)}><X aria-hidden="true" /></button></header>
        <div className={styles.monthDialogYear}><button type="button" aria-label="Previous year" onClick={() => setMonthPickerYear(year => year - 1)}><ArrowLeft aria-hidden="true" /></button><strong>{monthPickerYear}</strong><button type="button" aria-label="Next year" onClick={() => setMonthPickerYear(year => year + 1)}><ArrowRight aria-hidden="true" /></button></div>
        <div className={styles.monthGrid}>{MONTH_NAMES.map((monthName, monthIndex) => {
          const monthValue = `${monthPickerYear}-${String(monthIndex + 1).padStart(2, "0")}`;
          const isSelectedMonth = monthAnchor.startsWith(monthValue);
          const isCurrentMonth = initialToday.startsWith(monthValue);
          return <button type="button" key={monthName} className={`${styles.monthOption} ${isSelectedMonth ? styles.monthOptionSelected : ""} ${isCurrentMonth ? styles.monthOptionCurrent : ""}`} aria-label={`${monthName} ${monthPickerYear}`} aria-pressed={isSelectedMonth} aria-current={isCurrentMonth ? "date" : undefined} autoFocus={isSelectedMonth} onClick={() => selectMonth(monthIndex)}><span>{monthName}</span>{isCurrentMonth ? <small>Current</small> : null}</button>;
        })}</div>
      </section>
    </div> : null}
  </section>;
}
