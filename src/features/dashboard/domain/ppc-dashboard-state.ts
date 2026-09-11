export const PPC_DASHBOARD_STORAGE_KEY = "glassco.ppcPerformanceNotes.v1";

export type DashboardProduct = { id: string; name: string; asin: string; sku: string; stageId: string; status: "Active" | "Paused" };
export type GoalStatus = "On Track" | "At Risk" | "Achieved" | "Missed";
export type GoalOutcome = Extract<GoalStatus, "Achieved" | "Missed">;
export type WeeklyGoalMetric = "increaseSpend" | "decreaseSpend" | "ppcSales" | "totalSales" | "ppcOrders" | "organicOrders" | "totalOrders" | "acos" | "tacos";
export type WeeklyGoalUnit = "currency" | "number" | "percentage";
export type GoalDataState = "Partial" | "Final";
export type ReportStatus = "Draft" | "In Progress" | "Completed" | "Needs Review";
export type WeeklyGoal = { id: string; title: string; target: string; actual: string; status: GoalStatus; metric?: WeeklyGoalMetric; unit?: WeeklyGoalUnit };
export type GoalHistoryEntry = WeeklyGoal & { status: GoalOutcome; resolvedAt: string; dataState?: GoalDataState };
export type ActionItem = { id: string; title: string; priority: "High" | "Medium" | "Low"; dueDate: string; done: boolean };
export type BudgetChange = { id: string; changedAt: string; from: number; to: number };
export type WeeklyPpcReport = {
  productId: string; weekStart: string; status: ReportStatus; weeklyBudget: number; dailyBudget: number;
  budgetHistory: BudgetChange[];
  spend: number; ppcSales: number; organicSales: number; totalSales: number;
  ppcOrders: number; organicOrders: number; totalOrders: number; targetAcos: number; acos: number; tacos: number;
  totalSessions?: number; conversionRate?: number;
  goals: WeeklyGoal[]; goalHistory: GoalHistoryEntry[]; previousWeekResult: string; notes: string; actions: ActionItem[]; updatedAt: string | null;
};
export type WeeklyPerformanceSourceMetrics = {
  spend: number;
  ppcSales: number;
  ppcOrders: number;
  totalSales: number;
  totalOrders: number;
  totalSessions?: number;
};
export type WeeklyPerformanceCalculatedMetrics = WeeklyPerformanceSourceMetrics & {
  organicSales: number;
  organicOrders: number;
  acos: number;
  tacos: number;
  conversionRate?: number;
};
export type PpcDashboardStore = { version: 1; reports: Record<string, WeeklyPpcReport> };

export const WEEKLY_GOAL_OPTIONS: ReadonlyArray<{ value: WeeklyGoalMetric; label: string }> = [
  { value: "increaseSpend", label: "Increase Spend" },
  { value: "decreaseSpend", label: "Decrease Spend" },
  { value: "ppcSales", label: "PPC Sales" },
  { value: "totalSales", label: "Total Sales" },
  { value: "ppcOrders", label: "PPC Order" },
  { value: "organicOrders", label: "Organic Order" },
  { value: "totalOrders", label: "Total Orders" },
  { value: "acos", label: "ACOS" },
  { value: "tacos", label: "TACOS" },
];

const DEFAULT_GOALS: WeeklyGoal[] = [
  { id: "goal-acos", title: "ACOS", metric: "acos", unit: "percentage", target: "25", actual: "", status: "On Track" },
  { id: "goal-sales", title: "PPC Sales", metric: "ppcSales", unit: "currency", target: "", actual: "", status: "On Track" },
];
const DEFAULT_ACTIONS: ActionItem[] = [
  { id: "action-negatives", title: "Review search terms and add negative exact keywords", priority: "High", dueDate: "", done: false },
];
const REPORTING_WEEK_START_DAY = 3;
const LEGACY_REPORTING_WEEK_START_DAY = 1;

export function reportKey(productId: string, weekStart: string) { return `${productId}:${weekStart}`; }

export function createWeeklyPpcReport(productId: string, weekStart: string, previousReport?: WeeklyPpcReport | null): WeeklyPpcReport {
  const carriedGoals = previousReport
    ? previousReport.goals.filter(goal => goal.status !== "Achieved" && goal.status !== "Missed").map((goal, index) => ({
      ...goal, id: `${goal.id}-carried-${weekStart}-${index}`, actual: "", status: "On Track" as GoalStatus,
    }))
    : DEFAULT_GOALS.map(goal => ({ ...goal }));
  return {
    productId, weekStart, status: "Draft", weeklyBudget: 0, dailyBudget: 0, budgetHistory: [], spend: 0,
    ppcSales: 0, organicSales: 0, totalSales: 0, ppcOrders: 0, organicOrders: 0, totalOrders: 0, targetAcos: 0,
    acos: 0, tacos: 0, goals: carriedGoals, goalHistory: [], previousWeekResult: previousReport?.previousWeekResult || "",
    notes: "", actions: DEFAULT_ACTIONS.map(action => ({ ...action })), updatedAt: null,
  };
}

function roundMoney(value: number) { return Math.round(value * 100) / 100; }

export function calculateWeeklyPerformance(metrics: WeeklyPerformanceSourceMetrics): WeeklyPerformanceCalculatedMetrics {
  return {
    ...metrics,
    organicSales: roundMoney(Math.max(0, metrics.totalSales - metrics.ppcSales)),
    organicOrders: Math.max(0, metrics.totalOrders - metrics.ppcOrders),
    acos: metrics.ppcSales ? Math.round((metrics.spend / metrics.ppcSales) * 10000) / 100 : 0,
    tacos: metrics.totalSales ? Math.round((metrics.spend / metrics.totalSales) * 10000) / 100 : 0,
    ...(metrics.totalSessions == null ? {} : { conversionRate: metrics.totalSessions ? Math.round((metrics.totalOrders / metrics.totalSessions) * 10000) / 100 : 0 }),
  };
}

export function withCalculatedPerformance(report: WeeklyPpcReport): WeeklyPpcReport {
  return { ...report, ...calculateWeeklyPerformance(report) };
}

export function weeklyGoalLabel(metric: WeeklyGoalMetric) {
  return WEEKLY_GOAL_OPTIONS.find(option => option.value === metric)?.label ?? "Goal";
}

export function weeklyGoalUnit(metric: WeeklyGoalMetric, preferred?: WeeklyGoalUnit): WeeklyGoalUnit {
  if (metric === "increaseSpend" || metric === "decreaseSpend" || metric === "ppcSales" || metric === "totalSales") return "currency";
  if (metric === "acos" || metric === "tacos") return "percentage";
  if (metric === "organicOrders" && preferred === "percentage") return "percentage";
  return "number";
}

export function weeklyGoalActualValue(goal: WeeklyGoal, report: WeeklyPpcReport): number | null {
  if (!goal.metric) return null;
  if (goal.metric === "increaseSpend" || goal.metric === "decreaseSpend") return report.spend;
  if (goal.metric === "ppcSales") return report.ppcSales;
  if (goal.metric === "totalSales") return report.totalSales;
  if (goal.metric === "ppcOrders") return report.ppcOrders;
  if (goal.metric === "totalOrders") return report.totalOrders;
  if (goal.metric === "acos") return report.acos;
  if (goal.metric === "tacos") return report.tacos;
  if (weeklyGoalUnit(goal.metric, goal.unit) === "percentage") {
    return report.totalOrders ? (report.organicOrders / report.totalOrders) * 100 : 0;
  }
  return report.organicOrders;
}

export function formatWeeklyGoalValue(goal: WeeklyGoal, value: number | null) {
  if (value == null) return "";
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value));
  const unit = goal.metric ? weeklyGoalUnit(goal.metric, goal.unit) : goal.unit;
  return unit === "currency" ? `$${formatted}` : unit === "percentage" ? `${formatted}%` : formatted;
}

export function formatWeeklyGoalTarget(goal: WeeklyGoal) {
  const raw = goal.target.trim();
  if (!raw) return "";
  if (!goal.metric && !goal.unit) return raw;
  const value = Number(raw.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(value) || value < 0) return raw;
  const unit = goal.metric ? weeklyGoalUnit(goal.metric, goal.unit) : goal.unit;
  if (unit === "currency") return `$${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
  if (unit === "percentage") return `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}%`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function finiteNumber(value: unknown) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? number : 0; }

function normalizeGoal(value: unknown, index: number): WeeklyGoal | null {
  if (!isRecord(value)) return null;
  const title = String(value.title ?? "").trim();
  if (!title) return null;
  const statuses: GoalStatus[] = ["On Track", "At Risk", "Achieved", "Missed"];
  const metrics: WeeklyGoalMetric[] = ["increaseSpend", "decreaseSpend", "ppcSales", "totalSales", "ppcOrders", "organicOrders", "totalOrders", "acos", "tacos"];
  const normalizedTitle = title.toLowerCase();
  const legacyMetric: WeeklyGoalMetric | undefined = value.metric === "spend"
    ? normalizedTitle.includes("increase") ? "increaseSpend" : "decreaseSpend"
    : value.metric === "sales" ? "ppcSales" : undefined;
  const storedMetric = metrics.includes(value.metric as WeeklyGoalMetric) ? value.metric as WeeklyGoalMetric : legacyMetric;
  const inferredMetric: WeeklyGoalMetric | undefined = normalizedTitle.includes("organic") && normalizedTitle.includes("order") ? "organicOrders"
    : normalizedTitle.includes("total") && normalizedTitle.includes("order") ? "totalOrders"
    : normalizedTitle.includes("ppc") && normalizedTitle.includes("order") ? "ppcOrders"
      : normalizedTitle.includes("tacos") ? "tacos"
        : normalizedTitle.includes("acos") ? "acos"
          : normalizedTitle.includes("increase") && normalizedTitle.includes("spend") ? "increaseSpend"
            : normalizedTitle.includes("spend") ? "decreaseSpend"
              : normalizedTitle.includes("total") && normalizedTitle.includes("sales") ? "totalSales"
                : normalizedTitle.includes("sales") ? "ppcSales"
                  : undefined;
  const metric = storedMetric ?? inferredMetric;
  const preferredUnit = value.unit === "percentage" || value.unit === "number" || value.unit === "currency" ? value.unit : undefined;
  return {
    id: String(value.id ?? `goal-${index}`), title, target: String(value.target ?? ""), actual: String(value.actual ?? ""),
    status: statuses.includes(value.status as GoalStatus) ? value.status as GoalStatus : "On Track",
    ...(metric ? { metric, unit: weeklyGoalUnit(metric, preferredUnit) } : {}),
  };
}

function normalizeGoalHistoryEntry(value: unknown, index: number): GoalHistoryEntry | null {
  const goal = normalizeGoal(value, index);
  if (!goal || (goal.status !== "Achieved" && goal.status !== "Missed") || !isRecord(value)) return null;
  const resolvedAt = typeof value.resolvedAt === "string" ? value.resolvedAt : "";
  if (!resolvedAt || Number.isNaN(new Date(resolvedAt).getTime())) return null;
  const dataState = value.dataState === "Partial" || value.dataState === "Final" ? value.dataState : undefined;
  return { ...goal, status: goal.status, resolvedAt: new Date(resolvedAt).toISOString(), ...(dataState ? { dataState } : {}) };
}

function normalizeAction(value: unknown, index: number): ActionItem | null {
  if (!isRecord(value)) return null;
  const title = String(value.title ?? "").trim();
  if (!title) return null;
  const priorities: ActionItem["priority"][] = ["High", "Medium", "Low"];
  return { id: String(value.id ?? `action-${index}`), title, priority: priorities.includes(value.priority as ActionItem["priority"]) ? value.priority as ActionItem["priority"] : "Medium", dueDate: String(value.dueDate ?? ""), done: value.done === true };
}

function normalizeBudgetChange(value: unknown, index: number): BudgetChange | null {
  if (!isRecord(value)) return null;
  const changedAt = typeof value.changedAt === "string" ? value.changedAt : "";
  const from = Number(value.from);
  const to = Number(value.to);
  if (!changedAt || Number.isNaN(new Date(changedAt).getTime()) || !Number.isFinite(from) || from < 0 || !Number.isFinite(to) || to < 0 || from === to) return null;
  return { id: String(value.id ?? `budget-change-${index}`).slice(0, 100), changedAt: new Date(changedAt).toISOString(), from, to };
}

function normalizeReport(value: unknown): WeeklyPpcReport | null {
  if (!isRecord(value)) return null;
  const productId = String(value.productId ?? "").trim();
  const storedWeekStart = String(value.weekStart ?? "").trim();
  if (!productId || !/^\d{4}-\d{2}-\d{2}$/.test(storedWeekStart)) return null;
  const storedWeekDate = dateFromIso(storedWeekStart);
  if (Number.isNaN(storedWeekDate.getTime())) return null;
  const weekStart = storedWeekDate.getDay() === LEGACY_REPORTING_WEEK_START_DAY ? addDaysIso(storedWeekStart, 2) : storedWeekStart;
  const statuses: ReportStatus[] = ["Draft", "In Progress", "Completed", "Needs Review"];
  const parsedGoals = Array.isArray(value.goals) ? value.goals.map(normalizeGoal).filter((goal): goal is WeeklyGoal => Boolean(goal)) : [];
  const goals = parsedGoals.filter(goal => goal.status !== "Achieved" && goal.status !== "Missed");
  const updatedAt = typeof value.updatedAt === "string" && !Number.isNaN(new Date(value.updatedAt).getTime()) ? new Date(value.updatedAt).toISOString() : null;
  const storedGoalHistory = Array.isArray(value.goalHistory)
    ? value.goalHistory.map(normalizeGoalHistoryEntry).filter((goal): goal is GoalHistoryEntry => Boolean(goal))
    : [];
  const legacyGoalHistory: GoalHistoryEntry[] = parsedGoals.flatMap(goal => goal.status === "Achieved" || goal.status === "Missed"
    ? [{ ...goal, status: goal.status, resolvedAt: updatedAt ?? new Date(`${weekStart}T12:00:00.000Z`).toISOString() }]
    : []);
  const goalHistory = [...storedGoalHistory, ...legacyGoalHistory]
    .filter((goal, index, entries) => entries.findIndex(candidate => candidate.id === goal.id) === index)
    .slice(0, 100);
  const actions = Array.isArray(value.actions) ? value.actions.map(normalizeAction).filter((action): action is ActionItem => Boolean(action)) : [];
  const budgetHistory = Array.isArray(value.budgetHistory)
    ? value.budgetHistory.map(normalizeBudgetChange).filter((change): change is BudgetChange => Boolean(change)).slice(0, 100)
    : [];
  const ppcSales = finiteNumber(value.ppcSales ?? value.sales);
  const organicSales = finiteNumber(value.organicSales);
  const ppcOrders = finiteNumber(value.ppcOrders ?? value.orders);
  const organicOrders = finiteNumber(value.organicOrders);
  const totalSessions = value.totalSessions == null ? undefined : finiteNumber(value.totalSessions);
  return withCalculatedPerformance({
    productId, weekStart, status: statuses.includes(value.status as ReportStatus) ? value.status as ReportStatus : "Draft",
    weeklyBudget: finiteNumber(value.weeklyBudget), dailyBudget: finiteNumber(value.dailyBudget), budgetHistory, spend: finiteNumber(value.spend),
    ppcSales, organicSales, totalSales: value.totalSales == null ? ppcSales + organicSales : finiteNumber(value.totalSales),
    ppcOrders, organicOrders, totalOrders: value.totalOrders == null ? ppcOrders + organicOrders : finiteNumber(value.totalOrders),
    ...(totalSessions == null ? {} : { totalSessions }),
    targetAcos: finiteNumber(value.targetAcos), acos: finiteNumber(value.acos), tacos: finiteNumber(value.tacos),
    goals: Array.isArray(value.goals) ? goals : DEFAULT_GOALS.map(goal => ({ ...goal })), goalHistory, previousWeekResult: String(value.previousWeekResult ?? ""), notes: String(value.notes ?? ""),
    actions: actions.length ? actions : DEFAULT_ACTIONS.map(action => ({ ...action })), updatedAt,
  });
}

export function parsePpcDashboardStore(raw: string | null): PpcDashboardStore {
  if (!raw) return { version: 1, reports: {} };
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== 1 || !isRecord(value.reports)) return { version: 1, reports: {} };
    const reports: Record<string, WeeklyPpcReport> = {};
    for (const candidate of Object.values(value.reports)) {
      const report = normalizeReport(candidate);
      if (report) reports[reportKey(report.productId, report.weekStart)] = report;
    }
    return { version: 1, reports };
  } catch { return { version: 1, reports: {} }; }
}

function dateFromIso(iso: string) { return new Date(`${iso}T12:00:00`); }
export function toIsoDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
export function startOfWeekIso(iso: string) { const date = dateFromIso(iso); const daysSinceWednesday = (date.getDay() - REPORTING_WEEK_START_DAY + 7) % 7; date.setDate(date.getDate() - daysSinceWednesday); return toIsoDate(date); }
export function addDaysIso(iso: string, days: number) { const date = dateFromIso(iso); date.setDate(date.getDate() + days); return toIsoDate(date); }
export function addMonthsIso(iso: string, months: number) { const date = dateFromIso(iso); date.setDate(1); date.setMonth(date.getMonth() + months); return toIsoDate(date); }
export function getMonthWeekStarts(monthIso: string) {
  const month = dateFromIso(monthIso); const last = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12); const starts: string[] = [];
  let cursor = startOfWeekIso(toIsoDate(new Date(month.getFullYear(), month.getMonth(), 1, 12)));
  while (dateFromIso(cursor) <= last) { starts.push(cursor); cursor = addDaysIso(cursor, 7); }
  return starts.reverse();
}
export function getSelectedMonthWeekStarts(monthKeys: string[], maximumWeekStart?: string) {
  const selectedMonths = [...new Set(monthKeys)]
    .filter(monthKey => /^\d{4}-\d{2}$/.test(monthKey) && toIsoDate(dateFromIso(`${monthKey}-01`)).slice(0, 7) === monthKey);
  return [...new Set(selectedMonths.flatMap(monthKey => getMonthWeekStarts(`${monthKey}-01`)))]
    .filter(weekStart => !maximumWeekStart || weekStart <= maximumWeekStart)
    .sort((first, second) => second.localeCompare(first));
}
export function formatReportingMonthRange(weekStarts: string[]) {
  const monthKeys = [...new Set(weekStarts.flatMap(weekStart => [weekStart.slice(0, 7), addDaysIso(weekStart, 6).slice(0, 7)]))].sort();
  if (!monthKeys.length) return "No months selected";
  const monthName = (monthKey: string, style: "long" | "short", includeYear = true) => new Intl.DateTimeFormat("en-US", {
    month: style, ...(includeYear ? { year: "numeric" as const } : {}),
  }).format(dateFromIso(`${monthKey}-01`));
  if (monthKeys.length === 1) return monthName(monthKeys[0], "long");
  if (monthKeys.length === 2) {
    const sameYear = monthKeys[0].slice(0, 4) === monthKeys[1].slice(0, 4);
    return sameYear
      ? `${monthName(monthKeys[0], "long", false)} & ${monthName(monthKeys[1], "long")}`
      : `${monthName(monthKeys[0], "long")} & ${monthName(monthKeys[1], "long")}`;
  }
  const consecutive = monthKeys.every((monthKey, index) => addMonthsIso(`${monthKeys[0]}-01`, index).slice(0, 7) === monthKey);
  const sameYear = monthKeys[0].slice(0, 4) === monthKeys.at(-1)?.slice(0, 4);
  if (consecutive) return sameYear
    ? `${monthName(monthKeys[0], "long", false)}–${monthName(monthKeys.at(-1)!, "long")}`
    : `${monthName(monthKeys[0], "short")}–${monthName(monthKeys.at(-1)!, "short")}`;
  return `${monthKeys.length} months · ${monthName(monthKeys[0], "short")}–${monthName(monthKeys.at(-1)!, "short")}`;
}
export function formatMonth(iso: string) { return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(dateFromIso(iso)); }
export function formatWeekRange(weekStart: string) {
  const start = dateFromIso(weekStart); const end = dateFromIso(addDaysIso(weekStart, 6));
  const formatter = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });
  return `${formatter.format(start)} to ${formatter.format(end)}`;
}
export function getIsoWeekNumber(iso: string) { const date = dateFromIso(iso); const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); const day = utc.getUTCDay() || 7; utc.setUTCDate(utc.getUTCDate() + 4 - day); const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1)); return Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7); }
export function currency(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0); }
export function percentage(numerator: number, denominator: number) { return denominator ? Math.min(999, Math.round((numerator / denominator) * 100)) : 0; }
