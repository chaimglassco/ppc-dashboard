"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getTopicsFromContentElements } from "../domain/document-elements";
import type { LibraryContentElement } from "../domain/types";
import { type ManagedLibraryDocument } from "../state/admin-storage";
import { createDefaultCategories } from "../state/category-storage";
import { cacheSharedLibraryResponse, fetchSharedLibraryState, hydrateSharedLibraryState, mutateSharedLibrary, SharedLibraryConflictError } from "../state/shared-library-client";
import { getSharedLibraryRefreshDelay } from "../state/shared-library-retry";
import type { SharedLibraryResponse } from "../state/shared-library-state";
import type { DocumentMetadataDraft } from "./document-builder";
import { Reader } from "./reader";

export function ManagedReader({ slug }: { slug: string }) {
  const [document, setDocument] = useState<ManagedLibraryDocument | null | undefined>(undefined);
  const [documentSlug, setDocumentSlug] = useState(slug);
  const [categories, setCategories] = useState(() => createDefaultCategories().map(category => category.name));
  const [mutationsEnabled, setMutationsEnabled] = useState(false);
  const [migrationPending, setMigrationPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState<{ slug: string; message: string } | null>(null);
  const sharedRef = useRef<SharedLibraryResponse | null>(null);
  const refreshInFlightRef = useRef(false);
  const documentRef = useRef<ManagedLibraryDocument | null | undefined>(undefined);
  const consecutiveFailuresRef = useRef(0);

  const applyResponse = useCallback((response: SharedLibraryResponse, cache = true) => {
    sharedRef.current = response;
    setDocumentSlug(slug);
    const nextDocument = response.state.documents.find(item => item.slug === slug && !item.deletedAt && !item.hidden) ?? null;
    documentRef.current = nextDocument;
    setDocument(nextDocument);
    setLoadError(null);
    setCategories(response.state.categories.filter(category => !category.deletedAt).map(category => category.name));
    if (cache) cacheSharedLibraryResponse(response, window.localStorage, { slug });
  }, [slug]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (refreshInFlightRef.current) return false;
    refreshInFlightRef.current = true;
    try {
      const response = await fetchSharedLibraryState(signal, { slug });
      applyResponse(response);
      consecutiveFailuresRef.current = 0;
      setMigrationPending(!response.initialized);
      setMutationsEnabled(response.initialized);
      setNotice(response.initialized ? "" : "Library migration pending. This document is read-only until an administrator completes initialization.");
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
      consecutiveFailuresRef.current += 1;
      setMutationsEnabled(false);
      if (documentRef.current === undefined) {
        setLoadError({ slug, message: "The shared Library could not load this document." });
      } else {
        setNotice("Shared library is unavailable. This confirmed copy is read-only.");
      }
      return false;
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [applyResponse, slug]);

  useEffect(() => {
    const controller = new AbortController();
    documentRef.current = undefined;
    refreshInFlightRef.current = true;
    void hydrateSharedLibraryState(window.localStorage, controller.signal, { slug }).then(({ response, source }) => {
      if (controller.signal.aborted) return;
      applyResponse(response, source === "server");
      consecutiveFailuresRef.current = source === "server" ? 0 : 1;
      setMigrationPending(source === "server" && !response.initialized);
      setMutationsEnabled(source === "server" && response.initialized);
      if (source === "cache") setNotice("Shared library is unavailable. This confirmed copy is read-only.");
      else if (!response.initialized) setNotice("Library migration pending. This document is read-only until an administrator completes initialization.");
    }).catch(() => {
      if (!controller.signal.aborted) {
        documentRef.current = undefined;
        setDocument(undefined);
        setLoadError({ slug, message: "The shared Library could not load this document." });
        consecutiveFailuresRef.current = 1;
        setMutationsEnabled(false);
      }
    }).finally(() => {
      refreshInFlightRef.current = false;
    });
    return () => controller.abort();
  }, [applyResponse, slug]);

  useEffect(() => {
    const currentDocument = document && document.slug === slug
      ? document
      : document === null && documentSlug === slug
        ? null
        : undefined;
    const currentLoadError = loadError?.slug === slug ? loadError.message : "";
    if (currentDocument === undefined && !currentLoadError) return;
    let cancelled = false;
    let timer: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(async () => {
        if (cancelled) return;
        if (globalThis.document.visibilityState === "visible") await refresh();
        if (!cancelled) schedule();
      }, getSharedLibraryRefreshDelay(consecutiveFailuresRef.current));
    };
    schedule();
    const onFocus = () => { if (globalThis.document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onFocus);
    globalThis.document.addEventListener("visibilitychange", onFocus);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      globalThis.document.removeEventListener("visibilitychange", onFocus);
    };
  }, [document, documentSlug, loadError, refresh, slug]);
  const currentDocument = document && document.slug === slug
    ? document
    : document === null && documentSlug === slug
      ? null
      : undefined;
  const currentLoadError = loadError?.slug === slug ? loadError.message : "";
  if (currentDocument === undefined && currentLoadError) return <div className="empty-state managed-not-found"><h1>Library connection unavailable</h1><p>{currentLoadError} Check the connection and try again.</p><button className="primary-button" type="button" onClick={() => { setLoadError(null); void refresh(); }}>Try again</button><Link className="secondary-button" href="/library">Return to Library</Link></div>;
  if (currentDocument === undefined) return <div className="reader-loading" aria-label="Loading document"><div className="skeleton wide"/></div>;
  if (currentDocument === null) return <div className="empty-state managed-not-found"><h1>{migrationPending ? "Library migration pending" : "Document unavailable"}</h1><p>{migrationPending ? "The shared catalog is read-only until an administrator completes initialization." : "This topic may be hidden, deleted, or unavailable in the shared library."}</p><Link className="primary-button" href="/library">Return to Library</Link></div>;
  const saveDocument = async (updated: ManagedLibraryDocument) => {
    const expectedVersion = sharedRef.current?.recordVersions.documents[updated.id];
    if (!mutationsEnabled || expectedVersion === undefined) throw new Error("Shared library editing is unavailable.");
    try {
      const saved = await mutateSharedLibrary({ operation: "document.update", documentId: updated.id, expectedVersion, document: updated }, { slug });
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
    const updated: ManagedLibraryDocument = { ...currentDocument, ...metadata, contentElements, topics: getTopicsFromContentElements(contentElements), updatedAt: new Date().toISOString().slice(0, 10), readingMinutes: Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length / 200)) };
    await saveDocument(updated);
  };
  const saveVideoUrl = async (videoUrl: string) => {
    const updated: ManagedLibraryDocument = { ...currentDocument, videoUrl: videoUrl || undefined };
    await saveDocument(updated);
  };
  return <>{notice ? <p className="admin-notice" role="status">{notice}</p> : null}<Reader doc={currentDocument} categories={categories} onSaveContentElements={saveContentElements} onSaveVideoUrl={saveVideoUrl} mutationsEnabled={mutationsEnabled}/></>;
}
