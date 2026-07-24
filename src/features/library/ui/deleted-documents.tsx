"use client";

import { AlertTriangle, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import type { ManagedLibraryDocument } from "../state/admin-storage";
import type { LibraryDocumentDeletionAudit } from "../state/shared-library-state";

type DeletedDocumentsProps = {
  documents: ManagedLibraryDocument[];
  deletionAudit: Record<string, LibraryDocumentDeletionAudit>;
  isRecoveringSystemDocuments: boolean;
  systemRecoveryError: string;
  onClose: () => void;
  onRecover: (id: string) => void;
  onRecoverSystemDeleted: (documentIds: string[]) => void;
};

function actorLabel(actor: LibraryDocumentDeletionAudit["actor"]) {
  if (!actor) return "";
  const identity = actor.name || actor.email;
  if (!identity) return "";
  const email = actor.email && actor.email !== identity ? ` (${actor.email})` : "";
  return `${identity}${email} · ${actor.role}`;
}

function deletionLabel(document: ManagedLibraryDocument, audit?: LibraryDocumentDeletionAudit) {
  const deletedAt = audit?.deletedAt || document.deletedAt;
  const date = deletedAt ? new Date(deletedAt).toLocaleString() : "recently";
  if (!audit || audit.source === "unknown") return `Deleted ${date} — source unavailable`;
  if (audit.source === "user") return `Deleted ${date} by ${actorLabel(audit.actor) || "an unknown user"}`;
  if (audit.source === "system_migration") return `Deleted ${date} by System — Initial Library cleanup`;
  return `Deleted ${date} by System — Backup restore`;
}

function initiatorLabel(audit?: LibraryDocumentDeletionAudit) {
  if (!audit?.initiatedBy) return "";
  return `Initiated by ${actorLabel(audit.initiatedBy)}`;
}

export function DeletedDocuments({
  documents,
  deletionAudit,
  isRecoveringSystemDocuments,
  systemRecoveryError,
  onClose,
  onRecover,
  onRecoverSystemDeleted,
}: DeletedDocumentsProps) {
  const [confirmSystemRecovery, setConfirmSystemRecovery] = useState(false);
  if (!documents.length) return null;
  const systemDeletedIds = documents
    .filter(document => deletionAudit[document.id]?.source === "system_migration")
    .map(document => document.id);

  return <div className="admin-modal-backdrop document-recovery-backdrop" role="presentation" onMouseDown={event => {
    if (event.target === event.currentTarget && !isRecoveringSystemDocuments) onClose();
  }}>
    <section className="admin-modal document-recovery-modal" role="dialog" aria-modal="true" aria-labelledby="deleted-documents-heading">
      <header>
        <div><span className="eyebrow">RECOVERY</span><h2 id="deleted-documents-heading">Deleted documents</h2><p>See what deleted each document before deciding what to recover.</p></div>
        <button type="button" onClick={onClose} disabled={isRecoveringSystemDocuments} aria-label="Close document recovery"><X /></button>
      </header>
      <div className="document-recovery-content">
        {systemDeletedIds.length ? <section className="system-recovery-panel" aria-label="System-deleted document recovery">
          {!confirmSystemRecovery ? <>
            <div><strong>{systemDeletedIds.length} {systemDeletedIds.length === 1 ? "document was" : "documents were"} deleted by the Initial Library cleanup.</strong><p>This will not recover documents deleted manually by a user.</p></div>
            <button className="primary-button" type="button" onClick={() => setConfirmSystemRecovery(true)}><RotateCcw /> Recover system-deleted documents</button>
          </> : <>
            <AlertTriangle aria-hidden="true" />
            <div><strong>Recover {systemDeletedIds.length} system-deleted {systemDeletedIds.length === 1 ? "document" : "documents"}?</strong><p>The recovery is atomic: either every eligible document is restored, or none are.</p>{systemRecoveryError ? <p className="system-recovery-error" role="alert">{systemRecoveryError}</p> : null}</div>
            <div className="system-recovery-actions">
              <button className="secondary-button" type="button" disabled={isRecoveringSystemDocuments} onClick={() => setConfirmSystemRecovery(false)}>Cancel</button>
              <button className="primary-button" type="button" disabled={isRecoveringSystemDocuments} onClick={() => onRecoverSystemDeleted(systemDeletedIds)}>
                {isRecoveringSystemDocuments ? <><LoaderCircle className="spinning-icon" /> Recovering…</> : <><RotateCcw /> Confirm recovery</>}
              </button>
            </div>
          </>}
        </section> : null}
        <div className="document-recovery-list">{documents.map(document => {
          const audit = deletionAudit[document.id];
          const initiatedBy = initiatorLabel(audit);
          return <article className="document-recovery-row" key={document.id}>
            <div><strong>{document.title}</strong><small>{deletionLabel(document, audit)}</small>{initiatedBy ? <small>{initiatedBy}</small> : null}</div>
            <button className="secondary-button" type="button" disabled={isRecoveringSystemDocuments} onClick={() => { onRecover(document.id); if (documents.length === 1) onClose(); }}><RotateCcw /> Recover</button>
          </article>;
        })}</div>
      </div>
    </section>
  </div>;
}
