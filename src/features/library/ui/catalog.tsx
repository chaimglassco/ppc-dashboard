"use client";

import { ArrowUpDown, Eye, Pencil, Plus, RotateCcw, Search, Settings2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import type { LibraryDocument } from "../domain/types";
import { extractTopics, slugifyHeading } from "../domain/headings";
import { filterDocuments } from "../domain/search";
import { type ManagedLibraryDocument } from "../state/admin-storage";
import { createDefaultCategories, type ManagedCategory } from "../state/category-storage";
import { cacheSharedLibraryResponse, fetchSharedLibraryState, hydrateSharedLibraryState, initializeCleanLibrary, mutateSharedLibrary, SharedLibraryConflictError, type SharedLibraryMutation } from "../state/shared-library-client";
import type { SharedLibraryResponse } from "../state/shared-library-state";
import { CategoryManager } from "./category-manager";
import { DeletedDocuments } from "./deleted-documents";
import { DocumentCard } from "./document-card";
import { DocumentEditor, type DocumentDraft } from "./document-editor";
import { DocumentReorderDialog } from "./document-reorder-dialog";
import { useGlasscoSession } from "@/components/glassco-session";

export function Catalog({ documents }: { documents: LibraryDocument[] }) {
  const { canAdmin, canEdit } = useGlasscoSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const paramsString = params.toString();
  const [q, setQ] = useState(params.get("q") ?? "");
  const deferred = useDeferredValue(q);
  const category = params.get("category") ?? "";
  const [managed, setManaged] = useState<ManagedLibraryDocument[]>(() => documents.map(document => ({ ...document })));
  const [categories, setCategories] = useState<ManagedCategory[]>(createDefaultCategories);
  const [manageMode, setManageMode] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showDocumentRecovery, setShowDocumentRecovery] = useState(false);
  const [showDocumentReorder, setShowDocumentReorder] = useState(false);
  const [editor, setEditor] = useState<"new" | null>(null);
  const [notice, setNotice] = useState("");
  const [isCatalogReady, setIsCatalogReady] = useState(false);
  const [mutationsEnabled, setMutationsEnabled] = useState(false);
  const [librarySource, setLibrarySource] = useState<"server" | "cache" | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [shared, setShared] = useState<SharedLibraryResponse | null>(null);
  const sharedRef = useRef<SharedLibraryResponse | null>(null);
  const refreshInFlightRef = useRef(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const applySharedResponse = useCallback((response: SharedLibraryResponse, cache = true) => {
    sharedRef.current = response;
    setShared(response);
    setManaged(response.state.documents);
    setCategories(response.state.categories);
    if (cache) cacheSharedLibraryResponse(response, window.localStorage);
  }, []);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      const response = await fetchSharedLibraryState(signal);
      applySharedResponse(response);
      setLibrarySource("server");
      setMutationsEnabled(response.initialized);
      setNotice(response.initialized ? "" : "Library migration pending. The shared catalog is read-only until an administrator completes initialization.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMutationsEnabled(false);
      setLibrarySource("cache");
      setNotice("Shared library is unavailable. Showing the last confirmed copy in read-only mode.");
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [applySharedResponse]);

  useEffect(() => {
    const controller = new AbortController();
    refreshInFlightRef.current = true;
    void hydrateSharedLibraryState(window.localStorage, controller.signal).then(({ response, source }) => {
      if (controller.signal.aborted) return;
      applySharedResponse(response, source === "server");
      setLibrarySource(source);
      setMutationsEnabled(source === "server" && response.initialized);
      if (source === "cache") setNotice("Shared library is unavailable. Showing the last confirmed copy in read-only mode.");
      else if (!response.initialized) setNotice("Library migration pending. The shared catalog is read-only until an administrator completes initialization.");
      setIsCatalogReady(true);
    }).catch(() => {
      if (controller.signal.aborted) return;
      setManaged([]);
      setCategories([]);
      setLibrarySource(null);
      setMutationsEnabled(false);
      setNotice("Shared library is unavailable and no confirmed cached copy exists.");
      setIsCatalogReady(true);
    }).finally(() => {
      refreshInFlightRef.current = false;
    });
    return () => controller.abort();
  }, [applySharedResponse, loadAttempt]);

  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 5_000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(paramsString);
      if (deferred) next.set("q", deferred); else next.delete("q");
      router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [deferred, pathname, router, paramsString]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(paramsString);
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const commitMutation = async (mutation: SharedLibraryMutation, message: string) => {
    if (!mutationsEnabled) {
      setNotice("Shared library is unavailable. Changes are disabled until the connection returns.");
      return false;
    }
    try {
      const saved = await mutateSharedLibrary(mutation);
      applySharedResponse(saved);
      setNotice(message);
      return true;
    } catch (error) {
      if (error instanceof SharedLibraryConflictError) {
        applySharedResponse(error.latest);
        setNotice(error.message);
      } else {
        setMutationsEnabled(false);
        setNotice("Unable to save to the shared library. No local-only change was kept.");
      }
      return false;
    }
  };

  const migrateLibrary = async () => {
    if (!canAdmin || librarySource !== "server" || shared?.initialized !== false || isMigrating) return;
    if (!window.confirm("Back up the legacy Library and restore the approved two-document catalog? This can only initialize an empty shared Library.")) return;
    setIsMigrating(true);
    setNotice("Backing up and restoring the Library…");
    try {
      const response = await initializeCleanLibrary();
      applySharedResponse(response);
      setLibrarySource("server");
      setMutationsEnabled(response.initialized);
      setNotice("Library backup and restoration completed successfully.");
    } catch (error) {
      setNotice(error instanceof Error ? `Library migration failed: ${error.message}` : "Library migration failed. No changes were applied.");
    } finally {
      setIsMigrating(false);
    }
  };

  const categoryNameExists = (name: string, ignoredId = "") => categories.some(item => item.id !== ignoredId && item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  const createCategory = (name: string) => {
    const normalizedName = name.trim();
    if (!normalizedName) return false;
    if (categoryNameExists(normalizedName)) { setNotice("That category name already exists."); return false; }
    void commitMutation({ operation: "category.create", category: { id: `category-${crypto.randomUUID()}`, name: normalizedName, hidden: false } }, "Category created.");
    return true;
  };
  const renameCategory = (id: string, name: string) => {
    if (categoryNameExists(name, id)) { setNotice("That category name already exists."); return; }
    const current = categories.find(item => item.id === id);
    if (!current) return;
    const expectedVersion = sharedRef.current?.recordVersions.categories[id];
    if (expectedVersion === undefined) return;
    void commitMutation({ operation: "category.update", categoryId: id, expectedVersion, category: { ...current, name } }, "Category renamed and assigned documents updated.");
    if (category === current.name) update("category", name);
  };
  const deleteCategory = (id: string) => {
    const current = categories.find(item => item.id === id);
    if (!current) return;
    const expectedVersion = sharedRef.current?.recordVersions.categories[id];
    if (expectedVersion === undefined) return;
    void commitMutation({ operation: "category.delete", categoryId: id, expectedVersion }, "Category moved to recovery.");
    if (category === current.name) update("category", "");
  };
  const toggleCategoryHidden = (id: string) => {
    const current = categories.find(item => item.id === id);
    if (!current) return;
    const expectedVersion = sharedRef.current?.recordVersions.categories[id];
    if (expectedVersion === undefined) return;
    void commitMutation({ operation: "category.update", categoryId: id, expectedVersion, category: { ...current, hidden: !current.hidden } }, current.hidden ? "Category shown in the dropdown." : "Category hidden from the dropdown.");
    if (!current.hidden && category === current.name) update("category", "");
  };

  const clear = () => { setQ(""); router.replace(pathname, { scroll: false }); };
  const saveDraft = (draft: DocumentDraft) => {
    const body = draft.body.trim().startsWith("##") ? draft.body.trim() : `## Overview\n\n${draft.body.trim() || "Add the topic content here."}`;
    const tags = draft.tags.split(",").map(tag => tag.trim()).filter(Boolean).slice(0, 12);
    const now = new Date().toISOString();
    const id = `admin-${crypto.randomUUID()}`;
    const slug = `${slugifyHeading(draft.title) || "library-topic"}-${id.slice(-8)}`;
    const document: ManagedLibraryDocument = { id, slug, title: draft.title.trim(), description: draft.description.trim(), category: draft.category, type: draft.type, tags, body, topics: extractTopics(body), readingMinutes: Math.max(1, Math.ceil(body.split(/\s+/).length / 200)), updatedAt: now, status: "published", hidden: false };
    void commitMutation({ operation: "document.create", document }, "Topic added.").then(saved => {
      if (!saved) return;
      setEditor(null);
      if (canAdmin) setManageMode(true);
    });
  };

  const activeCategories = categories.filter(item => !item.deletedAt);
  const filterCategories = activeCategories.filter(item => manageMode || !item.hidden);
  const editorCategories = activeCategories.map(item => item.name);
  const activeDocuments = managed.filter(document => !document.deletedAt);
  const visibleToReader = activeDocuments.filter(document => !document.hidden);
  const catalogDocuments = manageMode ? activeDocuments : visibleToReader;
  const results = filterDocuments(catalogDocuments, { q: deferred, category });
  const filtered = Boolean(q || category);
  const deleted = managed.filter(document => document.deletedAt);
  const documentCounts = managed.reduce<Record<string, number>>((counts, document) => { counts[document.category] = (counts[document.category] ?? 0) + 1; return counts; }, {});
  const saveDocumentOrder = async (order: string[]) => {
    const revision = sharedRef.current?.revision;
    if (revision === undefined) return;
    if (await commitMutation({ operation: "documents.reorder", documentIds: order, expectedRevision: revision }, "Library document order updated.")) setShowDocumentReorder(false);
  };

  return <section className="catalog-panel" aria-label="Library documents">
    <div className="catalog-toolbar">
      <div className="filters">
        <div className="category-filter-control"><label><span className="sr-only">Category</span><select value={category} onChange={event => update("category", event.target.value)}><option value="">All categories</option>{filterCategories.map(item => <option key={item.id} value={item.name}>{item.name}{item.hidden ? " (Hidden)" : ""}</option>)}</select></label>{manageMode ? <button className="manage-categories-button" type="button" onClick={() => setShowCategoryManager(true)} aria-label="Manage categories"><Settings2 /></button> : null}</div>
        <label className="search-input"><span className="sr-only">Search documents</span><input value={q} onChange={event => setQ(event.target.value)} placeholder="Search documentation..."/><Search aria-hidden="true" /></label>
        {filtered && <button className="clear-button" type="button" onClick={clear} aria-label="Clear all filters"><X /></button>}
      </div>
      {canEdit ? <div className="admin-toolbar">{canAdmin && manageMode ? <button className="document-recovery-trigger" type="button" onClick={() => setShowDocumentRecovery(true)} disabled={!mutationsEnabled || !deleted.length} aria-label={`Open document recovery${deleted.length ? ` (${deleted.length})` : ""}`} title={deleted.length ? `${deleted.length} deleted ${deleted.length === 1 ? "document" : "documents"}` : "No deleted documents"}><RotateCcw /></button> : null}{canAdmin ? <><button className="catalog-reorder-button" type="button" onClick={() => setShowDocumentReorder(true)} disabled={!mutationsEnabled || activeDocuments.length < 2}><ArrowUpDown /><span>REORDER</span></button><button className={manageMode ? "active" : ""} type="button" disabled={!mutationsEnabled} onClick={() => { if (manageMode && category && !activeCategories.some(item => item.name === category && !item.hidden)) update("category", ""); if (manageMode) setShowDocumentRecovery(false); setManageMode(value => !value); setNotice(""); }} aria-label={manageMode ? "Return to library view" : "Manage library"} aria-pressed={manageMode}>{manageMode ? <Pencil /> : <Eye />}</button></> : null}<button className="add-topic-button" type="button" disabled={!mutationsEnabled} onClick={() => setEditor("new")} aria-label="Add new topic"><Plus /></button></div> : null}
    </div>
    {manageMode && <div className="admin-mode-banner"><span>Admin mode</span><p>Edit documents and manage category dropdown options, visibility, order, deletion, and recovery.</p></div>}
    {notice && <p className="admin-notice" role="status">{notice}{librarySource === null && isCatalogReady ? <> <button className="inline-retry-button" type="button" onClick={() => { setIsCatalogReady(false); setNotice(""); setLoadAttempt(value => value + 1); }}>Try again</button></> : null}</p>}
    {canAdmin && librarySource === "server" && shared?.initialized === false ? <button className="primary-button" type="button" onClick={() => void migrateLibrary()} disabled={isMigrating}>{isMigrating ? "BACKING UP AND RESTORING…" : "Back up and restore Library"}</button> : null}
    {isCatalogReady ? <><p className="result-bar" aria-live="polite">{results.length} {results.length === 1 ? "document" : "documents"}</p>
    {results.length ? <div className="document-grid">{results.map(doc => {
      const activeIndex = activeDocuments.findIndex(document => document.id === doc.id);
      const expectedVersion = shared?.recordVersions.documents[doc.id];
      const updateDocument = (updated: ManagedLibraryDocument, message: string) => expectedVersion === undefined ? undefined : void commitMutation({ operation: "document.update", documentId: doc.id, expectedVersion, document: updated }, message);
      const reorder = (direction: -1 | 1) => {
        const next = [...activeDocuments];
        const target = activeIndex + direction;
        if (target < 0 || target >= next.length || sharedRef.current === null) return;
        [next[activeIndex], next[target]] = [next[target], next[activeIndex]];
        void commitMutation({ operation: "documents.reorder", documentIds: next.map(document => document.id), expectedRevision: sharedRef.current.revision }, "Document order updated.");
      };
      return <DocumentCard key={doc.id} doc={doc} admin={manageMode && mutationsEnabled ? { onToggleHidden: () => updateDocument({ ...doc, hidden: !doc.hidden, updatedAt: new Date().toISOString() }, doc.hidden ? "Document is visible." : "Document hidden."), onDelete: () => expectedVersion === undefined ? undefined : void commitMutation({ operation: "document.delete", documentId: doc.id, expectedVersion }, "Document moved to recovery."), onMoveUp: () => reorder(-1), onMoveDown: () => reorder(1), canMoveUp: activeIndex > 0, canMoveDown: activeIndex < activeDocuments.length - 1 } : undefined}/>;
    })}</div> : <div className="empty-state"><Search aria-hidden="true" /><h2>No documents match</h2><p>Try a broader search or remove the active filters.</p><button className="primary-button" onClick={clear}>Clear all filters</button></div>}</> : <div className="skeleton-grid" aria-label="Loading library documents">{[1, 2, 3].map(item => <div className="skeleton" key={item} />)}</div>}
    {canAdmin && showDocumentRecovery ? <DeletedDocuments documents={deleted} onClose={() => setShowDocumentRecovery(false)} onRecover={id => { const expectedVersion = sharedRef.current?.recordVersions.documents[id]; if (expectedVersion !== undefined) void commitMutation({ operation: "document.restore", documentId: id, expectedVersion }, "Document recovered."); }} /> : null}
    {canEdit && editor && mutationsEnabled ? <DocumentEditor key="new" categories={editorCategories} onCancel={() => setEditor(null)} onSave={saveDraft} onCreateCategory={canAdmin ? createCategory : undefined} onManageCategories={canAdmin ? () => setShowCategoryManager(true) : undefined}/> : null}
    {canAdmin && showDocumentReorder ? <DocumentReorderDialog documents={activeDocuments} onCancel={() => setShowDocumentReorder(false)} onSave={saveDocumentOrder} /> : null}
    {canAdmin && showCategoryManager ? <CategoryManager categories={categories} documentCounts={documentCounts} onClose={() => setShowCategoryManager(false)} onCreate={createCategory} onRename={renameCategory} onToggleHidden={toggleCategoryHidden} onDelete={deleteCategory} onRecover={id => { const expectedVersion = sharedRef.current?.recordVersions.categories[id]; if (expectedVersion !== undefined) void commitMutation({ operation: "category.restore", categoryId: id, expectedVersion }, "Category recovered."); }} onMove={(id, direction) => { const active = categories.filter(item => !item.deletedAt); const position = active.findIndex(item => item.id === id); const target = position + direction; if (position < 0 || target < 0 || target >= active.length || !sharedRef.current) return; const ordered = [...active]; [ordered[position], ordered[target]] = [ordered[target], ordered[position]]; void commitMutation({ operation: "categories.reorder", categoryIds: ordered.map(item => item.id), expectedRevision: sharedRef.current.revision }, "Category order updated."); }} /> : null}
  </section>;
}
