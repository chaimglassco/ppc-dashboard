import { getPipelineOrigin, verifyPipelineRequest } from "@/lib/pipeline-auth-server";
import { normalizeDashboardProducts } from "@/features/dashboard/domain/pipeline-products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
