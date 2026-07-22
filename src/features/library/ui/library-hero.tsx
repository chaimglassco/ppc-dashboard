"use client";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { useReadingState } from "../state/reading-state";

export function LibraryHero() {
  const { state, ready } = useReadingState();
  return <section className="library-hero"><div><span>GLASSCO BACK OFFICE LIBRARY</span><h1>Guides, SOPs, and written playbooks.</h1><p>Read the latest Library documents and playbooks published by the Glassco admin team.</p></div><div className="hero-actions"><Link href="/library/bookmarks" aria-label={`${ready ? state.bookmarks.length : 0} bookmarked documents`}><Bookmark /><span>{ready ? state.bookmarks.length : 0}</span></Link></div></section>;
}
