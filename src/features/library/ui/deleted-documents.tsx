"use client";
import { RotateCcw, X } from "lucide-react";
import type { ManagedLibraryDocument } from "../state/admin-storage";

export function DeletedDocuments({ documents, onClose, onRecover }: { documents: ManagedLibraryDocument[]; onClose: () => void; onRecover: (id: string) => void }) {
  if (!documents.length) return null;
  return <div className="admin-modal-backdrop document-recovery-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="admin-modal document-recovery-modal" role="dialog" aria-modal="true" aria-labelledby="deleted-documents-heading">
      <header><div><span className="eyebrow">RECOVERY</span><h2 id="deleted-documents-heading">Deleted documents</h2><p>Restore a deleted document to the library.</p></div><button type="button" onClick={onClose} aria-label="Close document recovery"><X /></button></header>
      <div className="document-recovery-list">{documents.map(document => <article className="document-recovery-row" key={document.id}><div><strong>{document.title}</strong><small>Deleted {document.deletedAt ? new Date(document.deletedAt).toLocaleString() : "recently"}</small></div><button className="secondary-button" type="button" onClick={() => { onRecover(document.id); if (documents.length === 1) onClose(); }}><RotateCcw /> Recover</button></article>)}</div>
    </section>
  </div>;
}
