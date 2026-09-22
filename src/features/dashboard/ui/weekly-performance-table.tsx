"use client";

import { addDaysIso, type GoalDataState, type WeeklyPpcReport } from "../domain/ppc-dashboard-state";
import ws from "./ppc-performance-workspace.module.css";

type WeeklyTableMetric =
  | "ppcImpressions"
  | "ppcClicks"
  | "cpc"
  | "spend"
  | "ppcSales"
  | "ppcOrders"
  | "ppcUnits"
  | "organicSales"
  | "organicOrders"
  | "organicUnits"
  | "acos"
  | "tacos";

type WeeklyTableMetricDefinition = {
  key: WeeklyTableMetric;
  label: string;
  kind: "number" | "currency" | "percentage";
  group: "paid" | "organic" | "efficiency";
};

const WEEKLY_TABLE_METRICS: readonly WeeklyTableMetricDefinition[] = [
  { key: "ppcImpressions", label: "Impressions", kind: "number", group: "paid" },
  { key: "ppcClicks", label: "Clicks", kind: "number", group: "paid" },
  { key: "cpc", label: "CPC", kind: "currency", group: "paid" },
  { key: "spend", label: "Spend", kind: "currency", group: "paid" },
  { key: "ppcSales", label: "PPC Sales", kind: "currency", group: "paid" },
  { key: "ppcOrders", label: "PPC Orders", kind: "number", group: "paid" },
  { key: "ppcUnits", label: "PPC Units", kind: "number", group: "paid" },
  { key: "organicSales", label: "Organic Sales", kind: "currency", group: "organic" },
  { key: "organicOrders", label: "Organic Orders", kind: "number", group: "organic" },
  { key: "organicUnits", label: "Organic Units", kind: "number", group: "organic" },
  { key: "acos", label: "ACOS", kind: "percentage", group: "efficiency" },
  { key: "tacos", label: "TACOS", kind: "percentage", group: "efficiency" },
];

const EDITABLE_METRICS = new Set<WeeklyTableMetric>([
  "ppcImpressions",
  "ppcClicks",
  "ppcUnits",
  "spend",
  "ppcSales",
  "ppcOrders",
]);

export type WeeklyTableColumn = {
  weekStart: string;
  report: WeeklyPpcReport | null;
  dataState: GoalDataState | null;
};

function numericValue(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function metricValue(report: WeeklyPpcReport | null, key: WeeklyTableMetric) {
  return report?.[key] as number | undefined;
}

function formatMetric(value: number | undefined, kind: WeeklyTableMetricDefinition["kind"]) {
  if (value == null || !Number.isFinite(value)) return "—";
  if (kind === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  if (kind === "percentage") {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`;
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function tableDateParts(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00Z`);
  const end = new Date(`${addDaysIso(weekStart, 6)}T12:00:00Z`);
  const format = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
  return { start: format.format(start), end: format.format(end) };
}

export function WeeklyPerformanceTable({
  columns,
  selectedWeekStart,
  importedLocked,
  onChange,
}: {
  columns: WeeklyTableColumn[];
  selectedWeekStart: string;
  importedLocked: boolean;
  onChange: (patch: Partial<WeeklyPpcReport>) => void;
}) {
  const cellInput = (
    definition: WeeklyTableMetricDefinition,
    column: WeeklyTableColumn,
    value: number | undefined,
  ) => {
    const isSelected = column.weekStart === selectedWeekStart;
    const editable = isSelected && !importedLocked && EDITABLE_METRICS.has(definition.key);
    if (!editable || value == null) {
      return (
        <span className={value == null ? ws.weeklyUnavailable : undefined}>
          {formatMetric(value, definition.kind)}
        </span>
      );
    }
    return (
      <input
        aria-label={definition.label}
        inputMode="decimal"
        value={definition.kind === "currency" ? value.toFixed(2) : String(Math.round(value))}
        onChange={event => onChange({ [definition.key]: numericValue(event.target.value) })}
      />
    );
  };

  return (
    <div className={ws.weeklyTableWrap}>
      <table className={ws.weeklyTable} aria-label="Six-week Scale Insights performance">
        <thead>
          <tr>
            <th scope="col">Metric</th>
            {columns.map(column => {
              const dates = tableDateParts(column.weekStart);
              const selected = column.weekStart === selectedWeekStart;
              return (
                <th
                  key={column.weekStart}
                  scope="col"
                  className={selected ? ws.weeklySelectedColumn : undefined}
                  aria-label={`${dates.start} to ${dates.end}${selected ? ", selected week" : ""}`}
                >
                  <span>{dates.start}</span>
                  <span>{dates.end}</span>
                  <small>{selected ? "Selected · " : ""}{column.dataState ?? "Saved"}</small>
                </th>
              );
            })}
            <th scope="col">Analysis</th>
          </tr>
        </thead>
        <tbody>
          {WEEKLY_TABLE_METRICS.map((definition, index) => {
            const values = columns
              .map(column => metricValue(column.report, definition.key))
              .filter((value): value is number => value != null && Number.isFinite(value));
            const maximum = Math.max(...values, 1);
            const previousGroup = WEEKLY_TABLE_METRICS[index - 1]?.group;
            return (
              <tr
                key={definition.key}
                className={previousGroup && previousGroup !== definition.group ? ws.weeklyGroupStart : undefined}
              >
                <th scope="row">{definition.label}</th>
                {columns.map(column => {
                  const value = metricValue(column.report, definition.key);
                  return (
                    <td
                      key={column.weekStart}
                      className={column.weekStart === selectedWeekStart ? ws.weeklySelectedColumn : undefined}
                    >
                      {cellInput(definition, column, value)}
                    </td>
                  );
                })}
                <td className={ws.weeklyTrend} aria-label={`${definition.label} six-week trend`}>
                  {columns.map(column => {
                    const value = metricValue(column.report, definition.key);
                    return (
                      <i
                        key={column.weekStart}
                        style={{ height: `${value == null ? 2 : Math.max(8, (value / maximum) * 100)}%` }}
                      />
                    );
                  })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
