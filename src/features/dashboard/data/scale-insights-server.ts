import "server-only";

import {
  Client,
  ClientCredentialsProvider,
  StreamableHTTPClientTransport,
  type AuthProvider,
  type OAuthClientProvider,
} from "@modelcontextprotocol/client";
import {
  loadScaleInsightsWeeklyPerformance,
  type ScaleInsightsWeeklyPerformance,
  type ScaleInsightsWeeklyPerformanceParams,
} from "./scale-insights-performance";

const DEFAULT_SCALE_INSIGHTS_MCP_URL = "https://mcp.scaleinsights.com/mcp";
const SCALE_INSIGHTS_REQUEST_TIMEOUT_MS = 25_000;

export class ScaleInsightsConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScaleInsightsConfigurationError";
  }
}

function requiredPair(first: string | undefined, second: string | undefined, names: string) {
  if (Boolean(first) !== Boolean(second)) throw new ScaleInsightsConfigurationError(`${names} must both be configured.`);
}

function createAuthProvider(): AuthProvider | OAuthClientProvider {
  const accessToken = process.env.SCALE_INSIGHTS_MCP_ACCESS_TOKEN?.trim();
  const clientId = process.env.SCALE_INSIGHTS_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.SCALE_INSIGHTS_OAUTH_CLIENT_SECRET?.trim();
  requiredPair(clientId, clientSecret, "Scale Insights OAuth client ID and client secret");

  if (clientId && clientSecret) {
    return new ClientCredentialsProvider({
      clientId,
      clientSecret,
      clientName: "Glassco PPC Dashboard",
      scope: process.env.SCALE_INSIGHTS_OAUTH_SCOPE?.trim() || undefined,
      expectedIssuer: process.env.SCALE_INSIGHTS_OAUTH_ISSUER?.trim() || undefined,
    });
  }
  if (accessToken) return { token: async () => accessToken };
  throw new ScaleInsightsConfigurationError("Scale Insights server credentials are not configured.");
}

function getServerUrl() {
  const configured = process.env.SCALE_INSIGHTS_MCP_URL?.trim() || DEFAULT_SCALE_INSIGHTS_MCP_URL;
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new ScaleInsightsConfigurationError("SCALE_INSIGHTS_MCP_URL is invalid.");
  }
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new ScaleInsightsConfigurationError("Scale Insights MCP must use HTTPS.");
  }
  return url;
}

export async function getScaleInsightsWeeklyPerformance(
  params: ScaleInsightsWeeklyPerformanceParams,
): Promise<ScaleInsightsWeeklyPerformance> {
  const client = new Client({ name: "glassco-ppc-dashboard", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(getServerUrl(), { authProvider: createAuthProvider() });

  try {
    await client.connect(transport);
    return await loadScaleInsightsWeeklyPerformance(params, async (name, args) => client.callTool(
      { name, arguments: args },
      { signal: AbortSignal.timeout(SCALE_INSIGHTS_REQUEST_TIMEOUT_MS) },
    ));
  } finally {
    await client.close().catch(() => undefined);
  }
}
