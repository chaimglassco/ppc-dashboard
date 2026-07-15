"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getTopicsFromContentElements } from "../domain/document-elements";
import type { LibraryContentElement, LibraryDocument } from "../domain/types";
import { readAdminDocuments, writeAdminDocuments, type ManagedLibraryDocument } from "../state/admin-storage";
import { Reader } from "./reader";

export function ManagedReader({ slug, fallback }: { slug: string; fallback?: LibraryDocument }) {
  const [document, setDocument] = useState<ManagedLibraryDocument | null | undefined>(fallback);
  useEffect(() => { const timer = window.setTimeout(() => { const managed = readAdminDocuments(fallback ? [fallback] : [], window.localStorage); setDocument(managed.find(item => item.slug === slug && !item.deletedAt && !item.hidden) ?? null); }, 0); return () => window.clearTimeout(timer); }, [fallback, slug]);
  if (document === undefined) return <div className="reader-loading" aria-label="Loading document"><div className="skeleton wide"/></div>;
  if (document === null) return <div className="empty-state managed-not-found"><h1>Document unavailable</h1><p>This topic may be hidden, deleted, or unavailable on this device.</p><Link className="primary-button" href="/library">Return to Library</Link></div>;
  const saveContentElements = async (contentElements: LibraryContentElement[]) => {
    const text = contentElements.flatMap(element => [element.title, element.text, ...element.body, ...element.items, ...element.steps.flatMap(step => [step.title, step.text]), ...element.nodes.flatMap(node => [node.title, node.text]), ...(element.dropdowns ?? []).flatMap(dropdown => [dropdown.title, dropdown.text])]).join(" ");
    const updated: ManagedLibraryDocument = { ...document, contentElements, topics: getTopicsFromContentElements(contentElements), updatedAt: new Date().toISOString().slice(0, 10), readingMinutes: Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length / 200)) };
    const managed = readAdminDocuments(fallback ? [fallback] : [], window.localStorage);
    const next = managed.some(item => item.id === updated.id) ? managed.map(item => item.id === updated.id ? updated : item) : [...managed, updated];
    if (!writeAdminDocuments(next, window.localStorage)) throw new Error("Unable to save changes in this browser.");
    setDocument(updated);
  };
  const saveVideoUrl = async (videoUrl: string) => {
    const updated: ManagedLibraryDocument = { ...document, videoUrl: videoUrl || undefined };
    const managed = readAdminDocuments(fallback ? [fallback] : [], window.localStorage);
    const next = managed.some(item => item.id === updated.id) ? managed.map(item => item.id === updated.id ? updated : item) : [...managed, updated];
    if (!writeAdminDocuments(next, window.localStorage)) throw new Error("Unable to save the video link in this browser.");
    setDocument(updated);
  };
  return <Reader doc={document} onSaveContentElements={saveContentElements} onSaveVideoUrl={saveVideoUrl}/>;
}
