export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };
const pipelineOrigin = (process.env.PIPELINE_AUTH_ORIGIN || "https://glasscopipeline.vercel.app").replace(/\/$/, "");
const UPSTREAM_TIMEOUT_MS = 15_000;

async function proxyLibraryRequest(request: Request, method: "GET" | "PATCH" | "POST") {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return Response.json({ error: "Sign in through Product Pipeline to continue." }, { status: 401, headers: noStoreHeaders });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const requestUrl = new URL(request.url);
    const upstream = new URL("/api/library-state", pipelineOrigin);
    upstream.search = requestUrl.search;
    const response = await fetch(upstream, {
      method,
      headers: { Authorization: authorization, ...(method === "GET" ? {} : { "Content-Type": "application/json" }) },
      body: method === "GET" ? undefined : await request.text(),
      cache: "no-store",
      signal: controller.signal,
    });
    return new Response(response.body, { status: response.status, headers: { ...noStoreHeaders, "Content-Type": response.headers.get("content-type") || "application/json" } });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return Response.json({ error: "The Library service took too long to respond. Please try again." }, { status: 504, headers: noStoreHeaders });
    }
    return Response.json({ error: "The shared library is temporarily unavailable." }, { status: 503, headers: noStoreHeaders });
  } finally {
    clearTimeout(timeout);
  }
}

export function GET(request: Request) { return proxyLibraryRequest(request, "GET"); }
export function PATCH(request: Request) { return proxyLibraryRequest(request, "PATCH"); }
export function POST(request: Request) { return proxyLibraryRequest(request, "POST"); }
