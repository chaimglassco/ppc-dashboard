import "server-only";

import {
  ConnectError,
  NoValidTokenError,
  UserAuthorizationRequiredError,
  getToken,
  startAuthorization,
} from "@vercel/connect";
import {
  Client,
  StreamableHTTPClientTransport,
  type AuthProvider,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/client";
import {
  loadScaleInsightsWeeklyPerformance,
  type ScaleInsightsWeeklyPerformance,
  type ScaleInsightsWeeklyPerformanceParams,
} from "./scale-insights-performance";
import {
  getScaleInsightsCampaignToolCapabilities,
  loadScaleInsightsCampaignComparison,
  loadScaleInsightsCampaignSpendBaseline,
  type ScaleInsightsCampaignComparisonParams,
} from "./scale-insights-campaign-comparison";
import type { CampaignSpendBaseline, CampaignWeeklyComparison } from "../domain/campaign-weekly-comparison";

const DEFAULT_SCALE_INSIGHTS_MCP_URL = "https://mcp.scaleinsights.com/mcp";
const DEFAULT_SCALE_INSIGHTS_CONNECTOR = "mcp.scaleinsights.com/glassco-scale-insights";
const SCALE_INSIGHTS_REQUEST_TIMEOUT_MS = 25_000;

export class ScaleInsightsConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScaleInsightsConfigurationError";
  }
}

export class ScaleInsightsAuthorizationRequiredError extends Error {
  constructor(readonly authorizationUrl: string) {
    super("Scale Insights authorization is required.");
    this.name = "ScaleInsightsAuthorizationRequiredError";
  }
}

export type ScaleInsightsRequestIdentity = {
  userId: string;
  issuer: string;
  callbackUrl: string;
};

export type ScaleInsightsToolCaller = (name: string, args: Record<string, unknown>) => Promise<CallToolResult>;

export type ScaleInsightsToolSession = {
  definitions: Tool[];
  callTool: ScaleInsightsToolCaller;
};

function getConnector() {
  return process.env.SCALE_INSIGHTS_CONNECTOR?.trim() || DEFAULT_SCALE_INSIGHTS_CONNECTOR;
}

function validateAuthorizationUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ScaleInsightsConfigurationError("Scale Insights authorization returned an invalid URL.");
  }
  if (url.protocol !== "https:" || (url.hostname !== "vercel.com" && !url.hostname.endsWith(".vercel.com"))) {
    throw new ScaleInsightsConfigurationError("Scale Insights authorization returned an untrusted URL.");
  }
  return url.toString();
}

async function createAuthProvider(identity: ScaleInsightsRequestIdentity): Promise<AuthProvider> {
  const connector = getConnector();
  const params = {
    subject: { type: "user" as const, id: identity.userId, issuer: identity.issuer },
  };

  try {
    const accessToken = await getToken(connector, params);
    return { token: async () => accessToken };
  } catch (error) {
    if (error instanceof UserAuthorizationRequiredError || error instanceof NoValidTokenError) {
      const authorization = await startAuthorization(connector, params, { callbackUrl: identity.callbackUrl });
      throw new ScaleInsightsAuthorizationRequiredError(validateAuthorizationUrl(authorization.url));
    }
    if (error instanceof ConnectError) {
      throw new ScaleInsightsConfigurationError("Vercel Connect could not provide Scale Insights access.");
    }
    throw error;
  }
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
  identity: ScaleInsightsRequestIdentity,
): Promise<ScaleInsightsWeeklyPerformance> {
  return withScaleInsightsClient(identity, callTool => loadScaleInsightsWeeklyPerformance(params, callTool));
}

export async function getScaleInsightsCampaignComparison(
  params: ScaleInsightsCampaignComparisonParams,
  identity: ScaleInsightsRequestIdentity,
): Promise<CampaignWeeklyComparison> {
  return withScaleInsightsToolSession(identity, ({ definitions, callTool }) => {
    const adsTool = definitions.find(tool => tool.name === "get_ads_performance");
    if (!adsTool) throw new ScaleInsightsConfigurationError("Scale Insights did not advertise campaign performance access.");
    return loadScaleInsightsCampaignComparison(params, callTool, getScaleInsightsCampaignToolCapabilities(adsTool.inputSchema));
  });
}

export async function getScaleInsightsCampaignSpendBaseline(
  params: ScaleInsightsCampaignComparisonParams,
  identity: ScaleInsightsRequestIdentity,
): Promise<CampaignSpendBaseline> {
  return withScaleInsightsToolSession(identity, ({ definitions, callTool }) => {
    const adsTool = definitions.find(tool => tool.name === "get_ads_performance");
    if (!adsTool) throw new ScaleInsightsConfigurationError("Scale Insights did not advertise campaign performance access.");
    return loadScaleInsightsCampaignSpendBaseline(params, callTool, getScaleInsightsCampaignToolCapabilities(adsTool.inputSchema));
  });
}

async function withConnectedScaleInsightsClient<T>(
  identity: ScaleInsightsRequestIdentity,
  load: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ name: "glassco-ppc-dashboard", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(getServerUrl(), { authProvider: await createAuthProvider(identity) });

  try {
    await client.connect(transport);
    return await load(client);
  } finally {
    await client.close().catch(() => undefined);
  }
}

function createToolCaller(client: Client): ScaleInsightsToolCaller {
  return async (name, args) => client.callTool(
    { name, arguments: args },
    { signal: AbortSignal.timeout(SCALE_INSIGHTS_REQUEST_TIMEOUT_MS) },
  );
}

export async function withScaleInsightsClient<T>(
  identity: ScaleInsightsRequestIdentity,
  load: (callTool: import("./scale-insights-performance").ScaleInsightsToolCaller) => Promise<T>,
): Promise<T> {
  return withConnectedScaleInsightsClient(identity, client => load(createToolCaller(client)));
}

export async function withScaleInsightsToolSession<T>(
  identity: ScaleInsightsRequestIdentity,
  load: (session: ScaleInsightsToolSession) => Promise<T>,
): Promise<T> {
  return withConnectedScaleInsightsClient(identity, async client => {
    const listed = await client.listTools(undefined, { signal: AbortSignal.timeout(SCALE_INSIGHTS_REQUEST_TIMEOUT_MS) });
    return load({ definitions: listed.tools, callTool: createToolCaller(client) });
  });
}
