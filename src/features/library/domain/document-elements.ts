import { slugifyHeading } from "./headings";
import type { LibraryContentElement, LibraryContentElementType, LibraryDocument, Topic } from "./types";

const emptyElement = (type: LibraryContentElementType, id: string): LibraryContentElement => ({
  id,
  type,
  eyebrow: "Part 1",
  label: "",
  title: "",
  text: "",
  body: [""],
  callout: "",
  items: [""],
  columns: ["Column 1", "Column 2"],
  rows: [["", ""]],
  buttonText: "",
  imageUrl: "",
  steps: [{ title: "", text: "", imageUrl: "" }],
  alignment: type === "timeline" ? "left" : undefined,
  nodes: [{ title: "", text: "" }],
  dropdowns: type === "accordion" ? [{ title: "", text: "" }] : undefined,
  galleryColumns: type === "gallery" ? 1 : undefined,
  images: type === "gallery" ? [{ url: "", alt: "" }] : undefined,
});

export function createBlankContentElement(type: LibraryContentElementType, partNumber: number) {
  const element = emptyElement(type, `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  if (type === "topic") return { ...element, eyebrow: `Part ${partNumber}`, label: `Topic ${partNumber}` };
  if (type === "table") return { ...element, columns: ["", ""], rows: [["", ""]] };
  if (type === "accordion") return { ...element, dropdowns: [{ title: "", text: "" }] };
  if (type === "timeline") return { ...element, alignment: "left" as const, steps: [{ title: "", text: "", imageUrl: "" }, { title: "", text: "", imageUrl: "" }] };
  if (type === "gallery") return { ...element, galleryColumns: 1 as const, images: [{ url: "", alt: "" }] };
  if (type === "flowchart") return { ...element, nodes: [{ title: "", text: "" }, { title: "", text: "" }] };
  return element;
}

function cleanMarkdown(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+|>\s*|#{1,6}\s+)/gm, "")
    .replace(/^\s*\[[ xX]\]\s*/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/gm, "")
    .trim();
}

function topicElement(id: string, title: string, body: string, partNumber: number): LibraryContentElement {
  return {
    ...emptyElement("topic", id),
    eyebrow: `Part ${partNumber}`,
    label: title,
    title,
    body: body.split(/\n\s*\n/).map(cleanMarkdown).filter(Boolean),
  };
}

export function getInitialContentElements(document: LibraryDocument): LibraryContentElement[] {
  if (document.contentElements?.length) return document.contentElements.map(element => ({
    ...element,
    body: [...element.body],
    items: [...element.items],
    columns: [...element.columns],
    rows: element.rows.map(row => [...row]),
    columnWidths: element.columnWidths ? [...element.columnWidths] : undefined,
    steps: element.steps.map(step => ({ ...step })),
    nodes: element.nodes.map(node => ({ ...node })),
    dropdowns: element.dropdowns?.map(dropdown => ({ ...dropdown })),
    images: element.images?.map(image => ({ ...image })),
  }));

  const headings = [...document.body.matchAll(/^##\s+(.+)$/gm)];
  if (!headings.length) {
    return [topicElement("introduction", document.title, document.body, 1)];
  }

  return headings.map((match, index) => {
    const title = cleanMarkdown(match[1]);
    const start = (match.index ?? 0) + match[0].length;
    const end = headings[index + 1]?.index ?? document.body.length;
    const matchingTopic = document.topics.find(topic => topic.level === 2 && topic.title === title);
    const id = matchingTopic?.id ?? (slugifyHeading(title) || `topic-${index + 1}`);
    return topicElement(id, title, document.body.slice(start, end), index + 1);
  });
}

export function getTopicsFromContentElements(elements: LibraryContentElement[]): Topic[] {
  return elements.filter(element => element.type === "topic").map((element, index) => ({
    id: element.id,
    title: element.label || element.title || `Topic ${index + 1}`,
    level: 2,
  }));
}
