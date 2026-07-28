"use client";

import { AlertTriangle, LoaderCircle, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { ManagedLibraryDocument } from "../state/admin-storage";
import type { PurgedLibraryDocument } from "../state/shared-library-client";
import type { LibraryDocumentDeletionAudit } from "../state/shared-library-state";

type DeletedDocumentsProps = {
  documents: ManagedLibraryDocument[];
  deletionAudit: Record<string, LibraryDocumentDeletionAudit>;
  isRecoveringSystemDocuments: boolean;
  systemRecoveryError: string;
  onClose: () => void;
  onRecover: (document: ManagedLibraryDocument) => Promise<string | null>;
  onRecoverSystemDeleted: (documentIds: string[]) => void;
  onPermanentlyDelete: (document: ManagedLibraryDocument) => Promise<string | null>;
  purgedDocuments: PurgedLibraryDocument[];
  purgedHistoryError: string;
  isLoadingDocuments: boolean;
  documentLoadError: string;
  isLoadingPurgedHistory: boolean;
  onRetry: () => void;
  onRestorePurged: (document: PurgedLibraryDocument) => Promise<string | null>;
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
  purgedDocuments,
  purgedHistoryError,
  isLoadingDocuments,
  documentLoadError,
  isLoadingPurgedHistory,
  onRetry,
  onRestorePurged,
}: DeletedDocumentsProps) {
  const [confirmSystemRecovery, setConfirmSystemRecovery] = useState(false);
  const [documentToPurge, setDocumentToPurge] = useState<ManagedLibraryDocument | null>(null);
  const [purgedToRestore, setPurgedToRestore] = useState<PurgedLibraryDocument | null>(null);
  const [recoveringDocumentId, setRecoveringDocumentId] = useState("");
  const [recoverError, setRecoverError] = useState<{ documentId: string; message: string } | null>(null);
  const [isPermanentlyDeleting, setIsPermanentlyDeleting] = useState(false);
  const [isRestoringPurged, setIsRestoringPurged] = useState(false);
  const [permanentDeleteError, setPermanentDeleteError] = useState("");
  const [purgedRestoreError, setPurgedRestoreError] = useState("");

  const isBusy = isRecoveringSystemDocuments || isPermanentlyDeleting || isRestoringPurged || Boolean(recoveringDocumentId);
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

  const recoverDocument = async (document: ManagedLibraryDocument) => {
    if (isBusy) return;
    setRecoveringDocumentId(document.id);
    setRecoverError(null);
    const error = await onRecover(document);
    setRecoveringDocumentId("");
    if (error) {
      setRecoverError({ documentId: document.id, message: error });
      return;
    }
    if (documents.length === 1) onClose();
  };

  const restorePurgedDocument = async () => {
    if (!purgedToRestore || isBusy) return;
    setIsRestoringPurged(true);
    setPurgedRestoreError("");
    const error = await onRestorePurged(purgedToRestore);
    setIsRestoringPurged(false);
    if (error) {
      setPurgedRestoreError(error);
      return;
    }
    setPurgedToRestore(null);
    onClose();
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
          {isLoadingDocuments ? <div className="document-recovery-load-state" role="status"><LoaderCircle className="spinning-icon" /><strong>Loading recoverable documents...</strong></div> : null}
          {documentLoadError ? <div className="document-recovery-load-error" role="alert"><p>{documentLoadError}</p><button className="secondary-button" type="button" disabled={isLoadingDocuments || isLoadingPurgedHistory} onClick={onRetry}><RotateCcw /> Try again</button></div> : null}
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
          {!isLoadingDocuments && documents.length ? <div className="document-recovery-list">{documents.map(document => {
            const audit = deletionAudit[document.id];
            const initiatedBy = initiatorLabel(audit);
            const isRecovering = recoveringDocumentId === document.id;
            const rowError = recoverError?.documentId === document.id ? recoverError.message : "";
            return <article className="document-recovery-row" key={document.id}>
              <div><strong>{document.title}</strong><small>{deletionLabel(document, audit)}</small>{initiatedBy ? <small>{initiatedBy}</small> : null}{rowError ? <small className="document-recovery-error" role="alert">{rowError}</small> : null}</div>
              <div className="document-recovery-actions">
                <button className="secondary-button" type="button" disabled={isBusy} onClick={() => void recoverDocument(document)}>
                  {isRecovering ? <><LoaderCircle className="spinning-icon" /> Recovering…</> : <><RotateCcw /> Recover</>}
                </button>
                <button className="document-permanent-delete-button" type="button" disabled={isBusy} aria-label={`Permanently delete ${document.title}`} title="Permanently delete" onClick={() => { setPermanentDeleteError(""); setDocumentToPurge(document); }}><Trash2 /></button>
              </div>
            </article>;
          })}</div> : null}
          {isLoadingPurgedHistory ? <div className="document-recovery-load-state" role="status"><LoaderCircle className="spinning-icon" /><strong>Loading permanent deletion history...</strong></div> : null}
          {purgedHistoryError ? <div className="document-recovery-load-error" role="alert"><p>{purgedHistoryError}</p><button className="secondary-button" type="button" disabled={isLoadingDocuments || isLoadingPurgedHistory} onClick={onRetry}><RotateCcw /> Try again</button></div> : null}
          {!isLoadingPurgedHistory && purgedDocuments.length ? <section className="permanent-deletion-history" aria-label="Permanent deletion history">
            <div className="permanent-deletion-history__heading">
              <strong>Permanent deletion history</strong>
              <p>These documents are no longer in normal Recovery. Restoring from a protected snapshot is available only for the approved bQool repair.</p>
            </div>
            <div className="document-recovery-list">{purgedDocuments.map(document => <article className="document-recovery-row" key={document.documentId}>
              <div>
                <strong>{document.title}</strong>
                <small>{document.deletedAt ? `Permanently deleted ${new Date(document.deletedAt).toLocaleString()}` : "Permanently deleted"}</small>
                <small>Protected copy: {document.source.label}{document.source.createdAt ? ` · ${new Date(document.source.createdAt).toLocaleString()}` : ""}</small>
              </div>
              <div className="document-recovery-actions">
                {document.canRestore ? <button className="secondary-button" type="button" disabled={isBusy} onClick={() => { setPurgedRestoreError(""); setPurgedToRestore(document); }}><RotateCcw /> Restore bQool</button> : <span className="permanent-deletion-history__status">History only</span>}
              </div>
            </article>)}</div>
          </section> : null}
          {!isLoadingDocuments && !isLoadingPurgedHistory && !documentLoadError && !purgedHistoryError && !documents.length && !purgedDocuments.length ? <p className="document-recovery-empty">No recoverable or known permanently deleted documents were found.</p> : null}
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
    {purgedToRestore ? <div className="admin-modal-backdrop permanent-delete-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !isRestoringPurged) setPurgedToRestore(null);
    }}>
      <section className="admin-modal permanent-delete-dialog protected-restore-dialog" role="alertdialog" aria-modal="true" aria-labelledby="protected-restore-heading" aria-describedby="protected-restore-description">
        <header>
          <div><span className="eyebrow">PROTECTED SNAPSHOT</span><h2 id="protected-restore-heading">Restore bQool?</h2></div>
          <button type="button" disabled={isRestoringPurged} onClick={() => setPurgedToRestore(null)} aria-label="Close protected restore confirmation"><X /></button>
        </header>
        <div className="permanent-delete-dialog__body">
          <RotateCcw aria-hidden="true" />
          <p id="protected-restore-description">Restore <strong>“{purgedToRestore.title}”</strong> from {purgedToRestore.source.label}? Its original document link and content will be put back into the active Library.</p>
          {purgedRestoreError ? <p className="permanent-delete-dialog__error" role="alert">{purgedRestoreError}</p> : null}
        </div>
        <footer>
          <button className="secondary-button" type="button" disabled={isRestoringPurged} onClick={() => setPurgedToRestore(null)}>Cancel</button>
          <button className="primary-button" type="button" disabled={isRestoringPurged} onClick={() => void restorePurgedDocument()}>
            {isRestoringPurged ? <><LoaderCircle className="spinning-icon" /> Restoring bQool…</> : <><RotateCcw /> Confirm restoration</>}
          </button>
        </footer>
      </section>
    </div> : null}
  </>;
}
