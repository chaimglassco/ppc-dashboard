"use client";
import { LoaderCircle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGlasscoSession } from "@/components/glassco-session";
import { getTopicsFromContentElements } from "../domain/document-elements";
import type { LibraryContentElement } from "../domain/types";
import { normalizeManagedLibraryDocument, type ManagedLibraryDocument } from "../state/admin-storage";
import { createDefaultCategories } from "../state/category-storage";
import { cacheSharedLibraryResponse, fetchSharedLibraryState, hydrateSharedLibraryState, invalidateSharedLibraryDocumentCache, mutateSharedLibrary, SharedLibraryConflictError } from "../state/shared-library-client";
import { getSharedLibraryRefreshDelay } from "../state/shared-library-retry";
import type { LibraryDocumentDeletionAudit, SharedLibraryDocumentStatus, SharedLibraryResponse } from "../state/shared-library-state";
import type { DocumentMetadataDraft } from "./document-builder";
import { Reader } from "./reader";

export class DocumentSaveVerificationError extends Error {
  constructor(message = "The document save could not be verified. Your changes remain open; please try saving again.") {
    super(message);
    this.name = "DocumentSaveVerificationError";
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map(key => [
    key,
    stableValue((value as Record<string, unknown>)[key]),
  ]));
}

function sameStructuredContent(left: unknown, right: unknown) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

export function verifyDocumentSaveResponse(response: SharedLibraryResponse, submitted: ManagedLibraryDocument, expectedVersion: number): ManagedLibraryDocument {
  const result = response.mutationResult;
  const returned = response.state.documents.find(document => document.id === submitted.id);
  const returnedVersion = response.recordVersions.documents[submitted.id];
  if (!result
    || result.operation !== "document.update"
    || result.documentId !== submitted.id
    || result.document.id !== submitted.id
    || result.document.slug !== submitted.slug
    || result.lifecycleState !== "active"
    || result.recordVersion <= expectedVersion
    || returnedVersion !== result.recordVersion
    || response.documentStatus?.status !== "active"
    || response.documentStatus.documentId !== submitted.id
    || !returned
    || returned.slug !== submitted.slug
    || returned.deletedAt
    || returned.archivedAt
    || result.document.deletedAt
    || result.document.archivedAt
    || returned.hidden !== submitted.hidden
    || returned.status !== submitted.status
    || returned.title !== submitted.title
    || returned.description !== submitted.description
    || returned.category !== submitted.category
    || !sameStructuredContent(returned.contentElements, submitted.contentElements)
    || !sameStructuredContent(result.document.contentElements, submitted.contentElements)) {
    throw new DocumentSaveVerificationError();
  }
  return returned;
}

export function ManagedReader({ slug }: { slug: string }) {
  const { canAdmin } = useGlasscoSession();
  const [document, setDocument] = useState<ManagedLibraryDocument | null | undefined>(undefined);
  const [documentSlug, setDocumentSlug] = useState(slug);
  const [categories, setCategories] = useState(() => createDefaultCategories().map(category => category.name));
  const [mutationsEnabled, setMutationsEnabled] = useState(false);
  const [migrationPending, setMigrationPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [documentStatus, setDocumentStatus] = useState<SharedLibraryDocumentStatus | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const [loadError, setLoadError] = useState<{ slug: string; message: string } | null>(null);
  const sharedRef = useRef<SharedLibraryResponse | null>(null);
  const refreshInFlightRef = useRef(false);
  const documentRef = useRef<ManagedLibraryDocument | null | undefined>(undefined);
  const consecutiveFailuresRef = useRef(0);

  const applyResponse = useCallback((response: SharedLibraryResponse, cache = true, preserveOnMissing = false) => {
    const nextDocument = response.state.documents.find(item => item.slug === slug && !item.deletedAt && !item.hidden) ?? null;
    const nextStatus = response.documentStatus ?? (nextDocument ? { status: "active" as const, slug } : null);
    const explicitlyUnavailable = nextStatus?.status === "deleted" || nextStatus?.status === "purged" || nextStatus?.status === "archived";
    if (!nextDocument && preserveOnMissing && !explicitlyUnavailable) {
      setNotice("The latest Library response did not include this active document. The current editor copy was preserved.");
      return false;
    }
    sharedRef.current = response;
    setDocumentSlug(slug);
    setDocumentStatus(nextStatus);
    documentRef.current = nextDocument;
    setDocument(nextDocument);
    setLoadError(null);
    setCategories(response.state.categories.filter(category => !category.deletedAt).map(category => category.name));
    if (nextStatus && nextStatus.status !== "active") invalidateSharedLibraryDocumentCache(window.localStorage, slug);
    else if (cache && nextDocument) cacheSharedLibraryResponse(response, window.localStorage, { slug });
    return true;
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
        const timestamp = sharedRef.current?.snapshotAt || sharedRef.current?.updatedAt;
        const when = timestamp ? new Date(timestamp).toLocaleString() : "an earlier session";
        setNotice(`Shared library is unavailable. This confirmed copy is read-only. Snapshot from ${when}; revision ${sharedRef.current?.revision ?? "unknown"}.`);
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
      if (source === "cache") {
        const timestamp = response.snapshotAt || response.updatedAt;
        const when = timestamp ? new Date(timestamp).toLocaleString() : "an earlier session";
        setNotice(`Shared library is unavailable. This confirmed copy is read-only. Snapshot from ${when}; revision ${response.revision}.`);
      }
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
    const onResume = () => { if (globalThis.document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onResume);
    window.addEventListener("pageshow", onResume);
    window.addEventListener("popstate", onResume);
    globalThis.document.addEventListener("visibilitychange", onResume);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("pageshow", onResume);
      window.removeEventListener("popstate", onResume);
      globalThis.document.removeEventListener("visibilitychange", onResume);
    };
  }, [document, documentSlug, loadError, refresh, slug]);
  const currentDocument = document && document.slug === slug
    ? document
    : document === null && documentSlug === slug
      ? null
      : undefined;
  const currentLoadError = loadError?.slug === slug ? loadError.message : "";
  const recoverDeletedDocument = async () => {
    if (!canAdmin || !mutationsEnabled || documentStatus?.status !== "deleted" || !documentStatus.documentId || documentStatus.recordVersion === undefined || isRecovering) return;
    setIsRecovering(true);
    setRecoveryError("");
    try {
      const saved = await mutateSharedLibrary({
        operation: "document.restore",
        documentId: documentStatus.documentId,
        expectedVersion: documentStatus.recordVersion,
      }, { slug });
      applyResponse(saved);
      setMutationsEnabled(saved.initialized);
      setNotice(`“${documentStatus.title || "Document"}” was recovered successfully.`);
    } catch (error) {
      if (error instanceof SharedLibraryConflictError) applyResponse(error.latest);
      setRecoveryError(error instanceof Error ? error.message : "The document could not be recovered. Please try again.");
    } finally {
      setIsRecovering(false);
    }
  };
  if (currentDocument === undefined && currentLoadError) return <div className="empty-state managed-not-found"><h1>Library connection unavailable</h1><p>{currentLoadError} Check the connection and try again.</p><button className="primary-button" type="button" onClick={() => { setLoadError(null); void refresh(); }}>Try again</button><Link className="secondary-button" prefetch={false} href="/library">Return to Library</Link></div>;
  if (currentDocument === undefined) return <div className="reader-loading" aria-label="Loading document"><div className="skeleton wide"/></div>;
  if (currentDocument === null && documentStatus?.status === "deleted") {
    return <DeletedDocumentState status={documentStatus} canRecover={canAdmin && mutationsEnabled && documentStatus.recordVersion !== undefined} isRecovering={isRecovering} error={recoveryError} onRecover={() => void recoverDeletedDocument()} />;
  }
  if (currentDocument === null && documentStatus?.status === "purged") {
    return <div className="empty-state managed-not-found"><h1>{documentStatus.title ? `“${documentStatus.title}” was permanently deleted` : "Document permanently deleted"}</h1><p>This document was permanently removed and cannot be recovered.</p><Link className="primary-button" prefetch={false} href="/library">Return to Library</Link></div>;
  }
  if (currentDocument === null) return <div className="empty-state managed-not-found"><h1>{migrationPending ? "Library migration pending" : "Document unavailable"}</h1><p>{migrationPending ? "The shared catalog is read-only until an administrator completes initialization." : "This topic may be hidden or unavailable in the shared library."}</p><Link className="primary-button" prefetch={false} href="/library">Return to Library</Link></div>;
  const saveDocument = async (updated: ManagedLibraryDocument) => {
    const expectedVersion = sharedRef.current?.recordVersions.documents[updated.id];
    if (!mutationsEnabled || expectedVersion === undefined) throw new Error("Shared library editing is unavailable.");
    const normalized = normalizeManagedLibraryDocument(updated);
    if (!normalized) throw new DocumentSaveVerificationError("The formatted document contains invalid data. Your changes remain open and were not submitted.");
    try {
      const saved = await mutateSharedLibrary({
        operation: "document.update",
        documentId: normalized.id,
        expectedVersion,
        updateScope: "content",
        document: normalized,
      }, { slug });
      verifyDocumentSaveResponse(saved, normalized, expectedVersion);
      applyResponse(saved);
    } catch (error) {
      if (error instanceof SharedLibraryConflictError) {
        applyResponse(error.latest, true, true);
        setNotice(error.message);
      } else if (error instanceof DocumentSaveVerificationError) {
        setNotice(error.message);
      } else {
        setMutationsEnabled(false);
        setNotice("Unable to verify the shared Library save. Your editor changes remain open; reconnect, then try saving again.");
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

function auditActor(audit?: LibraryDocumentDeletionAudit) {
  const actor = audit?.actor;
  if (!actor) return "an unknown user";
  const identity = actor.name || actor.email || "an unknown user";
  const email = actor.email && actor.email !== identity ? ` (${actor.email})` : "";
  return `${identity}${email} · ${actor.role}`;
}

function deletedDocumentDescription(status: SharedLibraryDocumentStatus) {
  const audit = status.deletionAudit;
  const deletedAt = audit?.deletedAt || status.deletedAt;
  const date = deletedAt ? new Date(deletedAt).toLocaleString() : "an unknown time";
  if (!audit || audit.source === "unknown") return `Deleted ${date}; deletion source is unavailable.`;
  if (audit.source === "user") return `Deleted ${date} by ${auditActor(audit)}.`;
  if (audit.source === "system_migration") return `Deleted ${date} by System — Initial Library cleanup.`;
  const initiator = audit.initiatedBy ? `, initiated by ${audit.initiatedBy.name || audit.initiatedBy.email}` : "";
  return `Deleted ${date} by System — Backup restore${initiator}.`;
}

function DeletedDocumentState({ status, canRecover, isRecovering, error, onRecover }: {
  status: SharedLibraryDocumentStatus;
  canRecover: boolean;
  isRecovering: boolean;
  error: string;
  onRecover: () => void;
}) {
  return <div className="empty-state managed-not-found">
    <h1>{status.title ? `“${status.title}” was deleted` : "Document deleted"}</h1>
    <p>{deletedDocumentDescription(status)}</p>
    {error ? <p className="admin-notice" role="alert">{error}</p> : null}
    <div className="managed-not-found-actions">
      {canRecover ? <button className="primary-button" type="button" disabled={isRecovering} onClick={onRecover}>{isRecovering ? <><LoaderCircle className="spinning-icon" /> Recovering…</> : <><RotateCcw /> Recover document</>}</button> : null}
      <Link className={canRecover ? "secondary-button" : "primary-button"} prefetch={false} href="/library">Return to Library</Link>
    </div>
  </div>;
}
