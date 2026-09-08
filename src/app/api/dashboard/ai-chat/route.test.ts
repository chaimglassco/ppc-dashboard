import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("ai", async importOriginal => ({ ...(await importOriginal<typeof import("ai")>()), generateText: vi.fn() }));
vi.mock("@/lib/pipeline-auth-server", () => ({ verifyPipelineRequest: vi.fn() }));

import { generateText } from "ai";
import { verifyPipelineRequest } from "@/lib/pipeline-auth-server";
import { POST, parsePerformanceChatRequest } from "./route";

const body = {
  question: "Why did ACOS improve?",
  history: [{ role: "user", text: "Compare the weeks" }, { role: "assistant", text: "I can do that." }],
  context: {
    product: { name: "Glass Cleaner", asin: "b012345678", sku: "GC-01" },
    activeWeekStart: "2026-09-02",
    targetAcos: 20,
    weeklyBudget: 100,
    notes: "Reduced weak search terms.",
    carryForward: "Protect profitable traffic.",
    goals: [{ goal: "ACOS", target: "20.00%", status: "On Track" }],
    actions: [{ action: "Review bids", priority: "High", completed: false }],
    periods: [
      { weekStart: "2026-09-02", weekEnd: "2026-09-08", dataState: "Partial", metrics: { spend: 50, ppcSales: 250, organicSales: 300, totalSales: 550, ppcOrders: 10, organicOrders: 12, totalOrders: 22, acos: 20, tacos: 9.09 } },
      { weekStart: "2026-08-26", weekEnd: "2026-09-01", dataState: "Final", metrics: { spend: 60, ppcSales: 200, organicSales: 250, totalSales: 450, ppcOrders: 8, organicOrders: 10, totalOrders: 18, acos: 30, tacos: 13.33 } },
    ],
  },
};

function request(value: unknown = body) {
  return new Request("http://localhost/ppc/api/dashboard/ai-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer pipeline-token" },
    body: JSON.stringify(value),
  });
}

describe("PPC performance AI route", () => {
  beforeEach(() => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-gateway-key");
    vi.mocked(verifyPipelineRequest).mockReset();
    vi.mocked(verifyPipelineRequest).mockResolvedValue({ user: { id: "user-1", email: "user@example.com", name: "User", role: "USER" } });
    vi.mocked(generateText).mockReset();
    vi.mocked(generateText).mockResolvedValue({ text: "ACOS improved from 30% to 20% while PPC sales rose by $50." } as Awaited<ReturnType<typeof generateText>>);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("validates and bounds product-scoped performance context", () => {
    const parsed = parsePerformanceChatRequest({
      ...body,
      history: Array.from({ length: 12 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", text: `Message ${index}` })),
    });
    expect(parsed.context.product.asin).toBe("B012345678");
    expect(parsed.history).toHaveLength(8);
    expect(parsed.context.periods).toHaveLength(2);
    expect(() => parsePerformanceChatRequest({ ...body, question: "" })).toThrow(/question/i);
    expect(() => parsePerformanceChatRequest({ ...body, context: { ...body.context, periods: body.context.periods.slice(1) } })).toThrow(/active reporting week/i);
  });

  it("authenticates and asks the configured OpenAI model with no-store output", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    await expect(response.json()).resolves.toEqual({ answer: "ACOS improved from 30% to 20% while PPC sales rose by $50." });
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
      model: "openai/gpt-5.4-mini",
      maxOutputTokens: 700,
      instructions: expect.stringContaining("Amazon PPC performance analyst"),
      prompt: expect.stringContaining("Why did ACOS improve?"),
      providerOptions: { gateway: { user: "user-1", tags: ["feature:ppc-performance-chat"], cacheControl: "max-age=0" } },
    }));
  });

  it("does not call the model when Pipeline authentication fails", async () => {
    vi.mocked(verifyPipelineRequest).mockResolvedValue(new Response(null, { status: 401 }));
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("returns bounded configuration and provider failures", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    let response = await POST(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "The AI performance assistant is not configured for this environment." });

    vi.stubEnv("AI_GATEWAY_API_KEY", "test-gateway-key");
    vi.mocked(generateText).mockRejectedValue(new Error("secret provider message"));
    response = await POST(request());
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "The AI performance assistant is temporarily unavailable." });
  });

  it("identifies an expired local OIDC token without sending it upstream", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1_000) - 60 })).toString("base64url");
    vi.stubEnv("VERCEL_OIDC_TOKEN", `${header}.${payload}.signature`);
    const response = await POST(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "The local AI credential has expired. Refresh the Vercel development environment and restart the app." });
    expect(generateText).not.toHaveBeenCalled();
  });
});
