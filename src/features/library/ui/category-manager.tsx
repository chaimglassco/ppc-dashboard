"use client";

import { ChevronDown, ChevronUp, Eye, EyeOff, Pencil, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { ManagedCategory } from "../state/category-storage";

type CategoryManagerProps = {
  categories: ManagedCategory[];
  documentCounts: Record<string, number>;
  onClose: () => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onToggleHidden: (id: string) => void;
  onDelete: (id: string) => void;
  onRecover: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
};

export function CategoryManager({ categories, documentCounts, onClose, onCreate, onRename, onToggleHidden, onDelete, onRecover, onMove }: CategoryManagerProps) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);
  const active = categories.filter(category => !category.deletedAt);
  const deleted = categories.filter(category => category.deletedAt);

  const startRename = (category: ManagedCategory) => {
    setEditingId(category.id);
    setEditingName(category.name);
  };

  const submitRename = (id: string) => {
    const name = editingName.trim();
    if (!name) return;
    onRename(id, name);
    setEditingId("");
    setEditingName("");
  };

  return <><div className="admin-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="admin-modal category-manager" role="dialog" aria-modal="true" aria-labelledby="category-manager-title">
      <header><div><span className="eyebrow">LIBRARY ADMIN</span><h2 id="category-manager-title">Manage categories</h2></div><button type="button" onClick={onClose} aria-label="Close category manager"><X /></button></header>
      <div className="category-manager-body">
        <form className="category-create" onSubmit={event => { event.preventDefault(); const name = newName.trim(); if (!name) return; onCreate(name); setNewName(""); }}>
          <label htmlFor="new-category-name">Create category</label>
          <div><input id="new-category-name" value={newName} onChange={event => setNewName(event.target.value)} placeholder="New category name" /><button className="category-recovery-trigger" type="button" onClick={() => setShowRecovery(true)} disabled={!deleted.length} aria-label={`Open category recovery${deleted.length ? ` (${deleted.length})` : ""}`} title={deleted.length ? `${deleted.length} deleted ${deleted.length === 1 ? "category" : "categories"}` : "No deleted categories"}><RotateCcw /></button><button className="primary-button" type="submit"><Plus /> Create</button></div>
        </form>

        <section className="category-list" aria-labelledby="active-categories-heading">
          <header><div><span className="eyebrow">ACTIVE</span><h3 id="active-categories-heading">Dropdown categories</h3></div><span>{active.length}</span></header>
          {active.map((category, index) => <article className={category.hidden ? "category-row hidden" : "category-row"} key={category.id}>
            <div className="category-order"><button type="button" onClick={() => onMove(category.id, -1)} disabled={index === 0} aria-label={`Move ${category.name} up`}><ChevronUp /></button><button type="button" onClick={() => onMove(category.id, 1)} disabled={index === active.length - 1} aria-label={`Move ${category.name} down`}><ChevronDown /></button></div>
            <div className="category-copy">{editingId === category.id ? <form onSubmit={event => { event.preventDefault(); submitRename(category.id); }}><input value={editingName} onChange={event => setEditingName(event.target.value)} aria-label={`Rename ${category.name}`} autoFocus /><button type="submit" aria-label={`Save ${category.name} name`}><Save /></button><button type="button" onClick={() => setEditingId("")} aria-label="Cancel rename"><X /></button></form> : <><strong>{category.name}</strong><small>{documentCounts[category.name] ?? 0} {(documentCounts[category.name] ?? 0) === 1 ? "document" : "documents"}{category.hidden ? " · Hidden from dropdown" : ""}</small></>}</div>
            <div className="category-actions"><button type="button" onClick={() => startRename(category)} aria-label={`Rename ${category.name}`}><Pencil /></button><button type="button" onClick={() => onToggleHidden(category.id)} aria-label={category.hidden ? `Show ${category.name}` : `Hide ${category.name}`}>{category.hidden ? <Eye /> : <EyeOff />}</button><button className="danger" type="button" onClick={() => onDelete(category.id)} aria-label={`Delete ${category.name}`}><Trash2 /></button></div>
          </article>)}
        </section>

      </div>
    </section>
  </div>
  {showRecovery ? <div className="admin-modal-backdrop category-recovery-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowRecovery(false); }}>
    <section className="admin-modal category-recovery-modal" role="dialog" aria-modal="true" aria-labelledby="deleted-categories-heading">
      <header><div><span className="eyebrow">RECOVERY</span><h2 id="deleted-categories-heading">Deleted categories</h2></div><button type="button" onClick={() => setShowRecovery(false)} aria-label="Close category recovery"><X /></button></header>
      <div className="category-recovery-body"><section className="category-list category-recovery-list">{deleted.map(category => <article className="category-row" key={category.id}><div className="category-copy"><strong>{category.name}</strong><small>{documentCounts[category.name] ?? 0} {(documentCounts[category.name] ?? 0) === 1 ? "document" : "documents"}</small></div><button className="secondary-button" type="button" onClick={() => { onRecover(category.id); if (deleted.length === 1) setShowRecovery(false); }}><RotateCcw /> Recover</button></article>)}</section></div>
    </section>
  </div> : null}</>;
}
