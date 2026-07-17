export type GlasscoAppId = "pipeline" | "ppc";

export const PPC_BASE_PATH = "/ppc";
export const PIPELINE_HOME = process.env.NEXT_PUBLIC_PIPELINE_ORIGIN?.replace(/\/$/, "") || "https://glasscopipeline.vercel.app";
export const GLASSCO_APP_ROUTES_STORAGE_KEY = "glassco.appRoutes.v1";
export const GLASSCO_DEFAULT_APP_ROUTES: Record<GlasscoAppId, string> = { pipeline: "/", ppc: "/ppc/library" };

export function withPpcBasePath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized === PPC_BASE_PATH || normalized.startsWith(`${PPC_BASE_PATH}/`) ? normalized : `${PPC_BASE_PATH}${normalized}`;
}

export function readGlasscoAppRoutes(storage: Storage): Record<GlasscoAppId, string> {
  const fallback = { ...GLASSCO_DEFAULT_APP_ROUTES };
  try {
    const raw = storage.getItem(GLASSCO_APP_ROUTES_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return fallback;
    const candidate = parsed as Record<string, unknown>;
    return {
      pipeline: typeof candidate.pipeline === "string" && candidate.pipeline.startsWith("/") && !candidate.pipeline.startsWith(PPC_BASE_PATH) ? candidate.pipeline : fallback.pipeline,
      ppc: typeof candidate.ppc === "string" && candidate.ppc.startsWith(`${PPC_BASE_PATH}/`) ? candidate.ppc : fallback.ppc,
    };
  } catch {
    return fallback;
  }
}

export function rememberGlasscoAppRoute(storage: Storage, app: GlasscoAppId, route: string) {
  const routes = readGlasscoAppRoutes(storage);
  if (app === "pipeline" && route.startsWith("/") && !route.startsWith(PPC_BASE_PATH)) routes.pipeline = route;
  if (app === "ppc" && route.startsWith(`${PPC_BASE_PATH}/`)) routes.ppc = route;
  storage.setItem(GLASSCO_APP_ROUTES_STORAGE_KEY, JSON.stringify(routes));
  return routes;
}
