"use client";

import { Eye, Pencil, Plus, Search, Settings2, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useState } from "react";
import type { LibraryDocument } from "../domain/types";
import { extractTopics, slugifyHeading } from "../domain/headings";
import { filterDocuments } from "../domain/search";
import { moveDocument, readAdminDocuments, writeAdminDocuments, type ManagedLibraryDocument } from "../state/admin-storage";
import { createDefaultCategories, moveCategory, readAdminCategories, writeAdminCategories, type ManagedCategory } from "../state/category-storage";
import { CategoryManager } from "./category-manager";
import { DeletedDocuments } from "./deleted-documents";
import { DocumentCard } from "./document-card";
import { DocumentEditor, type DocumentDraft } from "./document-editor";

export function Catalog({ documents }: { documents: LibraryDocument[] }) {
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
  const [editor, setEditor] = useState<ManagedLibraryDocument | "new" | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setManaged(readAdminDocuments(documents, window.localStorage));
      setCategories(readAdminCategories(window.localStorage));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [documents]);

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

  const persist = (change: (current: ManagedLibraryDocument[]) => ManagedLibraryDocument[], message: string) => setManaged(current => {
    const next = change(current);
    const saved = writeAdminDocuments(next, window.localStorage);
    setNotice(saved ? message : `${message} This browser blocked persistent storage.`);
    return next;
  });

  const commitCategories = (next: ManagedCategory[], message: string) => {
    setCategories(next);
    const saved = writeAdminCategories(next, window.localStorage);
    setNotice(saved ? message : `${message} This browser blocked persistent storage.`);
  };

  const categoryNameExists = (name: string, ignoredId = "") => categories.some(item => item.id !== ignoredId && item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  const createCategory = (name: string) => {
    if (categoryNameExists(name)) { setNotice("That category name already exists."); return; }
    commitCategories([...categories, { id: `category-${crypto.randomUUID()}`, name, hidden: false }], "Category created.");
  };
  const renameCategory = (id: string, name: string) => {
    if (categoryNameExists(name, id)) { setNotice("That category name already exists."); return; }
    const current = categories.find(item => item.id === id);
    if (!current) return;
    const nextCategories = categories.map(item => item.id === id ? { ...item, name } : item);
    const nextDocuments = managed.map(document => document.category === current.name ? { ...document, category: name, updatedAt: new Date().toISOString() } : document);
    setCategories(nextCategories);
    setManaged(nextDocuments);
    const saved = writeAdminCategories(nextCategories, window.localStorage) && writeAdminDocuments(nextDocuments, window.localStorage);
    setNotice(saved ? "Category renamed and assigned documents updated." : "Category renamed, but this browser blocked persistent storage.");
    if (category === current.name) update("category", name);
  };
  const deleteCategory = (id: string) => {
    const current = categories.find(item => item.id === id);
    if (!current) return;
    commitCategories(categories.map(item => item.id === id ? { ...item, hidden: true, deletedAt: new Date().toISOString() } : item), "Category moved to recovery.");
    if (category === current.name) update("category", "");
  };
  const toggleCategoryHidden = (id: string) => {
    const current = categories.find(item => item.id === id);
    if (!current) return;
    commitCategories(categories.map(item => item.id === id ? { ...item, hidden: !item.hidden } : item), current.hidden ? "Category shown in the dropdown." : "Category hidden from the dropdown.");
    if (!current.hidden && category === current.name) update("category", "");
  };

  const clear = () => { setQ(""); router.replace(pathname, { scroll: false }); };
  const saveDraft = (draft: DocumentDraft) => {
    const body = draft.body.trim().startsWith("##") ? draft.body.trim() : `## Overview\n\n${draft.body.trim() || "Add the topic content here."}`;
    const tags = draft.tags.split(",").map(tag => tag.trim()).filter(Boolean).slice(0, 12);
    const now = new Date().toISOString();
    if (editor && editor !== "new") {
      persist(current => current.map(document => document.id === editor.id ? { ...document, ...draft, tags, body, topics: extractTopics(body), contentElements: body === editor.body ? document.contentElements : undefined, readingMinutes: Math.max(1, Math.ceil(body.split(/\s+/).length / 200)), updatedAt: now } : document), "Topic updated.");
    } else {
      const id = `admin-${crypto.randomUUID()}`;
      const slug = `${slugifyHeading(draft.title) || "library-topic"}-${id.slice(-8)}`;
      const document: ManagedLibraryDocument = { id, slug, title: draft.title.trim(), description: draft.description.trim(), category: draft.category, type: draft.type, tags, body, topics: extractTopics(body), readingMinutes: Math.max(1, Math.ceil(body.split(/\s+/).length / 200)), updatedAt: now, status: "published", hidden: false };
      persist(current => [...current, document], "Topic added.");
    }
    setEditor(null);
    setManageMode(true);
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

  return <section className="catalog-panel" aria-label="Library documents">
    <div className="catalog-toolbar">
      <div className="filters">
        <div className="category-filter-control"><label><span className="sr-only">Category</span><select value={category} onChange={event => update("category", event.target.value)}><option value="">Amazon PPC</option>{filterCategories.map(item => <option key={item.id} value={item.name}>{item.name}{item.hidden ? " (Hidden)" : ""}</option>)}</select></label>{manageMode ? <button className="manage-categories-button" type="button" onClick={() => setShowCategoryManager(true)} aria-label="Manage categories"><Settings2 /></button> : null}</div>
        <label className="search-input"><span className="sr-only">Search documents</span><input value={q} onChange={event => setQ(event.target.value)} placeholder="Search documentation..."/><Search aria-hidden="true" /></label>
        {filtered && <button className="clear-button" type="button" onClick={clear} aria-label="Clear all filters"><X /></button>}
      </div>
      <div className="admin-toolbar"><button className={manageMode ? "active" : ""} type="button" onClick={() => { if (manageMode && category && !activeCategories.some(item => item.name === category && !item.hidden)) update("category", ""); setManageMode(value => !value); setNotice(""); }} aria-label={manageMode ? "Return to library view" : "Manage library"} aria-pressed={manageMode}>{manageMode ? <Pencil /> : <Eye />}</button>{manageMode ? <button className="add-topic-button" type="button" onClick={() => setEditor("new")} aria-label="Add new topic"><Plus /></button> : null}</div>
    </div>
    {manageMode && <div className="admin-mode-banner"><span>Admin mode</span><p>Edit documents and manage category dropdown options, visibility, order, deletion, and recovery.</p></div>}
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    <p className="result-bar" aria-live="polite">{results.length} {results.length === 1 ? "document" : "documents"}</p>
    {results.length ? <div className="document-grid">{results.map(doc => {
      const activeIndex = activeDocuments.findIndex(document => document.id === doc.id);
      return <DocumentCard key={doc.id} doc={doc} admin={manageMode ? { onEdit: () => setEditor(doc), onToggleHidden: () => persist(current => current.map(document => document.id === doc.id ? { ...document, hidden: !document.hidden, updatedAt: new Date().toISOString() } : document), doc.hidden ? "Topic is visible." : "Topic hidden."), onDelete: () => persist(current => current.map(document => document.id === doc.id ? { ...document, deletedAt: new Date().toISOString() } : document), "Topic moved to recovery."), onMoveUp: () => persist(current => moveDocument(current, doc.id, -1), "Topic moved up."), onMoveDown: () => persist(current => moveDocument(current, doc.id, 1), "Topic moved down."), canMoveUp: activeIndex > 0, canMoveDown: activeIndex < activeDocuments.length - 1 } : undefined}/>;
    })}</div> : <div className="empty-state"><Search aria-hidden="true" /><h2>No documents match</h2><p>Try a broader search or remove the active filters.</p><button className="primary-button" onClick={clear}>Clear all filters</button></div>}
    {manageMode && <DeletedDocuments documents={deleted} onRecover={id => persist(current => current.map(document => document.id === id ? { ...document, deletedAt: undefined } : document), "Topic recovered.")} />}
    {editor && <DocumentEditor key={editor === "new" ? "new" : editor.id} document={editor === "new" ? undefined : editor} categories={editorCategories} onCancel={() => setEditor(null)} onSave={saveDraft}/>} 
    {showCategoryManager ? <CategoryManager categories={categories} documentCounts={documentCounts} onClose={() => setShowCategoryManager(false)} onCreate={createCategory} onRename={renameCategory} onToggleHidden={toggleCategoryHidden} onDelete={deleteCategory} onRecover={id => commitCategories(categories.map(item => item.id === id ? { ...item, hidden: false, deletedAt: undefined } : item), "Category recovered.")} onMove={(id, direction) => commitCategories(moveCategory(categories, id, direction), "Category order updated.")} /> : null}
  </section>;
}
