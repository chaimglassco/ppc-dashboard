"use client";
import { ChevronDown, ChevronUp, Eye, EyeOff, FileText, Trash2 } from "lucide-react";
import Link from "next/link";
import type { LibraryDocument } from "../domain/types";
import { BookmarkButton } from "./bookmark-button";

export type DocumentAdminActions = { onToggleHidden: () => void; onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void; canMoveUp: boolean; canMoveDown: boolean };
export function DocumentCard({ doc, admin }: { doc: LibraryDocument; admin?: DocumentAdminActions }) {
  return <article className={`document-card${doc.hidden ? " hidden-document" : ""}`}><div className="document-copy"><div className="card-top"><span className="type-badge">{doc.type}</span><span className="section-count"><FileText aria-hidden="true" /> {doc.topics.filter(topic => topic.level === 2).length} {doc.topics.filter(topic => topic.level === 2).length === 1 ? "section" : "sections"}</span>{admin && <span className={doc.hidden ? "visibility-badge hidden" : "visibility-badge"}>{doc.hidden ? <EyeOff /> : <Eye />}{doc.hidden ? "Hidden" : "Visible"}</span>}</div><h2>{doc.title}</h2><p>{doc.description}</p>{admin && <div className="document-admin-actions"><button type="button" onClick={admin.onToggleHidden}>{doc.hidden ? <Eye /> : <EyeOff />}{doc.hidden ? "Show" : "Hide"}</button><button type="button" onClick={admin.onMoveUp} disabled={!admin.canMoveUp} aria-label={`Move ${doc.title} up`}><ChevronUp /> Up</button><button type="button" onClick={admin.onMoveDown} disabled={!admin.canMoveDown} aria-label={`Move ${doc.title} down`}><ChevronDown /> Down</button><button className="danger" type="button" onClick={admin.onDelete}><Trash2 /> Delete</button></div>}</div><div className="card-actions"><BookmarkButton id={doc.id} compact />{!doc.hidden && <Link className="read-button" href={`/library/${doc.slug}`}>Read Document</Link>}</div></article>;
}
