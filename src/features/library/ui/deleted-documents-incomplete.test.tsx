import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SharedLibraryDocumentIntegrity } from "../state/shared-library-state";
import { DeletedDocuments } from "./deleted-documents";

const incompleteDocuments: SharedLibraryDocumentIntegrity[] = [
  {
    status: "incomplete",
    documentId: "doc-1",
    slug: "first-document",
    title: "First document",
    recordVersion: 6,
    reasonCode: "DOCUMENT_SCHEMA_INVALID",
    hasRecoveryCandidate: true,
    recoveryCandidateVersionId: "version-5",
    recoveryCandidateRecordVersion: 5,
    recoveryCandidateCreatedAt: "2026-07-30T10:00:00.000Z",
  },
  {
    status: "incomplete",
    documentId: "doc-2",
    slug: "second-document",
    title: "Second document",
    recordVersion: 3,
    reasonCode: "DOCUMENT_SCHEMA_INVALID",
    hasRecoveryCandidate: true,
    recoveryCandidateVersionId: "version-2",
    recoveryCandidateRecordVersion: 2,
    recoveryCandidateCreatedAt: "2026-07-29T10:00:00.000Z",
  },
];

function renderRecovery(
  onRecoverIncomplete = vi.fn().mockResolvedValue(null),
  documents = incompleteDocuments,
) {
  render(<DeletedDocuments
    documents={[]}
    incompleteDocuments={documents}
    deletionAudit={{}}
    isRecoveringSystemDocuments={false}
    systemRecoveryError=""
    onClose={() => undefined}
    onRecover={async () => null}
    onRecoverIncomplete={onRecoverIncomplete}
    onRecoverSystemDeleted={() => undefined}
    onPermanentlyDelete={async () => null}
    purgedHistoryError=""
    isLoadingDocuments={false}
    documentLoadError=""
    isLoadingPurgedHistory={false}
    onRetry={() => undefined}
  />);
  return onRecoverIncomplete;
}

describe("incomplete active document recovery", () => {
  afterEach(cleanup);

  it("shows a protected preview and restores one validated candidate", async () => {
    const recover = renderRecovery();

    expect(screen.getAllByRole("link", { name: "Preview" })[0]).toHaveAttribute("href", "/library/first-document");
    fireEvent.click(screen.getAllByRole("button", { name: "Restore" })[0]);

    await waitFor(() => expect(recover).toHaveBeenCalledWith([incompleteDocuments[0]]));
  });

  it("requires confirmation before requesting an all-or-nothing bulk recovery", async () => {
    const recover = renderRecovery();

    fireEvent.click(screen.getByRole("button", { name: "Recover all valid versions" }));
    const dialog = screen.getByRole("alertdialog", { name: "Recover 2 incomplete documents?" });
    expect(recover).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Recover all" }));

    await waitFor(() => expect(recover).toHaveBeenCalledWith(incompleteDocuments));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("bulk-recovers only documents with a currently valid protected version", async () => {
    const unavailable: SharedLibraryDocumentIntegrity = {
      ...incompleteDocuments[1],
      documentId: "doc-3",
      slug: "unavailable-document",
      title: "Unavailable document",
      hasRecoveryCandidate: false,
      recoveryCandidateVersionId: undefined,
      recoveryCandidateRecordVersion: undefined,
      recoveryCandidateCreatedAt: undefined,
    };
    const recover = renderRecovery(undefined, [incompleteDocuments[0], incompleteDocuments[1], unavailable]);

    expect(screen.getByText("2 can be restored from their newest versions that pass the current validator.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recover all valid versions" }));
    fireEvent.click(screen.getByRole("button", { name: "Recover all" }));

    await waitFor(() => expect(recover).toHaveBeenCalledWith(incompleteDocuments));
  });
});
