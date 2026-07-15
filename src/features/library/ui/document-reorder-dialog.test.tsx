import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getPublishedDocuments } from "../data/repository";
import { DocumentReorderDialog } from "./document-reorder-dialog";

describe("DocumentReorderDialog", () => {
  it("supports dragging documents into a new saved order", async () => {
    const documents = getPublishedDocuments().slice(0, 3);
    const onSave = vi.fn();
    render(<DocumentReorderDialog documents={documents} onCancel={vi.fn()} onSave={onSave} />);
    const dialog = screen.getByRole("dialog", { name: "Reorder library documents" });
    const rows = within(dialog).getAllByRole("listitem");
    const dataTransfer = { effectAllowed: "", dropEffect: "", setData: vi.fn(), getData: () => documents[0].id };

    fireEvent.dragStart(rows[0], { dataTransfer });
    fireEvent.dragEnter(rows[1], { dataTransfer });
    fireEvent.dragOver(rows[1], { dataTransfer });
    fireEvent.drop(rows[1], { dataTransfer });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save order" }));

    expect(onSave).toHaveBeenCalledWith([documents[1].id, documents[0].id, documents[2].id]);
  });
});
