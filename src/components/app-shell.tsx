"use client";

import Link from "next/link";
import { Library, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { PIPELINE_HOME, readGlasscoAppRoutes, rememberGlasscoAppRoute } from "@/lib/glassco-apps";

function AppSwitcher() {
  const switchToPipeline = () => {
    const routes = readGlasscoAppRoutes(window.localStorage);
    window.location.assign(new URL(routes.pipeline, PIPELINE_HOME));
  };

  return <nav className="glassco-app-tabs" aria-label="Glassco applications">
    <button type="button" className="glassco-app-tabs__tab" onClick={switchToPipeline}>Product Pipeline</button>
    <button type="button" className="glassco-app-tabs__tab active" aria-current="page">PPC Dashboard</button>
  </nav>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const section = pathname.includes("bookmarks") ? "Bookmarks" : pathname.includes("recent") ? "Recent" : "Library";

  useEffect(() => {
    const route = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    rememberGlasscoAppRoute(window.localStorage, "ppc", route);
  }, [pathname]);

  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="shell-logo glassco-wordmark" href="/library" aria-label="Glassco Library home">Glassco</Link>
      <nav className="shell-nav" aria-label="Primary navigation"><Link href="/library" className="shell-nav-link active" aria-current="page"><Library aria-hidden="true" /><span>Library</span></Link></nav>
    </aside>
    <div className="app-main">
      <header className="topbar"><div className="breadcrumb"><span>GLASSCO WORKSPACE</span><i>/</i><strong>{section}</strong></div><AppSwitcher /><div className="topbar-actions"><label className="course-search"><span className="sr-only">Search courses</span><input placeholder="Search courses..." disabled/><Search aria-hidden="true" /></label></div></header>
      <main id="main-content" tabIndex={-1}>{children}</main>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation"><Link href="/library" aria-current={pathname.startsWith("/library") ? "page" : undefined}><Library/><span>Library</span></Link></nav>
  </div>;
}
