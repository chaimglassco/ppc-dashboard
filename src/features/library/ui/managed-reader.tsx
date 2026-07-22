"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getTopicsFromContentElements } from "../domain/document-elements";
import type { LibraryContentElement } from "../domain/types";
import { type ManagedLibraryDocument } from "../state/admin-storage";
import { createDefaultCategories } from "../state/category-storage";
import { cacheSharedLibraryResponse, fetchSharedLibraryState, hydrateSharedLibraryState, mutateSharedLibrary, SharedLibraryConflictError } from "../state/shared-library-client";
import type { SharedLibraryResponse } from "../state/shared-library-state";
import type { DocumentMetadataDraft } from "./document-builder";
import { Reader } from "./reader";

export function ManagedReader({ slug }: { slug: string }) {
  const [document, setDocument] = useState<ManagedLibraryDocument | null | undefined>(undefined);
  const [categories, setCategories] = useState(() => createDefaultCategories().map(category => category.name));
  const [mutationsEnabled, setMutationsEnabled] = useState(false);
  const [migrationPending, setMigrationPending] = useState(false);
  const [notice, setNotice] = useState("");
  const sharedRef = useRef<SharedLibraryResponse | null>(null);
  const refreshInFlightRef = useRef(false);

  const applyResponse = useCallback((response: SharedLibraryResponse, cache = true) => {
    sharedRef.current = response;
    setDocument(response.state.documents.find(item => item.slug === slug && !item.deletedAt && !item.hidden) ?? null);
    setCategories(response.state.categories.filter(category => !category.deletedAt).map(category => category.name));
    if (cache) cacheSharedLibraryResponse(response, window.localStorage);
  }, [slug]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      const response = await fetchSharedLibraryState(signal);
      applyResponse(response);
      setMigrationPending(!response.initialized);
      setMutationsEnabled(response.initialized);
      setNotice(response.initialized ? "" : "Library migration pending. This document is read-only until an administrator completes initialization.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMutationsEnabled(false);
      setNotice("Shared library is unavailable. This confirmed copy is read-only.");
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [applyResponse]);

  useEffect(() => {
    const controller = new AbortController();
    refreshInFlightRef.current = true;
    void hydrateSharedLibraryState(window.localStorage, controller.signal).then(({ response, source }) => {
      if (controller.signal.aborted) return;
      applyResponse(response, source === "server");
      setMigrationPending(source === "server" && !response.initialized);
      setMutationsEnabled(source === "server" && response.initialized);
      if (source === "cache") setNotice("Shared library is unavailable. This confirmed copy is read-only.");
      else if (!response.initialized) setNotice("Library migration pending. This document is read-only until an administrator completes initialization.");
    }).catch(() => {
      if (!controller.signal.aborted) {
        setDocument(null);
        setMutationsEnabled(false);
      }
    }).finally(() => {
      refreshInFlightRef.current = false;
    });
    return () => controller.abort();
  }, [applyResponse]);

  useEffect(() => {
    const onFocus = () => { if (globalThis.document.visibilityState === "visible") void refresh(); };
    const timer = window.setInterval(() => { if (globalThis.document.visibilityState === "visible") void refresh(); }, 5_000);
    window.addEventListener("focus", onFocus);
    globalThis.document.addEventListener("visibilitychange", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); globalThis.document.removeEventListener("visibilitychange", onFocus); };
  }, [refresh]);
  if (document === undefined) return <div className="reader-loading" aria-label="Loading document"><div className="skeleton wide"/></div>;
  if (document === null) return <div className="empty-state managed-not-found"><h1>{migrationPending ? "Library migration pending" : "Document unavailable"}</h1><p>{migrationPending ? "The shared catalog is read-only until an administrator completes initialization." : "This topic may be hidden, deleted, or unavailable in the shared library."}</p><Link className="primary-button" href="/library">Return to Library</Link></div>;
  const saveDocument = async (updated: ManagedLibraryDocument) => {
    const expectedVersion = sharedRef.current?.recordVersions.documents[updated.id];
    if (!mutationsEnabled || expectedVersion === undefined) throw new Error("Shared library editing is unavailable.");
    try {
      const saved = await mutateSharedLibrary({ operation: "document.update", documentId: updated.id, expectedVersion, document: updated });
      applyResponse(saved);
    } catch (error) {
      if (error instanceof SharedLibraryConflictError) {
        applyResponse(error.latest);
        setNotice(error.message);
      } else {
        setMutationsEnabled(false);
        setNotice("Unable to save to the shared library. No local-only change was kept.");
      }
      throw error;
    }
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
  return <>{notice ? <p className="admin-notice" role="status">{notice}</p> : null}<Reader doc={document} categories={categories} onSaveContentElements={saveContentElements} onSaveVideoUrl={saveVideoUrl} mutationsEnabled={mutationsEnabled}/></>;
}
