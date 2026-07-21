import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getPublishedDocuments } from "../data/repository";
import { createBlankContentElement, getInitialContentElements } from "../domain/document-elements";
import { DocumentBuilder } from "./document-builder";

function installSharedImageFetch(url: string) {
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:shared-image") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  window.localStorage.setItem("launchflow.authSession.v1", JSON.stringify({ token: "test-token", email: "admin@example.com", name: "Admin", role: "ADMIN" }));
  const fetchMock = vi.fn().mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => Promise.resolve(init?.method === "POST"
    ? new Response(JSON.stringify({ url }), { status: 200, headers: { "Content-Type": "application/json" } })
    : new Response(new Blob(["image"], { type: "image/png" }), { status: 200, headers: { "Content-Type": "image/png" } })));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("DocumentBuilder metadata editing", () => {
  it("edits and saves the title, description, and category inside document edit mode", async () => {
    const document = getPublishedDocuments()[0];
    const onSave = vi.fn().mockResolvedValue(undefined);
    const categories = [document.category, "Online Arbitrage"];
    const view = render(<DocumentBuilder canEdit doc={document} categories={categories} activeTopicId={document.topics[0]?.id ?? ""} onTopicChange={vi.fn()} onSave={onSave} onSaveVideoUrl={vi.fn()} />);
    const controls = within(view.container);

    expect(controls.queryByRole("textbox", { name: "Document title" })).not.toBeInTheDocument();
    fireEvent.click(controls.getAllByRole("button", { name: "Switch to edit mode" })[0]);
    fireEvent.change(controls.getByRole("textbox", { name: "Document title" }), { target: { value: "Updated document title" } });
    fireEvent.change(controls.getByRole("textbox", { name: "Document description" }), { target: { value: "Updated document description" } });
    fireEvent.change(controls.getByRole("combobox", { name: "Document category" }), { target: { value: "Online Arbitrage" } });
    fireEvent.click(controls.getAllByRole("button", { name: "Save changes and switch to view mode" })[0]);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][1]).toEqual({ title: "Updated document title", description: "Updated document description", category: "Online Arbitrage" });
  });
});

describe("DocumentBuilder element reordering", () => {
  it("supports dragging elements into a new saved position", async () => {
    const document = getPublishedDocuments()[0];
    const initialElements = getInitialContentElements(document);
    const onSave = vi.fn().mockResolvedValue(undefined);

    const view = render(<DocumentBuilder canEdit doc={document} activeTopicId={document.topics[0]?.id ?? ""} onTopicChange={vi.fn()} onSave={onSave} onSaveVideoUrl={vi.fn()} />);
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

    const view = render(<DocumentBuilder canEdit doc={document} activeTopicId={document.topics[0]?.id ?? ""} onTopicChange={vi.fn()} onSave={onSave} onSaveVideoUrl={vi.fn()} />);
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

    const view = render(<DocumentBuilder canEdit doc={document} activeTopicId={document.topics[0]?.id ?? ""} onTopicChange={vi.fn()} onSave={onSave} onSaveVideoUrl={vi.fn()} />);
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

    const view = render(<DocumentBuilder canEdit doc={document} activeTopicId="" onTopicChange={vi.fn()} onSave={vi.fn()} onSaveVideoUrl={vi.fn()} />);
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

    const view = render(<DocumentBuilder canEdit doc={document} activeTopicId="" onTopicChange={vi.fn()} onSave={vi.fn()} onSaveVideoUrl={vi.fn()} />);
    const firstRow = view.getByText("First row");
    const rows = firstRow.parentElement?.querySelectorAll("p");

    expect(firstRow.tagName).toBe("P");
    expect(rows).toHaveLength(3);
    expect(Array.from(rows ?? []).map(row => row.textContent)).toEqual(["First row", "Second row", "Third row"]);
  });
});

describe("DocumentBuilder roadmaps", () => {
  it("uploads step images, saves formatted subtext and alignment, then renders them in view mode", async () => {
    installSharedImageFetch("/ppc/api/library/images?pathname=glassco%2Flibrary-images%2Fshared.png");
    const baseDocument = getPublishedDocuments()[0];
    const roadmap = {
      ...createBlankContentElement("timeline", 1),
      title: "Launch roadmap",
      steps: [{ title: "Step one", text: "Complete the first step", imageUrl: "" }],
    };
    const document = { ...baseDocument, contentElements: [roadmap] };
    const onSave = vi.fn().mockResolvedValue(undefined);

    const view = render(<DocumentBuilder canEdit doc={document} activeTopicId="" onTopicChange={vi.fn()} onSave={onSave} onSaveVideoUrl={vi.fn()} />);
    const controls = within(view.container);
    fireEvent.click(controls.getAllByRole("button", { name: "Switch to edit mode" })[0]);
    fireEvent.change(controls.getByLabelText("Upload step 1 image"), { target: { files: [new File(["roadmap image"], "roadmap.png", { type: "image/png" })] } });
    fireEvent.click(controls.getByRole("button", { name: "Bullets" }));
    fireEvent.change(controls.getByRole("textbox", { name: "Step 1 subtext item 1" }), { target: { value: "First action" } });
    fireEvent.keyDown(controls.getByRole("textbox", { name: "Step 1 subtext item 1" }), { key: "Enter" });
    fireEvent.change(controls.getByRole("textbox", { name: "Step 1 subtext item 2" }), { target: { value: "Second action" } });
    fireEvent.click(controls.getByRole("button", { name: "Right" }));
    fireEvent.click(controls.getByRole("button", { name: "Center number" }));
    expect(controls.getByLabelText("Step 1 subtext composer").querySelectorAll("label")).toHaveLength(2);
    await waitFor(() => expect(controls.getByRole("button", { name: "Preview step 1 image" })).toBeInTheDocument());
    fireEvent.click(controls.getAllByRole("button", { name: "Save changes and switch to view mode" })[0]);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const savedRoadmap = onSave.mock.calls[0][0][0];
    expect(savedRoadmap.alignment).toBe("right");
    expect(savedRoadmap.numberPosition).toBe("center");
    expect(savedRoadmap.steps[0].imageUrl).toContain("/ppc/api/library/images?pathname=");
    expect(savedRoadmap.steps[0].textStyle).toBe("bullets");
    expect(view.container.querySelector('section[data-alignment="right"]')).toBeInTheDocument();
    expect(view.container.querySelector('section[data-number-position="center"]')).toBeInTheDocument();
    expect(controls.getByText("First action").closest("ul")).toBeInTheDocument();
    await waitFor(() => expect(controls.getByRole("img", { name: "Step one roadmap image" })).toHaveAttribute("src", "blob:shared-image"));
    vi.unstubAllGlobals();
  });

  it("edits checklist and numbered rows inside the composer and handles multiline paste and empty-row deletion", () => {
    const baseDocument = getPublishedDocuments()[0];
    const roadmap = { ...createBlankContentElement("timeline", 1), steps: [{ title: "Step", text: "First\nSecond", imageUrl: "" }] };
    const view = render(<DocumentBuilder canEdit doc={{ ...baseDocument, contentElements: [roadmap] }} activeTopicId="" onTopicChange={vi.fn()} onSave={vi.fn()} onSaveVideoUrl={vi.fn()} />);
    const controls = within(view.container);
    fireEvent.click(controls.getAllByRole("button", { name: "Switch to edit mode" })[0]);
    fireEvent.click(controls.getByRole("button", { name: "Checklist" }));
    expect(controls.getByLabelText("Step 1 subtext composer").querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
    fireEvent.click(controls.getByRole("button", { name: "Numbered" }));
    expect(controls.getByLabelText("Step 1 subtext composer")).toHaveAttribute("data-text-style", "numbered");
    fireEvent.paste(controls.getByRole("textbox", { name: "Step 1 subtext item 2" }), { clipboardData: { getData: () => "Second\nThird" } });
    expect(controls.getByRole("textbox", { name: "Step 1 subtext item 3" })).toHaveValue("Third");
    fireEvent.change(controls.getByRole("textbox", { name: "Step 1 subtext item 3" }), { target: { value: "" } });
    fireEvent.keyDown(controls.getByRole("textbox", { name: "Step 1 subtext item 3" }), { key: "Backspace" });
    expect(controls.queryByRole("textbox", { name: "Step 1 subtext item 3" })).not.toBeInTheDocument();
  });
});

describe("DocumentBuilder image galleries", () => {
  it("saves the selected grid layout and repeatable images, then renders the gallery", async () => {
    installSharedImageFetch("/ppc/api/library/images?pathname=glassco%2Flibrary-images%2Fgallery.png");
    const baseDocument = getPublishedDocuments()[0];
    const gallery = createBlankContentElement("gallery", 1);
    const document = { ...baseDocument, contentElements: [gallery] };
    const onSave = vi.fn().mockResolvedValue(undefined);

    const view = render(<DocumentBuilder canEdit doc={document} activeTopicId="" onTopicChange={vi.fn()} onSave={onSave} onSaveVideoUrl={vi.fn()} />);
    const controls = within(view.container);
    fireEvent.click(controls.getAllByRole("button", { name: "Switch to edit mode" })[0]);
    fireEvent.change(controls.getByRole("textbox", { name: "Gallery image 1 description" }), { target: { value: "First gallery image" } });
    fireEvent.click(controls.getByRole("button", { name: "3 Grid" }));
    expect(controls.getByRole("textbox", { name: "Gallery image 3 description" })).toBeInTheDocument();
    expect(view.container.querySelector('[data-gallery-columns="3"]')).toBeInTheDocument();
    fireEvent.click(controls.getByRole("button", { name: "Remove gallery image 3" }));
    expect(controls.getByRole("textbox", { name: "Gallery image 3 description" })).toBeInTheDocument();
    fireEvent.change(controls.getByLabelText("Upload gallery image 1"), { target: { files: [new File(["gallery"], "gallery.png", { type: "image/png" })] } });
    await waitFor(() => expect(controls.getByRole("button", { name: "Preview gallery image 1" })).toBeInTheDocument());
    fireEvent.click(controls.getAllByRole("button", { name: "Save changes and switch to view mode" })[0]);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const savedGallery = onSave.mock.calls[0][0][0];
    expect(savedGallery.galleryColumns).toBe(3);
    expect(savedGallery.images).toHaveLength(3);
    expect(savedGallery.images[0]).toEqual({ url: expect.stringContaining("/ppc/api/library/images"), alt: "First gallery image" });
    expect(view.container.querySelector('section[data-gallery-columns="3"]')).toBeInTheDocument();
    await waitFor(() => expect(controls.getByRole("img", { name: "First gallery image" })).toHaveAttribute("src", "blob:shared-image"));
    vi.unstubAllGlobals();
  });
});

describe("DocumentBuilder video header", () => {
  it("renders a Google Drive player inside the blue header without a separate open-video button", () => {
    const baseDocument = getPublishedDocuments()[0];
    const document = { ...baseDocument, videoUrl: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing" };
    const view = render(<DocumentBuilder doc={document} activeTopicId="" onTopicChange={vi.fn()} onSave={vi.fn()} onSaveVideoUrl={vi.fn()} />);
    const header = view.container.querySelector("header.reader-header");
    const player = header?.querySelector("iframe");

    expect(header).toBeInTheDocument();
    expect(player).toHaveAttribute("src", "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/preview");
    expect(view.container.querySelector("article > section[aria-label='Video tutorial']")).not.toBeInTheDocument();
    expect(within(view.container).queryByText("OPEN VIDEO")).not.toBeInTheDocument();
  });
});

describe("DocumentBuilder shared feature images and buttons", () => {
  it("uploads a Feature Card image to shared storage and saves the returned URL", async () => {
    const fetchMock = installSharedImageFetch("/ppc/api/library/images?pathname=glassco%2Flibrary-images%2Ffeature.png");
    const baseDocument = getPublishedDocuments()[0];
    const onSave = vi.fn();
    const view = render(<DocumentBuilder canEdit doc={{ ...baseDocument, contentElements: [createBlankContentElement("feature", 1)] }} activeTopicId="" onTopicChange={vi.fn()} onSave={onSave} onSaveVideoUrl={vi.fn()} />);
    const controls = within(view.container);
    fireEvent.click(controls.getAllByRole("button", { name: "Switch to edit mode" })[0]);
    fireEvent.change(controls.getByLabelText("Upload feature card image"), { target: { files: [new File(["feature"], "feature.png", { type: "image/png" })] } });
    await waitFor(() => expect(controls.getByRole("button", { name: "Preview feature card image" })).toBeInTheDocument());
    await waitFor(() => expect(controls.getByRole("img", { name: "feature card image preview" })).toHaveAttribute("src", "blob:shared-image"));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/library/images?"), expect.objectContaining({ headers: { Authorization: "Bearer test-token" } }));
    fireEvent.click(controls.getAllByRole("button", { name: "Save changes and switch to view mode" })[0]);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0][0].imageUrl).toContain("/ppc/api/library/images");
    fireEvent.click(controls.getAllByRole("button", { name: "Switch to edit mode" })[0]);
    fireEvent.click(controls.getByRole("button", { name: "Remove image" }));
    expect(controls.queryByRole("button", { name: "Preview feature card image" })).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("rejects an oversized shared image before making a request", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const baseDocument = getPublishedDocuments()[0];
    const view = render(<DocumentBuilder canEdit doc={{ ...baseDocument, contentElements: [createBlankContentElement("feature", 1)] }} activeTopicId="" onTopicChange={vi.fn()} onSave={vi.fn()} onSaveVideoUrl={vi.fn()} />);
    const controls = within(view.container);
    fireEvent.click(controls.getAllByRole("button", { name: "Switch to edit mode" })[0]);
    const file = new File(["x"], "large.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: 2 * 1024 * 1024 + 1 });
    fireEvent.change(controls.getByLabelText("Upload feature card image"), { target: { files: [file] } });
    expect(controls.getByRole("alert")).toHaveTextContent("2 MB or smaller");
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("saves a valid standalone Button with width, alignment, and secure new-tab behavior", async () => {
    const baseDocument = getPublishedDocuments()[0];
    const onSave = vi.fn();
    const view = render(<DocumentBuilder canEdit doc={{ ...baseDocument, contentElements: [createBlankContentElement("button", 1)] }} activeTopicId="" onTopicChange={vi.fn()} onSave={onSave} onSaveVideoUrl={vi.fn()} />);
    const controls = within(view.container);
    fireEvent.click(controls.getAllByRole("button", { name: "Switch to edit mode" })[0]);
    fireEvent.change(controls.getByRole("textbox", { name: "Button text" }), { target: { value: "Open guide" } });
    fireEvent.change(controls.getByRole("textbox", { name: "Link" }), { target: { value: "https://example.com/guide" } });
    fireEvent.click(controls.getByRole("button", { name: "Large" }));
    fireEvent.click(controls.getByRole("button", { name: "Right" }));
    fireEvent.click(controls.getAllByRole("button", { name: "Save changes and switch to view mode" })[0]);
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const saved = onSave.mock.calls[0][0][0];
    expect(saved).toMatchObject({ type: "button", buttonText: "Open guide", buttonUrl: "https://example.com/guide", buttonWidth: "large", buttonAlignment: "right" });
    expect(controls.getByRole("link", { name: "Open guide" })).toHaveAttribute("target", "_blank");
    expect(controls.getByRole("link", { name: "Open guide" })).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows inline feedback for an unsafe Button link", () => {
    const baseDocument = getPublishedDocuments()[0];
    const view = render(<DocumentBuilder canEdit doc={{ ...baseDocument, contentElements: [createBlankContentElement("button", 1)] }} activeTopicId="" onTopicChange={vi.fn()} onSave={vi.fn()} onSaveVideoUrl={vi.fn()} />);
    const controls = within(view.container);
    fireEvent.click(controls.getAllByRole("button", { name: "Switch to edit mode" })[0]);
    fireEvent.change(controls.getByRole("textbox", { name: "Link" }), { target: { value: "javascript:alert(1)" } });
    expect(controls.getByRole("alert")).toHaveTextContent("HTTP, HTTPS, or internal / link");
  });
});
