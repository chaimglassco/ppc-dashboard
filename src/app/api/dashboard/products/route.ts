import { getPipelineOrigin, verifyPipelineRequest } from "@/lib/pipeline-auth-server";
import type { DashboardProduct } from "@/features/dashboard/domain/ppc-dashboard-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WorkspaceProduct = { id?: unknown; name?: unknown; asin?: unknown; sku?: unknown; stageId?: unknown };

export function normalizeDashboardProducts(value: unknown): DashboardProduct[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const state = (value as Record<string, unknown>).state;
  if (!state || typeof state !== "object" || Array.isArray(state)) return [];
  const products = (state as Record<string, unknown>).userProducts;
  if (!Array.isArray(products)) return [];
  const seen = new Set<string>();
  return products.flatMap((candidate): DashboardProduct[] => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const product = candidate as WorkspaceProduct;
    const id = String(product.id ?? "").trim();
    const name = String(product.name ?? "").trim();
    if (!id || !name || seen.has(id)) return [];
    seen.add(id);
    return [{
      id,
      name,
      asin: String(product.asin ?? "").trim(),
      sku: String(product.sku ?? "").trim(),
      stageId: String(product.stageId ?? "product-research").trim() || "product-research",
      status: "Active",
    }];
  });
}

export async function GET(request: Request) {
  const verified = await verifyPipelineRequest(request);
  if (verified instanceof Response) return verified;
  const authorization = request.headers.get("authorization") || "";
  try {
    const response = await fetch(`${getPipelineOrigin()}/api/workspace-state`, {
      headers: { Authorization: authorization },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const value: unknown = await response.json();
    if (response.status === 401) return Response.json({ error: "Your Pipeline session has expired." }, { status: 401 });
    if (!response.ok) return Response.json({ error: "Pipeline products are temporarily unavailable." }, { status: 503 });
    return Response.json({ products: normalizeDashboardProducts(value) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch {
    return Response.json({ error: "Pipeline products are temporarily unavailable." }, { status: 503 });
  }
}
