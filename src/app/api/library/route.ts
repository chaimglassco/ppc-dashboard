export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };
const pipelineOrigin = (process.env.PIPELINE_AUTH_ORIGIN || "https://glasscopipeline.vercel.app").replace(/\/$/, "");
const UPSTREAM_TIMEOUT_MS = 15_000;

function isDocumentDelete(body: string | undefined) {
  if (!body) return false;
  try {
    const value: unknown = JSON.parse(body);
    return Boolean(value && typeof value === "object" && (value as Record<string, unknown>).operation === "document.delete");
  } catch {
    return false;
  }
}

async function readActiveDocumentCount(authorization: string, requestId: string, signal: AbortSignal) {
  const response = await fetch(new URL("/api/library-state?summary=1", pipelineOrigin), {
    headers: { Authorization: authorization, "X-Request-ID": requestId },
    cache: "no-store",
    signal,
  });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok || !value || typeof value !== "object") {
    const details = value && typeof value === "object" ? value as Record<string, unknown> : {};
    throw new Error(typeof details.error === "string" ? details.error : "The Library could not verify its active documents.");
  }
  const state = (value as Record<string, unknown>).state;
  const documents = state && typeof state === "object" ? (state as Record<string, unknown>).documents : null;
  if (!Array.isArray(documents)) throw new Error("The Library returned invalid active-document data.");
  return documents.filter(document => {
    if (!document || typeof document !== "object") return false;
    return !((document as Record<string, unknown>).deletedAt);
  }).length;
}

async function proxyLibraryRequest(request: Request, method: "GET" | "PATCH" | "POST") {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return Response.json({ error: "Sign in through Product Pipeline to continue." }, { status: 401, headers: noStoreHeaders });
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const requestUrl = new URL(request.url);
    const upstream = new URL("/api/library-state", pipelineOrigin);
    upstream.search = requestUrl.search;
    const requestBody = method === "GET" ? undefined : await request.text();
    if (method === "PATCH" && isDocumentDelete(requestBody)) {
      const activeDocumentCount = await readActiveDocumentCount(authorization, requestId, controller.signal);
      if (activeDocumentCount <= 1) {
        return Response.json({
          error: "At least one active document must remain. Create or recover another document before deleting this one.",
          code: "LAST_ACTIVE_DOCUMENT",
        }, { status: 409, headers: { ...noStoreHeaders, "X-Request-ID": requestId } });
      }
    }
    const response = await fetch(upstream, {
      method,
      headers: { Authorization: authorization, "X-Request-ID": requestId, ...(method === "GET" ? {} : { "Content-Type": "application/json" }) },
      body: requestBody,
      cache: "no-store",
      signal: controller.signal,
    });
    return new Response(response.body, { status: response.status, headers: { ...noStoreHeaders, "Content-Type": response.headers.get("content-type") || "application/json", "X-Request-ID": response.headers.get("x-request-id") || requestId } });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return Response.json({ error: "The Library service took too long to respond. Please try again." }, { status: 504, headers: { ...noStoreHeaders, "X-Request-ID": requestId } });
    }
    return Response.json({ error: "The shared library is temporarily unavailable." }, { status: 503, headers: { ...noStoreHeaders, "X-Request-ID": requestId } });
  } finally {
    clearTimeout(timeout);
  }
}

export function GET(request: Request) { return proxyLibraryRequest(request, "GET"); }
export function PATCH(request: Request) { return proxyLibraryRequest(request, "PATCH"); }
export function POST(request: Request) { return proxyLibraryRequest(request, "POST"); }
