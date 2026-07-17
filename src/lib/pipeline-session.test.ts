import { describe, expect, it } from "vitest";
import { parseStoredPipelineSession } from "./pipeline-session";

describe("Pipeline session parsing", () => {
  it("accepts a valid stored session and normalizes its role", () => {
    expect(parseStoredPipelineSession(JSON.stringify({ token: "token", email: "user@glassco.test", name: "User", role: "viewer" }))).toEqual({
      token: "token",
      email: "user@glassco.test",
      name: "User",
      role: "VIEWER",
    });
  });

  it("rejects malformed and tokenless values", () => {
    expect(parseStoredPipelineSession("bad")).toBeNull();
    expect(parseStoredPipelineSession(JSON.stringify({ email: "user@glassco.test" }))).toBeNull();
  });

  it.each([
    ["admin", "ADMIN"],
    ["user", "USER"],
    ["viewer", "VIEWER"],
    ["unknown", "USER"],
  ] as const)("normalizes %s access to %s", (role, expected) => {
    const session = parseStoredPipelineSession(JSON.stringify({ token: "token", email: "user@glassco.test", role }));
    expect(session?.role).toBe(expected);
  });
});
