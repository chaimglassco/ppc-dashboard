"use client";

import { AlertTriangle, LoaderCircle, RotateCcw, Trash2, X } from "lucide-react";
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
  onPermanentlyDelete: (document: ManagedLibraryDocument) => Promise<string | null>;
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
  onPermanentlyDelete,
}: DeletedDocumentsProps) {
  const [confirmSystemRecovery, setConfirmSystemRecovery] = useState(false);
  const [documentToPurge, setDocumentToPurge] = useState<ManagedLibraryDocument | null>(null);
  const [isPermanentlyDeleting, setIsPermanentlyDeleting] = useState(false);
  const [permanentDeleteError, setPermanentDeleteError] = useState("");
  if (!documents.length) return null;

  const isBusy = isRecoveringSystemDocuments || isPermanentlyDeleting;
  const systemDeletedIds = documents
    .filter(document => deletionAudit[document.id]?.source === "system_migration")
    .map(document => document.id);

  const confirmPermanentDelete = async () => {
    if (!documentToPurge || isPermanentlyDeleting) return;
    setIsPermanentlyDeleting(true);
    setPermanentDeleteError("");
    const error = await onPermanentlyDelete(documentToPurge);
    setIsPermanentlyDeleting(false);
    if (error) {
      setPermanentDeleteError(error);
      return;
    }
    setDocumentToPurge(null);
    if (documents.length === 1) onClose();
  };

  return <>
    <div className="admin-modal-backdrop document-recovery-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !isBusy) onClose();
    }}>
      <section className="admin-modal document-recovery-modal" role="dialog" aria-modal="true" aria-labelledby="deleted-documents-heading">
        <header>
          <div><span className="eyebrow">RECOVERY</span><h2 id="deleted-documents-heading">Deleted documents</h2><p>See what deleted each document before deciding what to recover or permanently delete.</p></div>
          <button type="button" onClick={onClose} disabled={isBusy} aria-label="Close document recovery"><X /></button>
        </header>
        <div className="document-recovery-content">
          {systemDeletedIds.length ? <section className="system-recovery-panel" aria-label="System-deleted document recovery">
            {!confirmSystemRecovery ? <>
              <div><strong>{systemDeletedIds.length} {systemDeletedIds.length === 1 ? "document was" : "documents were"} deleted by the Initial Library cleanup.</strong><p>This will not recover documents deleted manually by a user.</p></div>
              <button className="primary-button" type="button" disabled={isBusy} onClick={() => setConfirmSystemRecovery(true)}><RotateCcw /> Recover system-deleted documents</button>
            </> : <>
              <AlertTriangle aria-hidden="true" />
              <div><strong>Recover {systemDeletedIds.length} system-deleted {systemDeletedIds.length === 1 ? "document" : "documents"}?</strong><p>The recovery is atomic: either every eligible document is restored, or none are.</p>{systemRecoveryError ? <p className="system-recovery-error" role="alert">{systemRecoveryError}</p> : null}</div>
              <div className="system-recovery-actions">
                <button className="secondary-button" type="button" disabled={isBusy} onClick={() => setConfirmSystemRecovery(false)}>Cancel</button>
                <button className="primary-button" type="button" disabled={isBusy} onClick={() => onRecoverSystemDeleted(systemDeletedIds)}>
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
              <div className="document-recovery-actions">
                <button className="secondary-button" type="button" disabled={isBusy} onClick={() => { onRecover(document.id); if (documents.length === 1) onClose(); }}><RotateCcw /> Recover</button>
                <button className="document-permanent-delete-button" type="button" disabled={isBusy} aria-label={`Permanently delete ${document.title}`} title="Permanently delete" onClick={() => { setPermanentDeleteError(""); setDocumentToPurge(document); }}><Trash2 /></button>
              </div>
            </article>;
          })}</div>
        </div>
      </section>
    </div>
    {documentToPurge ? <div className="admin-modal-backdrop permanent-delete-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !isPermanentlyDeleting) setDocumentToPurge(null);
    }}>
      <section className="admin-modal permanent-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="permanent-delete-heading" aria-describedby="permanent-delete-description">
        <header>
          <div><span className="eyebrow">PERMANENT DELETION</span><h2 id="permanent-delete-heading">Delete forever?</h2></div>
          <button type="button" disabled={isPermanentlyDeleting} onClick={() => setDocumentToPurge(null)} aria-label="Close permanent delete confirmation"><X /></button>
        </header>
        <div className="permanent-delete-dialog__body">
          <AlertTriangle aria-hidden="true" />
          <p id="permanent-delete-description">Permanently delete <strong>“{documentToPurge.title}”</strong>? Its content will be removed forever and cannot be recovered from this list or restored from a backup.</p>
          {permanentDeleteError ? <p className="permanent-delete-dialog__error" role="alert">{permanentDeleteError}</p> : null}
        </div>
        <footer>
          <button className="secondary-button" type="button" disabled={isPermanentlyDeleting} onClick={() => setDocumentToPurge(null)}>Cancel</button>
          <button className="permanent-delete-dialog__confirm" type="button" disabled={isPermanentlyDeleting} onClick={() => void confirmPermanentDelete()}>
            {isPermanentlyDeleting ? <><LoaderCircle className="spinning-icon" /> Deleting forever…</> : <><Trash2 /> Permanently delete</>}
          </button>
        </footer>
      </section>
    </div> : null}
  </>;
}
