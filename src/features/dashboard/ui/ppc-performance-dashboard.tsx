"use client";

import {
  ArrowLeft, ArrowRight, BarChart3, CalendarDays, Check, CheckCircle2, ClipboardList, DollarSign,
  FileText, Flag, Plus, Save, Trash2, WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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

type MetricField = "spend" | "sales" | "orders" | "impressions" | "clicks" | "acos" | "roas";

const REPORT_STATUSES: ReportStatus[] = ["Draft", "In Progress", "Completed", "Needs Review"];
const GOAL_STATUSES: GoalStatus[] = ["On Track", "At Risk", "Achieved", "Missed"];
const METRICS: { field: MetricField; label: string; prefix?: string; suffix?: string }[] = [
  { field: "spend", label: "Ad Spend", prefix: "$" }, { field: "sales", label: "PPC Sales", prefix: "$" },
  { field: "orders", label: "Orders" }, { field: "impressions", label: "Impressions" },
  { field: "clicks", label: "Clicks" }, { field: "acos", label: "ACOS", suffix: "%" }, { field: "roas", label: "ROAS" },
];

function numericValue(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function MetricInput({ metric, report, onChange }: { metric: typeof METRICS[number]; report: WeeklyPpcReport; onChange: (field: MetricField, value: number) => void }) {
  return <label className={styles.metricCard}>
    <span>{metric.label}</span>
    <span className={styles.metricInputWrap}>{metric.prefix ? <i>{metric.prefix}</i> : null}<input aria-label={metric.label} inputMode="decimal" value={report[metric.field] || ""} placeholder="0" onChange={event => onChange(metric.field, numericValue(event.target.value))} />{metric.suffix ? <i>{metric.suffix}</i> : null}</span>
  </label>;
}

function statusTone(status: string) {
  if (status === "Completed" || status === "Achieved" || status === "On Track") return styles.success;
  if (status === "Needs Review" || status === "At Risk") return styles.warning;
  if (status === "Missed") return styles.danger;
  return styles.info;
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

  const products = useMemo(() => mergeDashboardProducts(pipelineProducts, catalog), [catalog, pipelineProducts]);
  const weekStarts = useMemo(() => monthAnchor ? getMonthWeekStarts(monthAnchor) : [], [monthAnchor]);
  const selectedProduct = products.find(product => product.id === selectedProductId) ?? null;
  const selectedProductTag = selectedProduct ? catalog.tags.find(tag => tag.id === selectedProduct.tagId) ?? null : null;
  const selectedKey = selectedProductId && selectedWeekStart ? reportKey(selectedProductId, selectedWeekStart) : "";
  const dirty = selectedKey ? dirtyReportKeys.has(selectedKey) : false;
  const report = selectedKey ? reports[selectedKey] ?? createWeeklyPpcReport(selectedProductId, selectedWeekStart) : null;
  const previousReport = selectedProductId && selectedWeekStart ? reports[reportKey(selectedProductId, addDaysIso(selectedWeekStart, -7))] ?? null : null;
  const budgetUsage = report ? percentage(report.spend, report.weeklyBudget) : 0;

  const replaceReport = (nextReport: WeeklyPpcReport) => {
    if (!selectedKey) return;
    setReports(current => ({ ...current, [selectedKey]: nextReport }));
    setDirtyReportKeys(current => new Set(current).add(selectedKey));
    setSaveNotice("");
  };
  const patchReport = (patch: Partial<WeeklyPpcReport>) => { if (report) replaceReport({ ...report, ...patch }); };
  const selectProduct = (productId: string) => { setSelectedProductId(productId); setSaveNotice(""); };
  const selectWeek = (weekStart: string) => { setSelectedWeekStart(weekStart); setSaveNotice(""); };

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
        <div className={styles.headingRow}><div><span className={styles.eyebrow}>TIMELINE</span><h2 id="periods-heading">Reporting Periods</h2></div><CalendarDays aria-hidden="true" /></div>
        <div className={styles.monthPicker}><button type="button" aria-label="Previous month" onClick={() => monthAnchor && setMonthAnchor(addMonthsIso(monthAnchor, -1))}><ArrowLeft /></button><strong>{monthAnchor ? formatMonth(monthAnchor) : "Loading…"}</strong><button type="button" aria-label="Next month" onClick={() => monthAnchor && setMonthAnchor(addMonthsIso(monthAnchor, 1))}><ArrowRight /></button></div>
        <button type="button" className={styles.addWeek} onClick={() => { if (currentWeekStart) { selectWeek(currentWeekStart); setMonthAnchor(currentWeekStart); } }}><Plus aria-hidden="true" />Open current week</button>
      </div>
      <div className={styles.periodList}>{weekStarts.map(weekStart => {
        const periodReport = selectedProductId ? reports[reportKey(selectedProductId, weekStart)] : null;
        const isCurrent = weekStart === currentWeekStart;
        const isSelected = weekStart === selectedWeekStart;
        return <button type="button" key={weekStart} className={`${styles.periodCard} ${isSelected ? styles.selectedPeriod : ""}`} onClick={() => selectWeek(weekStart)}>
          {isCurrent ? <span className={styles.currentBadge}>Current</span> : null}
          <span className={styles.periodTop}><span><strong>{formatWeekRange(weekStart)}</strong><small>Week {getIsoWeekNumber(weekStart)}</small></span><i className={statusTone(periodReport?.status ?? "Draft")}>{periodReport?.status ?? "Draft"}</i></span>
          <span className={styles.periodStats}><span><small>Spend</small><strong>{currency(periodReport?.spend ?? 0)}</strong></span><span><small>Sales</small><strong>{currency(periodReport?.sales ?? 0)}</strong></span><span><small>Order</small><strong>{periodReport?.orders ?? 0}</strong></span><span><small>ACOS</small><strong>{periodReport?.acos ?? 0}%</strong></span></span>
        </button>;
      })}</div>
    </aside>

    <main className={styles.workspace}>
      {!selectedProduct || !report ? <div className={styles.workspaceEmpty}><BarChart3 aria-hidden="true" /><h2>Select a product</h2><p>Choose a Pipeline product to start its weekly PPC documentation.</p></div> : <>
        <header className={styles.workspaceHeader}>
          <div><span className={styles.eyebrow}>WEEKLY PPC PERFORMANCE</span><div className={styles.titleRow}><h2>{selectedProduct.name}</h2>{selectedProductTag ? <span>{selectedProductTag.name}</span> : null}</div><p>ASIN: <strong>{selectedProduct.asin || "N/A"}</strong><i />SKU: <strong>{selectedProduct.sku || "N/A"}</strong><i /><CalendarDays />{formatWeekRange(selectedWeekStart)} · Week {getIsoWeekNumber(selectedWeekStart)}</p></div>
          <div className={styles.saveArea}><div><button type="button" className={styles.secondaryButton} onClick={() => saveReport("Draft")}><FileText />Save Draft</button><button type="button" className={styles.primaryButton} onClick={() => saveReport("Completed")}><Save />Save Weekly Report</button></div><small className={dirty ? styles.unsaved : styles.saved}>{dirty ? "Unsaved changes" : saveNotice || (report.updatedAt ? `Saved ${new Date(report.updatedAt).toLocaleString()}` : "Local draft not saved yet")}</small></div>
        </header>

        <div className={styles.workspaceScroll}>
          <div className={styles.statusBar}><label>Status<select value={report.status} onChange={event => patchReport({ status: event.target.value as ReportStatus })}>{REPORT_STATUSES.map(status => <option key={status}>{status}</option>)}</select></label><span><CheckCircle2 />Previous week: {previousReport?.status ?? "No saved report"}</span><span><WalletCards />Budget used: {budgetUsage}%</span></div>

          <div className={styles.twoColumn}>
            <section className={styles.card} aria-labelledby="goals-heading"><div className={styles.cardTitle}><h3 id="goals-heading"><Flag />Weekly Goals</h3><button type="button" onClick={addGoal}><Plus />Add Goal</button></div><div className={styles.goalList}>{report.goals.map(goal => <div className={styles.goalRow} key={goal.id}><input aria-label="Goal title" value={goal.title} onChange={event => updateGoal(goal.id, { title: event.target.value })} /><label>Target<input value={goal.target} onChange={event => updateGoal(goal.id, { target: event.target.value })} /></label><label>Actual<input value={goal.actual} onChange={event => updateGoal(goal.id, { actual: event.target.value })} /></label><select aria-label={`${goal.title} status`} className={statusTone(goal.status)} value={goal.status} onChange={event => updateGoal(goal.id, { status: event.target.value as GoalStatus })}>{GOAL_STATUSES.map(status => <option key={status}>{status}</option>)}</select><button type="button" aria-label={`Remove ${goal.title}`} onClick={() => removeGoal(goal.id)}><Trash2 /></button></div>)}</div></section>

            <section className={styles.card} aria-labelledby="budget-heading"><div className={styles.cardTitle}><h3 id="budget-heading"><DollarSign />Budget Tracking</h3></div><div className={styles.budgetGrid}><label><span>Weekly limit</span><span className={styles.moneyInput}><i>$</i><input inputMode="decimal" value={report.weeklyBudget || ""} placeholder="0" onChange={event => patchReport({ weeklyBudget: numericValue(event.target.value) })} /></span></label><label><span>Daily limit</span><span className={styles.moneyInput}><i>$</i><input inputMode="decimal" value={report.dailyBudget || ""} placeholder="0" onChange={event => patchReport({ dailyBudget: numericValue(event.target.value) })} /></span></label><div><span>Actual spend</span><strong>{currency(report.spend)}</strong></div><div><span>Remaining</span><strong>{currency(Math.max(0, report.weeklyBudget - report.spend))}</strong></div></div><div className={styles.progressTrack} aria-label={`${budgetUsage}% of weekly budget used`}><span className={budgetUsage >= 100 ? styles.progressDanger : budgetUsage >= 80 ? styles.progressWarning : ""} style={{ width: `${Math.min(100, budgetUsage)}%` }} /></div><small>{budgetUsage}% of the weekly budget used</small></section>
          </div>

          <section className={styles.card} aria-labelledby="metrics-heading"><div className={styles.cardTitle}><h3 id="metrics-heading"><BarChart3 />Weekly Performance</h3><span>Enter verified Seller Central results</span></div><div className={styles.metricsGrid}>{METRICS.map(metric => <MetricInput key={metric.field} metric={metric} report={report} onChange={(field, value) => patchReport({ [field]: value })} />)}</div></section>

          <div className={styles.twoColumn}>
            <section className={styles.card} aria-labelledby="previous-heading"><div className={styles.cardTitle}><h3 id="previous-heading"><CheckCircle2 />Previous Week Result</h3></div>{previousReport ? <div className={styles.previousSummary}><span className={statusTone(previousReport.status)}>{previousReport.status}</span><strong>{currency(previousReport.sales)} sales · {previousReport.roas || 0} ROAS</strong><p>{previousReport.previousWeekResult || previousReport.notes || "No outcome summary was entered."}</p></div> : <p className={styles.mutedCopy}>No saved report exists for {formatWeekRange(addDaysIso(selectedWeekStart, -7))}.</p>}<label className={styles.textAreaLabel}>Carry-forward result and lessons<textarea value={report.previousWeekResult} onChange={event => patchReport({ previousWeekResult: event.target.value })} placeholder="What goal was achieved or missed, why, and what should carry into this week?" /></label></section>
            <section className={styles.card} aria-labelledby="notes-heading"><div className={styles.cardTitle}><h3 id="notes-heading"><FileText />Weekly Summary & Notes</h3></div><label className={styles.textAreaLabel}>Performance documentation<textarea className={styles.notesArea} value={report.notes} onChange={event => patchReport({ notes: event.target.value })} placeholder="Executive summary, wins, underperformance, bid changes, negative keywords, learnings, and priorities for next week..." /></label></section>
          </div>

          <section className={styles.card} aria-labelledby="actions-heading"><div className={styles.cardTitle}><h3 id="actions-heading"><ClipboardList />Next-Week Action Plan</h3><button type="button" onClick={addAction}><Plus />Add Item</button></div><div className={styles.actionList}>{report.actions.map(action => <div className={styles.actionRow} key={action.id}><button type="button" className={action.done ? styles.actionDone : ""} aria-label={action.done ? `Mark ${action.title} incomplete` : `Mark ${action.title} complete`} onClick={() => updateAction(action.id, { done: !action.done })}>{action.done ? <Check /> : null}</button><input aria-label="Action item" value={action.title} onChange={event => updateAction(action.id, { title: event.target.value })} /><select aria-label={`${action.title} priority`} value={action.priority} onChange={event => updateAction(action.id, { priority: event.target.value as ActionItem["priority"] })}><option>High</option><option>Medium</option><option>Low</option></select><input aria-label={`${action.title} due date`} type="date" value={action.dueDate} onChange={event => updateAction(action.id, { dueDate: event.target.value })} /><button type="button" aria-label={`Remove ${action.title}`} onClick={() => removeAction(action.id)}><Trash2 /></button></div>)}</div></section>
        </div>
      </>}
    </main>
  </section>;
}
