"use client";
import { RotateCcw } from "lucide-react";
import type { ManagedLibraryDocument } from "../state/admin-storage";

export function DeletedDocuments({ documents, onRecover }: { documents: ManagedLibraryDocument[]; onRecover: (id: string) => void }) {
  if (!documents.length) return null;
  return <section className="deleted-topics" aria-labelledby="deleted-heading"><header><div><span className="eyebrow">RECOVERY</span><h2 id="deleted-heading">Deleted topics</h2></div><span>{documents.length}</span></header>{documents.map(document => <div className="deleted-topic" key={document.id}><div><strong>{document.title}</strong><small>Deleted {document.deletedAt ? new Date(document.deletedAt).toLocaleString() : "recently"}</small></div><button className="secondary-button" type="button" onClick={() => onRecover(document.id)}><RotateCcw /> Recover</button></div>)}</section>;
}
