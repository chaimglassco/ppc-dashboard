import { useState } from "react";
import { BarChart3, CalendarDays, ChevronDown, Database, Gauge, PackageSearch, Search, X } from "lucide-react";
import { addDaysIso, currency, getIsoWeekNumber, reportKey, type WeeklyPpcReport } from "../domain/ppc-dashboard-state";
import type { ManagedDashboardProduct } from "../domain/ppc-dashboard-catalog";
import styles from "./performance-overview-dashboard.module.css";

type Props = {
  products: ManagedDashboardProduct[];
  reports: Record<string, WeeklyPpcReport>;
  currentWeekStart: string;
  todayIso: string;
};

type LedgerSummary = {
  reports: number;
  totalSales: number;
  ppcSales: number;
  spend: number;
  totalOrders: number;
  ppcOrders: number;
};

const EMPTY_SUMMARY: LedgerSummary = { reports: 0, totalSales: 0, ppcSales: 0, spend: 0, totalOrders: 0, ppcOrders: 0 };

const DETAIL_SECTIONS = [
  {
    title: "Keyword Targeting Performance // Top Keyword Movers & Efficiency",
    description: "Granular bid-level telemetry across active Sponsored Products and Sponsored Brands keyword clusters.",
    columns: ["# & Status", "Keyword Target & Match Type", "Campaign / ASIN", "Impr. / CTR", "Clicks / CPC", "Spend", "Sales", "Orders / CVR", "ACOS", "ROAS"],
  },
  {
    title: "Campaign Level Movers & Efficiency // Sponsored Ads Campaign Clusters",
    description: "Campaign movement, efficiency, and budget actions across the account.",
    columns: ["# & Status", "Campaign & Targeting Type", "Spend", "Sales", "Orders", "ACOS", "ROAS", "Spend Share", "Sales Share", "Momentum / Action"],
  },
  {
    title: "Product & ASIN Targeting // Competitor Conquesting & Defense Matrix",
    description: "Product-target performance grouped by target ASIN and campaign context.",
    columns: ["# & Status", "Target ASIN / Category", "Product Context", "Target Type", "Spend", "Sales", "Orders", "ACOS", "Conversion Rate", "Diagnosis"],
  },
  {
    title: "Search Terms Report // Customer Search Query Intelligence & Harvesting",
    description: "Customer queries, attributed outcomes, and keyword-harvest recommendations.",
    columns: ["# & Recommendation", "Customer Search Query", "Targeted Keyword / Campaign", "Match Type", "Clicks", "Spend", "Sales", "Orders", "ACOS", "Directive"],
  },
] as const;

function hasPerformance(report: WeeklyPpcReport | undefined) {
  return Boolean(report && (report.spend || report.ppcSales || report.totalSales || report.ppcOrders || report.totalOrders || report.updatedAt));
}

function summarize(products: ManagedDashboardProduct[], reports: Record<string, WeeklyPpcReport>, weekStarts: string[]) {
  return products.reduce<LedgerSummary>((summary, product) => weekStarts.reduce<LedgerSummary>((next, weekStart) => {
    const report = reports[reportKey(product.id, weekStart)];
    if (!hasPerformance(report)) return next;
    return {
      reports: next.reports + 1,
      totalSales: next.totalSales + report.totalSales,
      ppcSales: next.ppcSales + report.ppcSales,
      spend: next.spend + report.spend,
      totalOrders: next.totalOrders + report.totalOrders,
      ppcOrders: next.ppcOrders + report.ppcOrders,
    };
  }, summary), { ...EMPTY_SUMMARY });
}

function percentage(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

function displayPercent(value: number | null) {
  return value == null ? "—" : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`;
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function displayRange(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${formatter.format(new Date(`${start}T12:00:00Z`))} — ${formatter.format(new Date(`${end}T12:00:00Z`))}`;
}

function TemporalCard({ index, label, range, summary, unavailableReason }: { index: number; label: string; range: string; summary?: LedgerSummary; unavailableReason?: string }) {
  const available = Boolean(summary?.reports);
  const acos = available ? percentage(summary!.spend, summary!.ppcSales) : null;
  const tacos = available ? percentage(summary!.spend, summary!.totalSales) : null;
  return <article className={styles.temporalCard}>
    <header><div><small>Index {String(index).padStart(2, "0")}</small><h2>{label}</h2><span>{range}</span></div><div><small>Net Sales</small><strong>{available ? currency(summary!.totalSales) : "—"}</strong></div></header>
    <div className={styles.cardAudit}><span><small>Coverage</small><strong>{available ? `${summary!.reports} saved report${summary!.reports === 1 ? "" : "s"}` : "Unavailable"}</strong></span><span><small>Data Source</small><strong>{available ? "Local weekly reports" : "Daily source pending"}</strong></span></div>
    <dl>
      <div><dt>Orders / PPC Orders</dt><dd>{available ? `${Math.round(summary!.totalOrders)} / ${Math.round(summary!.ppcOrders)}` : "—"}</dd></div>
      <div><dt>PPC Sales</dt><dd>{available ? currency(summary!.ppcSales) : "—"}</dd></div>
      <div><dt>Advertising Cost</dt><dd>{available ? currency(summary!.spend) : "—"}</dd></div>
      <div><dt>ACOS Actual</dt><dd>{displayPercent(acos)}</dd></div>
    </dl>
    <footer><span><small>Status</small><strong>{available ? "Saved data" : unavailableReason || "Awaiting data"}</strong></span><span><small>TACOS</small><strong>{displayPercent(tacos)}</strong></span></footer>
  </article>;
}

function DetailPlaceholder({ section, scopeLabel }: { section: (typeof DETAIL_SECTIONS)[number]; scopeLabel: string }) {
  return <details className={styles.ledgerSection}>
    <summary><div><span aria-hidden="true" /><div><h2>{section.title}</h2><p>{section.description}</p></div></div><span className={styles.disclosureMeta}><strong>Source pending</strong><ChevronDown aria-hidden="true" /></span></summary>
    <div className={styles.tableScroll}><table><thead><tr>{section.columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody><tr><td colSpan={section.columns.length}><div className={styles.emptyLedger}><Database aria-hidden="true" /><strong>No connected dataset yet</strong><span>{scopeLabel}. This table is ready for a campaign-level Scale Insights or CSV source in a later refinement.</span></div></td></tr></tbody></table></div>
  </details>;
}

export function PerformanceOverviewDashboard({ products, reports, currentWeekStart, todayIso }: Props) {
  const [asinFilter, setAsinFilter] = useState("");
  const normalizedFilter = asinFilter.trim().toLowerCase();
  const filteredProducts = normalizedFilter ? products.filter(product => [product.asin, product.sku, product.name].some(value => value?.toLowerCase().includes(normalizedFilter))) : products;
  const weekStarts = Array.from({ length: 5 }, (_, index) => addDaysIso(currentWeekStart, index * -7));
  const currentSummary = summarize(filteredProducts, reports, weekStarts.slice(0, 1));
  const fourteenDaySummary = summarize(filteredProducts, reports, weekStarts.slice(0, 2));
  const thirtyDaySummary = summarize(filteredProducts, reports, weekStarts);
  const currentRows = filteredProducts.flatMap(product => {
    const current = reports[reportKey(product.id, currentWeekStart)];
    if (!hasPerformance(current)) return [];
    const previous = reports[reportKey(product.id, addDaysIso(currentWeekStart, -7))];
    const momentum = previous?.totalSales ? Math.round(((current.totalSales - previous.totalSales) / previous.totalSales) * 1000) / 10 : null;
    return [{ product, current, momentum }];
  }).toSorted((first, second) => second.current.totalSales - first.current.totalSales);
  const filteredIds = new Set(filteredProducts.map(product => product.id));
  const latestUpdate = Object.values(reports).filter(report => filteredIds.has(report.productId)).map(report => report.updatedAt).filter(Boolean).toSorted().at(-1);
  const currentWeekEnd = addDaysIso(currentWeekStart, 6);
  const scopeLabel = normalizedFilter ? filteredProducts.length === 1 ? `Filtered to ${filteredProducts[0].asin || filteredProducts[0].sku || filteredProducts[0].name}` : `Filtered to ${filteredProducts.length} matching products` : "Showing all ASINs";

  return <main className={styles.overview} aria-label="Account performance dashboard">
    <section className={styles.telemetry} aria-label="Dashboard data status">
      <span><i aria-hidden="true" /><small>Data Source</small><strong>Browser-local weekly reports</strong></span>
      <span><small>Products</small><strong>{normalizedFilter ? `${filteredProducts.length} / ${products.length}` : products.length}</strong></span>
      <span><small>Latest Update</small><strong>{latestUpdate ? new Date(latestUpdate).toLocaleString() : "Awaiting saved data"}</strong></span>
      <span className={styles.prototypeBadge}>Initial dashboard</span>
    </section>

    <div className={styles.canvas}>
      <header className={styles.overviewHeader}><div><span>Week {getIsoWeekNumber(currentWeekStart)} · Multi-Timeframe Performance Ledger</span><h1>Performance Overview</h1><p>Monochrome account overview modeled from the supplied reference. Weekly cards and ASIN ranking use available local reports.</p></div><div className={styles.headerControls}><label className={styles.asinFilter}><Search aria-hidden="true" /><span className={styles.srOnly}>Filter dashboard by ASIN, SKU, or product name</span><input type="search" value={asinFilter} onChange={event => setAsinFilter(event.target.value)} placeholder="Filter ASIN performance" aria-label="Filter dashboard by ASIN, SKU, or product name" />{asinFilter ? <button type="button" onClick={() => setAsinFilter("")} aria-label="Clear ASIN performance filter"><X aria-hidden="true" /></button> : null}</label><div className={styles.auditWindow}><CalendarDays aria-hidden="true" /><span><small>Audit Window</small><strong>{displayRange(addDaysIso(currentWeekStart, -28), currentWeekEnd)}</strong></span></div><small className={styles.scopeStatus} aria-live="polite">{scopeLabel}</small></div></header>

      <details className={styles.temporalSection}>
        <summary className={styles.sectionKicker}><span><i aria-hidden="true" />Temporal Ledger Matrix // Continuous Historical Benchmarks</span><span className={styles.disclosureMeta}><small>Currency: USD ($)</small><ChevronDown aria-hidden="true" /></span></summary>
        <div className={styles.temporalGrid}>
          <TemporalCard index={1} label="Today" range={displayDate(todayIso)} unavailableReason="Daily source pending" />
          <TemporalCard index={2} label="Yesterday" range={displayDate(addDaysIso(todayIso, -1))} unavailableReason="Daily source pending" />
          <TemporalCard index={3} label="7 Days" range={displayRange(currentWeekStart, currentWeekEnd)} summary={currentSummary} />
          <TemporalCard index={4} label="14 Days" range={displayRange(addDaysIso(currentWeekStart, -7), currentWeekEnd)} summary={fourteenDaySummary} />
          <TemporalCard index={5} label="30 Days" range={displayRange(addDaysIso(currentWeekStart, -28), currentWeekEnd)} summary={thirtyDaySummary} />
        </div>
      </details>

      <details className={styles.ledgerSection}>
        <summary><div><span aria-hidden="true" /><div><h2>ASIN Velocity &amp; Performance Ranking // Net Sales Contribution Matrix</h2><p>Product-level results from saved reports for {displayRange(currentWeekStart, currentWeekEnd)}.</p></div></div><span className={styles.disclosureMeta}><strong>{currentRows.length} active row{currentRows.length === 1 ? "" : "s"}</strong><ChevronDown aria-hidden="true" /></span></summary>
        <div className={styles.tableScroll}><table><thead><tr><th>Rank &amp; Velocity</th><th>ASIN / SKU Details</th><th>Sales</th><th>Spend</th><th>Orders</th><th>ACOS</th><th>TACOS</th><th>Spend Share</th><th>Sales Share</th><th>WoW Momentum</th></tr></thead><tbody>{currentRows.length ? currentRows.map(({ product, current, momentum }, index) => <tr key={product.id}><td><span className={styles.rank}>{String(index + 1).padStart(2, "0")}</span></td><td><strong>{product.name}</strong><small>ASIN: {product.asin || "N/A"} · SKU: {product.sku || "N/A"}</small></td><td>{currency(current.totalSales)}</td><td>{currency(current.spend)}</td><td>{Math.round(current.totalOrders)}</td><td>{displayPercent(percentage(current.spend, current.ppcSales))}</td><td>{displayPercent(percentage(current.spend, current.totalSales))}</td><td>{displayPercent(percentage(current.spend, currentSummary.spend))}</td><td>{displayPercent(percentage(current.totalSales, currentSummary.totalSales))}</td><td className={momentum == null ? styles.neutral : momentum >= 0 ? styles.positive : styles.negative}>{momentum == null ? "New / unavailable" : `${momentum >= 0 ? "↗" : "↘"} ${Math.abs(momentum)}%`}</td></tr>) : <tr><td colSpan={10}><div className={styles.emptyLedger}><PackageSearch aria-hidden="true" /><strong>No saved reports for this week</strong><span>Open Products, select an ASIN, and refresh its weekly data to populate this ranking.</span></div></td></tr>}</tbody></table></div>
      </details>

      <details className={styles.coverageSection}><summary><span><i aria-hidden="true" />Overview Source Coverage</span><span className={styles.disclosureMeta}><small>{thirtyDaySummary.reports} saved rows</small><ChevronDown aria-hidden="true" /></span></summary><section className={styles.summaryStrip} aria-label="Overview source coverage"><span><BarChart3 aria-hidden="true" /><small>Saved weekly rows</small><strong>{thirtyDaySummary.reports}</strong></span><span><Gauge aria-hidden="true" /><small>30-day PPC ACOS</small><strong>{displayPercent(percentage(thirtyDaySummary.spend, thirtyDaySummary.ppcSales))}</strong></span><span><PackageSearch aria-hidden="true" /><small>Ranked products</small><strong>{currentRows.length}</strong></span></section></details>

      {DETAIL_SECTIONS.map(section => <DetailPlaceholder key={section.title} section={section} scopeLabel={scopeLabel} />)}
    </div>
  </main>;
}
