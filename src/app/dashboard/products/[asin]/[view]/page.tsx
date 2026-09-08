import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPpcAnalysisHref,
  getPpcAnalysisSection,
  normalizeDashboardAsin,
  PPC_ANALYSIS_SECTIONS,
} from "@/features/dashboard/domain/ppc-analysis-navigation";
import styles from "./ppc-analysis-page.module.css";

export const metadata: Metadata = {
  title: "ASIN PPC Analysis",
  description: "Product-scoped Amazon PPC analysis views.",
};

export const dynamic = "force-dynamic";

export default async function PpcAnalysisPage({ params }: { params: Promise<{ asin: string; view: string }> }) {
  const values = await params;
  const asin = normalizeDashboardAsin(values.asin);
  const section = getPpcAnalysisSection(values.view);
  if (!asin || !section) notFound();

  return <section className={styles.page} aria-label={`${section.label} for ASIN ${asin}`}>
    <header className={styles.header}>
      <div>
        <span>ASIN-SCOPED PPC ANALYSIS</span>
        <h1>{section.label}</h1>
        <p>Showing the dedicated workspace for <strong>{asin}</strong>.</p>
      </div>
      <Link className={styles.backLink} href="/dashboard">Back to Weekly Dashboard</Link>
    </header>

    <nav className={styles.navigation} aria-label={`Analysis sections for ASIN ${asin}`}>
      {PPC_ANALYSIS_SECTIONS.map(candidate => <Link
        key={candidate.slug}
        href={getPpcAnalysisHref(asin, candidate.slug)}
        aria-current={candidate.slug === section.slug ? "page" : undefined}
      >{candidate.label}</Link>)}
    </nav>

    <article className={styles.content}>
      <span className={styles.asinBadge}>{asin}</span>
      <h2>{section.label}</h2>
      <p>{section.description}</p>
      <div className={styles.scopeNotice} role="note">
        This view is locked to ASIN <strong>{asin}</strong>. Data from another product will not be displayed here.
      </div>
    </article>
  </section>;
}
