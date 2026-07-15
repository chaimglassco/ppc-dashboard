"use client";
import Link from "next/link";
import { Library, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const section = pathname.includes("bookmarks") ? "Bookmarks" : pathname.includes("recent") ? "Recent" : "Library";
  return <div className="app-shell"><aside className="sidebar"><Link className="shell-logo glassco-wordmark" href="/library" aria-label="Glassco Library home">Glassco</Link><nav className="shell-nav" aria-label="Primary navigation"><Link href="/library" className="shell-nav-link active" aria-current="page"><Library aria-hidden="true" /><span>Library</span></Link></nav></aside><div className="app-main"><header className="topbar"><div className="breadcrumb"><span>GLASSCO WORKSPACE</span><i>/</i><strong>{section}</strong></div><div className="topbar-actions"><label className="course-search"><span className="sr-only">Search courses</span><input placeholder="Search courses..." disabled/><Search aria-hidden="true" /></label></div></header><main id="main-content" tabIndex={-1}>{children}</main></div><nav className="mobile-nav" aria-label="Mobile navigation"><Link href="/library" aria-current={pathname.startsWith("/library") ? "page" : undefined}><Library/><span>Library</span></Link></nav></div>;
}
