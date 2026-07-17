import { describe, expect, it } from "vitest";
import { GLASSCO_APP_ROUTES_STORAGE_KEY, readGlasscoAppRoutes, rememberGlasscoAppRoute, withPpcBasePath } from "./glassco-apps";

function storage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe("Glassco app routing", () => {
  it("prefixes PPC routes once", () => {
    expect(withPpcBasePath("/library")).toBe("/ppc/library");
    expect(withPpcBasePath("/ppc/library")).toBe("/ppc/library");
  });

  it("rejects unsafe remembered routes", () => {
    const source = storage({ [GLASSCO_APP_ROUTES_STORAGE_KEY]: JSON.stringify({ pipeline: "https://example.com", ppc: "/library" }) });
    expect(readGlasscoAppRoutes(source)).toEqual({ pipeline: "/", ppc: "/ppc/library" });
  });

  it("remembers a valid PPC route", () => {
    const source = storage();
    expect(rememberGlasscoAppRoute(source, "ppc", "/ppc/library/example").ppc).toBe("/ppc/library/example");
  });
});
