"use client";

import Link from "next/link";
import { Library, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, type MouseEvent, type ReactNode } from "react";
import { GLASSCO_DEFAULT_APP_ROUTES, PIPELINE_HOME, readGlasscoAppRoutes, rememberGlasscoAppRoute } from "@/lib/glassco-apps";
import { createBrowserPipelineSessionHandoff, type GlasscoAuthTarget } from "@/lib/pipeline-session";

type PreparedTab = "pipeline" | "ppc" | "ppcDashboard";

function AppTabs({ pathname }: { pathname: string }) {
  const isDashboard = pathname === "/dashboard" || pathname === "/ppc/dashboard";
  const currentApp: PreparedTab = isDashboard ? "ppcDashboard" : "ppc";

  const prepareTab = (event: MouseEvent<HTMLAnchorElement>, destination: PreparedTab, authTarget: GlasscoAuthTarget) => {
    const currentRoute = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    rememberGlasscoAppRoute(window.localStorage, currentApp, currentRoute);
    const routes = readGlasscoAppRoutes(window.localStorage);
    createBrowserPipelineSessionHandoff(authTarget);
    event.currentTarget.href = destination === "pipeline"
      ? new URL(routes.pipeline, PIPELINE_HOME).toString()
      : routes[destination];
  };

  return <nav className="glassco-app-tabs" aria-label="Glassco applications">
    <a className="glassco-app-tabs__tab" href={new URL(GLASSCO_DEFAULT_APP_ROUTES.pipeline, PIPELINE_HOME).toString()} target="_blank" rel="noopener noreferrer" onMouseDown={event => prepareTab(event, "pipeline", "pipeline")} onClick={event => prepareTab(event, "pipeline", "pipeline")}>Product Pipeline</a>
    <a className={`glassco-app-tabs__tab${!isDashboard ? " active" : ""}`} href={GLASSCO_DEFAULT_APP_ROUTES.ppc} target="_blank" rel="noopener noreferrer" aria-current={!isDashboard ? "page" : undefined} onMouseDown={event => prepareTab(event, "ppc", "ppc")} onClick={event => prepareTab(event, "ppc", "ppc")}>Team SOP Library</a>
    <a className={`glassco-app-tabs__tab${isDashboard ? " active" : ""}`} href={GLASSCO_DEFAULT_APP_ROUTES.ppcDashboard} target="_blank" rel="noopener noreferrer" aria-current={isDashboard ? "page" : undefined} onMouseDown={event => prepareTab(event, "ppcDashboard", "ppc")} onClick={event => prepareTab(event, "ppcDashboard", "ppc")}>PPC Dashboard</a>
  </nav>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard" || pathname === "/ppc/dashboard";
  const section = isDashboard ? "PPC Dashboard" : pathname.includes("bookmarks") ? "Bookmarks" : pathname.includes("recent") ? "Recent" : "Team SOP Library";

  useEffect(() => {
    const route = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    rememberGlasscoAppRoute(window.localStorage, isDashboard ? "ppcDashboard" : "ppc", route);
  }, [isDashboard, pathname]);

  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="shell-logo glassco-wordmark" href="/library" aria-label="Glassco Library home">Glassco</Link>
      <nav className="shell-nav" aria-label="Primary navigation"><Link href="/library" className={`shell-nav-link${!isDashboard ? " active" : ""}`} aria-current={!isDashboard ? "page" : undefined}><Library aria-hidden="true" /><span>Library</span></Link></nav>
    </aside>
    <div className="app-main">
      <header className="topbar"><div className="breadcrumb"><span>GLASSCO WORKSPACE</span><i>/</i><strong>{section}</strong></div><AppTabs pathname={pathname} /><div className="topbar-actions"><label className="course-search"><span className="sr-only">Search courses</span><input placeholder="Search courses..." disabled/><Search aria-hidden="true" /></label></div></header>
      <main id="main-content" tabIndex={-1}>{children}</main>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation"><Link href="/library" aria-current={!isDashboard ? "page" : undefined}><Library/><span>Library</span></Link></nav>
  </div>;
}
