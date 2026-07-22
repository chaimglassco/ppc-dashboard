import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");

describe("application navigation style contract", () => {
  it("uses three independent rounded cards with hover and visible focus states", () => {
    expect(css).toContain(".glassco-app-tabs{display:inline-flex;min-width:0;max-width:min(700px,calc(100vw - 600px));align-items:center;gap:12px;padding:6px;overflow-x:auto");
    expect(css).toContain("border:1px solid var(--line);border-radius:13px");
    expect(css).toContain("box-shadow:0 8px 20px rgba(15,23,42,.08)");
    expect(css).toContain(".glassco-app-tabs__tab.active{border-color:var(--blue-dark);background:var(--blue-dark);color:#fff}");
    expect(css).toContain(".glassco-app-tabs__tab:not(.active):hover{background:var(--blue-soft);color:var(--blue-dark)}");
    expect(css).toContain(".glassco-app-tabs__tab:focus-visible{outline:3px solid #f5ad2b;outline-offset:2px}");
  });

  it("compacts and horizontally scrolls the cards on narrow screens", () => {
    expect(css).toContain("@media(max-width:760px){.topbar{grid-template-columns:0 minmax(0,1fr) 0;padding:0 10px}");
    expect(css).toContain(".glassco-app-tabs{width:100%;max-width:100%;gap:7px;padding-inline:2px}");
    expect(css).toContain("scrollbar-width:none");
  });

  it("centers the dashboard placeholder below the shared top bar", () => {
    expect(css).toContain(".ppc-dashboard-placeholder{min-height:calc(100vh - 74px);display:grid;place-content:center;justify-items:center");
  });
});
