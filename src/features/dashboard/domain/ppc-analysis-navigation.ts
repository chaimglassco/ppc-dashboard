export const PPC_ANALYSIS_SECTIONS = [
  { slug: "campaigns", label: "Campaigns", description: "Campaign-level performance and structure." },
  { slug: "keyword-targeting", label: "Keyword Targeting", description: "Keyword bids, sales, orders, and efficiency." },
  { slug: "product-targeting", label: "Product Targeting", description: "ASIN and category targeting performance." },
  { slug: "search-terms", label: "Search Terms", description: "Customer queries and their attributed results." },
  { slug: "match-types", label: "Match Types", description: "Performance grouped by broad, phrase, and exact match." },
  { slug: "placements", label: "Placements", description: "Top-of-search, rest-of-search, and product-page results." },
  { slug: "ad-types", label: "Ad Types", description: "Sponsored Products, Brands, and Display performance." },
  { slug: "main-keywords", label: "Main Keywords", description: "Priority keyword coverage and performance." },
] as const;

export type PpcAnalysisSlug = (typeof PPC_ANALYSIS_SECTIONS)[number]["slug"];

export function normalizeDashboardAsin(value: string) {
  const asin = value.trim().toUpperCase();
  return /^[A-Z0-9]{10}$/.test(asin) ? asin : "";
}

export function getPpcAnalysisSection(value: string) {
  return PPC_ANALYSIS_SECTIONS.find(section => section.slug === value) ?? null;
}

export function getPpcAnalysisHref(asinValue: string, section: PpcAnalysisSlug) {
  const asin = normalizeDashboardAsin(asinValue);
  return asin ? `/dashboard/products/${encodeURIComponent(asin)}/${section}` : "/dashboard";
}
