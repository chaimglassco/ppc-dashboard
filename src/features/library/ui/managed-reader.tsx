"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getTopicsFromContentElements } from "../domain/document-elements";
import type { LibraryContentElement, LibraryDocument } from "../domain/types";
import { readAdminDocuments, type ManagedLibraryDocument } from "../state/admin-storage";
import { createDefaultCategories, readAdminCategories } from "../state/category-storage";
import { cacheSharedLibraryState, fetchSharedLibraryState, hydrateSharedLibraryState, saveSharedLibraryState } from "../state/shared-library-client";
import type { DocumentMetadataDraft } from "./document-builder";
import { Reader } from "./reader";

export function ManagedReader({ slug, fallback }: { slug: string; fallback?: LibraryDocument }) {
  const [document, setDocument] = useState<ManagedLibraryDocument | null | undefined>(fallback);
  const [categories, setCategories] = useState(() => createDefaultCategories().map(category => category.name));
  useEffect(() => {
    let cancelled = false;
    const seed = fallback ? [fallback] : [];
    void hydrateSharedLibraryState(seed, window.localStorage).then(state => {
      if (!cancelled) {
        setDocument(state.documents.find(item => item.slug === slug && !item.deletedAt && !item.hidden) ?? null);
        setCategories(state.categories.filter(category => !category.deletedAt).map(category => category.name));
      }
    }).catch(() => {
      if (!cancelled) {
        setDocument(readAdminDocuments(seed, window.localStorage).find(item => item.slug === slug && !item.deletedAt && !item.hidden) ?? null);
        setCategories(readAdminCategories(window.localStorage).filter(category => !category.deletedAt).map(category => category.name));
      }
    });
    return () => { cancelled = true; };
  }, [fallback, slug]);
  if (document === undefined) return <div className="reader-loading" aria-label="Loading document"><div className="skeleton wide"/></div>;
  if (document === null) return <div className="empty-state managed-not-found"><h1>Document unavailable</h1><p>This topic may be hidden, deleted, or unavailable in the shared library.</p><Link className="primary-button" href="/library">Return to Library</Link></div>;
  const saveDocument = async (updated: ManagedLibraryDocument) => {
    const current = (await fetchSharedLibraryState()).state;
    const documents = current.documents.some(item => item.id === updated.id) ? current.documents.map(item => item.id === updated.id ? updated : item) : [...current.documents, updated];
    const saved = await saveSharedLibraryState({ ...current, documents });
    cacheSharedLibraryState(saved, window.localStorage);
    setDocument(saved.documents.find(item => item.id === updated.id) ?? updated);
  };
  const saveContentElements = async (contentElements: LibraryContentElement[], metadata: DocumentMetadataDraft) => {
    const text = contentElements.flatMap(element => [element.title, element.text, ...element.body, ...element.items, ...element.steps.flatMap(step => [step.title, step.text]), ...element.nodes.flatMap(node => [node.title, node.text]), ...(element.dropdowns ?? []).flatMap(dropdown => [dropdown.title, dropdown.text])]).join(" ");
    const updated: ManagedLibraryDocument = { ...document, ...metadata, contentElements, topics: getTopicsFromContentElements(contentElements), updatedAt: new Date().toISOString().slice(0, 10), readingMinutes: Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length / 200)) };
    await saveDocument(updated);
  };
  const saveVideoUrl = async (videoUrl: string) => {
    const updated: ManagedLibraryDocument = { ...document, videoUrl: videoUrl || undefined };
    await saveDocument(updated);
  };
  return <Reader doc={document} categories={categories} onSaveContentElements={saveContentElements} onSaveVideoUrl={saveVideoUrl}/>;
}
