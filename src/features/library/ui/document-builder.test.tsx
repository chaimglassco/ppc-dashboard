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

describe("DocumentBuilder element insertion", () => {
  it("adds a selected element directly after the chosen element", async () => {
    const document = getPublishedDocuments()[0];
    const initialElements = getInitialContentElements(document);
    const onSave = vi.fn().mockResolvedValue(undefined);

    const view = render(<DocumentBuilder doc={document} activeTopicId={document.topics[0]?.id ?? ""} onTopicChange={vi.fn()} onSave={onSave} onSaveVideoUrl={vi.fn()} />);
    const controls = within(view.container);
    fireEvent.click(controls.getAllByRole("button", { name: "Switch to edit mode" })[0]);

    expect(view.container.querySelectorAll('button[aria-label^="Add element after "]')).toHaveLength(initialElements.length);
    fireEvent.click(controls.getByRole("button", { name: `Add element after ${initialElements[0].title}` }));
    fireEvent.click(controls.getByRole("button", { name: "Centered Statement" }));
    fireEvent.click(controls.getAllByRole("button", { name: "Save changes and switch to view mode" })[0]);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const savedElements = onSave.mock.calls[0][0];
    expect(savedElements[0].id).toBe(initialElements[0].id);
    expect(savedElements[1].type).toBe("statement");
    expect(savedElements[2].id).toBe(initialElements[1].id);
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

describe("DocumentBuilder roadmaps", () => {
  it("saves step images and roadmap alignment, then renders them in view mode", async () => {
    const baseDocument = getPublishedDocuments()[0];
    const roadmap = {
      ...createBlankContentElement("timeline", 1),
      title: "Launch roadmap",
      steps: [{ title: "Step one", text: "Complete the first step", imageUrl: "" }],
    };
    const document = { ...baseDocument, contentElements: [roadmap] };
    const onSave = vi.fn().mockResolvedValue(undefined);

    const view = render(<DocumentBuilder doc={document} activeTopicId="" onTopicChange={vi.fn()} onSave={onSave} onSaveVideoUrl={vi.fn()} />);
    const controls = within(view.container);
    fireEvent.click(controls.getAllByRole("button", { name: "Switch to edit mode" })[0]);
    fireEvent.change(controls.getByRole("textbox", { name: "Step 1 image URL" }), { target: { value: "https://images.example.com/step-one.jpg" } });
    fireEvent.click(controls.getByRole("button", { name: "Right" }));
    fireEvent.click(controls.getAllByRole("button", { name: "Save changes and switch to view mode" })[0]);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const savedRoadmap = onSave.mock.calls[0][0][0];
    expect(savedRoadmap.alignment).toBe("right");
    expect(savedRoadmap.steps[0].imageUrl).toBe("https://images.example.com/step-one.jpg");
    expect(view.container.querySelector('section[data-alignment="right"]')).toBeInTheDocument();
    expect(controls.getByRole("img", { name: "Step one roadmap image" })).toBeInTheDocument();
  });
});

describe("DocumentBuilder image galleries", () => {
  it("saves the selected grid layout and repeatable images, then renders the gallery", async () => {
    const baseDocument = getPublishedDocuments()[0];
    const gallery = createBlankContentElement("gallery", 1);
    const document = { ...baseDocument, contentElements: [gallery] };
    const onSave = vi.fn().mockResolvedValue(undefined);

    const view = render(<DocumentBuilder doc={document} activeTopicId="" onTopicChange={vi.fn()} onSave={onSave} onSaveVideoUrl={vi.fn()} />);
    const controls = within(view.container);
    fireEvent.click(controls.getAllByRole("button", { name: "Switch to edit mode" })[0]);
    fireEvent.change(controls.getByRole("textbox", { name: "Gallery image 1 URL" }), { target: { value: "https://images.example.com/first.jpg" } });
    fireEvent.change(controls.getByRole("textbox", { name: "Gallery image 1 description" }), { target: { value: "First gallery image" } });
    fireEvent.click(controls.getByRole("button", { name: "3 Grid" }));
    fireEvent.click(controls.getByRole("button", { name: "Add image" }));

    expect(controls.getByRole("textbox", { name: "Gallery image 2 URL" })).toBeInTheDocument();
    fireEvent.click(controls.getAllByRole("button", { name: "Save changes and switch to view mode" })[0]);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const savedGallery = onSave.mock.calls[0][0][0];
    expect(savedGallery.galleryColumns).toBe(3);
    expect(savedGallery.images[0]).toEqual({ url: "https://images.example.com/first.jpg", alt: "First gallery image" });
    expect(view.container.querySelector('section[data-gallery-columns="3"]')).toBeInTheDocument();
    expect(controls.getByRole("img", { name: "First gallery image" })).toBeInTheDocument();
  });
});
