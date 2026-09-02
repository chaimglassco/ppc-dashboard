export const PPC_DASHBOARD_STORAGE_KEY = "glassco.ppcPerformanceNotes.v1";

export type DashboardProduct = { id: string; name: string; asin: string; sku: string; stageId: string; status: "Active" | "Paused" };
export type GoalStatus = "On Track" | "At Risk" | "Achieved" | "Missed";
export type ReportStatus = "Draft" | "In Progress" | "Completed" | "Needs Review";
export type WeeklyGoal = { id: string; title: string; target: string; actual: string; status: GoalStatus };
export type ActionItem = { id: string; title: string; priority: "High" | "Medium" | "Low"; dueDate: string; done: boolean };
export type WeeklyPpcReport = {
  productId: string; weekStart: string; status: ReportStatus; weeklyBudget: number; dailyBudget: number;
  spend: number; sales: number; orders: number; impressions: number; clicks: number; acos: number; roas: number;
  goals: WeeklyGoal[]; previousWeekResult: string; notes: string; actions: ActionItem[]; updatedAt: string | null;
};
export type PpcDashboardStore = { version: 1; reports: Record<string, WeeklyPpcReport> };

const DEFAULT_GOALS: WeeklyGoal[] = [
  { id: "goal-acos", title: "Reduce ACOS", target: "25%", actual: "", status: "On Track" },
  { id: "goal-roas", title: "Increase ROAS", target: "6.5", actual: "", status: "On Track" },
];
const DEFAULT_ACTIONS: ActionItem[] = [
  { id: "action-negatives", title: "Review search terms and add negative exact keywords", priority: "High", dueDate: "", done: false },
];
const REPORTING_WEEK_START_DAY = 3;
const LEGACY_REPORTING_WEEK_START_DAY = 1;

export function reportKey(productId: string, weekStart: string) { return `${productId}:${weekStart}`; }

export function createWeeklyPpcReport(productId: string, weekStart: string): WeeklyPpcReport {
  return {
    productId, weekStart, status: "Draft", weeklyBudget: 0, dailyBudget: 0, spend: 0, sales: 0, orders: 0,
    impressions: 0, clicks: 0, acos: 0, roas: 0, goals: DEFAULT_GOALS.map(goal => ({ ...goal })), previousWeekResult: "",
    notes: "", actions: DEFAULT_ACTIONS.map(action => ({ ...action })), updatedAt: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function finiteNumber(value: unknown) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? number : 0; }

function normalizeGoal(value: unknown, index: number): WeeklyGoal | null {
  if (!isRecord(value)) return null;
  const title = String(value.title ?? "").trim();
  if (!title) return null;
  const statuses: GoalStatus[] = ["On Track", "At Risk", "Achieved", "Missed"];
  return { id: String(value.id ?? `goal-${index}`), title, target: String(value.target ?? ""), actual: String(value.actual ?? ""), status: statuses.includes(value.status as GoalStatus) ? value.status as GoalStatus : "On Track" };
}

function normalizeAction(value: unknown, index: number): ActionItem | null {
  if (!isRecord(value)) return null;
  const title = String(value.title ?? "").trim();
  if (!title) return null;
  const priorities: ActionItem["priority"][] = ["High", "Medium", "Low"];
  return { id: String(value.id ?? `action-${index}`), title, priority: priorities.includes(value.priority as ActionItem["priority"]) ? value.priority as ActionItem["priority"] : "Medium", dueDate: String(value.dueDate ?? ""), done: value.done === true };
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
  const goals = Array.isArray(value.goals) ? value.goals.map(normalizeGoal).filter((goal): goal is WeeklyGoal => Boolean(goal)) : [];
  const actions = Array.isArray(value.actions) ? value.actions.map(normalizeAction).filter((action): action is ActionItem => Boolean(action)) : [];
  return {
    productId, weekStart, status: statuses.includes(value.status as ReportStatus) ? value.status as ReportStatus : "Draft",
    weeklyBudget: finiteNumber(value.weeklyBudget), dailyBudget: finiteNumber(value.dailyBudget), spend: finiteNumber(value.spend), sales: finiteNumber(value.sales),
    orders: finiteNumber(value.orders), impressions: finiteNumber(value.impressions), clicks: finiteNumber(value.clicks), acos: finiteNumber(value.acos), roas: finiteNumber(value.roas),
    goals: goals.length ? goals : DEFAULT_GOALS.map(goal => ({ ...goal })), previousWeekResult: String(value.previousWeekResult ?? ""), notes: String(value.notes ?? ""),
    actions: actions.length ? actions : DEFAULT_ACTIONS.map(action => ({ ...action })), updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
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
export function formatMonth(iso: string) { return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(dateFromIso(iso)); }
export function formatWeekRange(weekStart: string) {
  const start = dateFromIso(weekStart); const end = dateFromIso(addDaysIso(weekStart, 6)); const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(start);
  const endLabel = new Intl.DateTimeFormat("en-US", { month: sameMonth ? undefined : "short", day: "numeric", year: "numeric" }).format(end);
  return `${startLabel} – ${endLabel}`;
}
export function getIsoWeekNumber(iso: string) { const date = dateFromIso(iso); const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); const day = utc.getUTCDay() || 7; utc.setUTCDate(utc.getUTCDate() + 4 - day); const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1)); return Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7); }
export function currency(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0); }
export function percentage(numerator: number, denominator: number) { return denominator ? Math.min(999, Math.round((numerator / denominator) * 100)) : 0; }
