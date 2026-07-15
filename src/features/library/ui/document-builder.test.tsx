import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getPublishedDocuments } from "../data/repository";
import { createBlankContentElement, getInitialContentElements } from "../domain/document-elements";
import { DocumentBuilder } from "./document-builder";

describe("DocumentBuilder element reordering", () => {
  it("supports dragging elements into a new saved position", async () => {
    const document = getPublishedDocuments()[0];
    const initialElements = getInitialContentElements(document);
    const onSave = vi.fn().mockResolvedValue(undefined);

    const view = render(<DocumentBuilder doc={document} activeTopicId={document.topics[0]?.id ?? ""} onTopicChange={vi.fn()} onSave={onSave} onSaveVideoUrl={vi.fn()} />);
    const controls = within(view.container);
    fireEvent.click(controls.getAllByRole("button", { name: "Switch to edit mode" })[0]);
    fireEvent.click(controls.getByRole("button", { name: "REORDER" }));

    const dialog = controls.getByRole("dialog", { name: "Reorder elements" });
    const rows = within(dialog).getAllByRole("listitem");
    const dataTransfer = { effectAllowed: "", dropEffect: "", setData: vi.fn(), getData: () => initialElements[0].id };
    fireEvent.dragStart(rows[0], { dataTransfer });
    fireEvent.dragEnter(rows[1], { dataTransfer });
    fireEvent.dragOver(rows[1], { dataTransfer });
    fireEvent.drop(rows[1], { dataTransfer });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save order" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].slice(0, 2).map((element: { id: string }) => element.id)).toEqual([initialElements[1].id, initialElements[0].id]);
  });

  it("reorders elements in the dialog and saves the new order", async () => {
    const document = getPublishedDocuments()[0];
    const initialElements = getInitialContentElements(document);
    const onSave = vi.fn().mockResolvedValue(undefined);

    const view = render(<DocumentBuilder doc={document} activeTopicId={document.topics[0]?.id ?? ""} onTopicChange={vi.fn()} onSave={onSave} onSaveVideoUrl={vi.fn()} />);
    const controls = within(view.container);

    fireEvent.click(controls.getAllByRole("button", { name: "Switch to edit mode" })[0]);
    fireEvent.click(controls.getByRole("button", { name: "REORDER" }));

    const dialog = controls.getByRole("dialog", { name: "Reorder elements" });
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(initialElements.length);

    fireEvent.click(within(dialog).getByRole("button", { name: `Move ${initialElements[0].title} down` }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save order" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const savedElements = onSave.mock.calls[0][0];
    expect(savedElements.slice(0, 2).map((element: { id: string }) => element.id)).toEqual([initialElements[1].id, initialElements[0].id]);
    expect(savedElements.filter((element: { type: string }) => element.type === "topic").map((element: { eyebrow: string }) => element.eyebrow)).toEqual(initialElements.filter(element => element.type === "topic").map((_, index) => `Part ${index + 1}`));
    expect(controls.queryByRole("dialog", { name: "Reorder elements" })).not.toBeInTheDocument();
  });
});

describe("DocumentBuilder dropdown elements", () => {
  it("renders every dropdown collapsed by default", () => {
    const baseDocument = getPublishedDocuments()[0];
    const accordion = {
      ...createBlankContentElement("accordion", 1),
      dropdowns: [
        { title: "First dropdown", text: "First dropdown content" },
        { title: "Second dropdown", text: "Second dropdown content" },
      ],
    };
    const document = { ...baseDocument, contentElements: [accordion] };

    const view = render(<DocumentBuilder doc={document} activeTopicId="" onTopicChange={vi.fn()} onSave={vi.fn()} onSaveVideoUrl={vi.fn()} />);
    const dropdowns = view.container.querySelectorAll("article details");

    expect(dropdowns).toHaveLength(2);
    dropdowns.forEach(dropdown => expect(dropdown).not.toHaveAttribute("open"));
  });
});

describe("DocumentBuilder feature cards", () => {
  it("renders each saved line on its own row", () => {
    const baseDocument = getPublishedDocuments()[0];
    const feature = {
      ...createBlankContentElement("feature", 1),
      label: "Feature label",
      title: "Feature title",
      text: "First row\nSecond row\nThird row",
    };
    const document = { ...baseDocument, contentElements: [feature] };

    const view = render(<DocumentBuilder doc={document} activeTopicId="" onTopicChange={vi.fn()} onSave={vi.fn()} onSaveVideoUrl={vi.fn()} />);
    const firstRow = view.getByText("First row");
    const rows = firstRow.parentElement?.querySelectorAll("p");

    expect(firstRow.tagName).toBe("P");
    expect(rows).toHaveLength(3);
    expect(Array.from(rows ?? []).map(row => row.textContent)).toEqual(["First row", "Second row", "Third row"]);
  });
});
