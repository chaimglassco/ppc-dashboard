import type { RichTextDocument, RichTextMark, RichTextNode, RoadmapTextStyle } from "./types";

const allowedNodeTypes = new Set(["doc", "paragraph", "text", "hardBreak", "bulletList", "orderedList", "listItem", "taskList", "taskItem"]);
const allowedMarkTypes = new Set(["bold", "italic", "underline"]);

export const EMPTY_RICH_TEXT: RichTextDocument = { type: "doc", content: [{ type: "paragraph" }] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isRichTextMark(value: unknown): value is RichTextMark {
  return isRecord(value) && typeof value.type === "string" && allowedMarkTypes.has(value.type) && Object.keys(value).every(key => key === "type");
}

function isRichTextNode(value: unknown, isRoot = false): value is RichTextNode {
  if (!isRecord(value) || typeof value.type !== "string" || !allowedNodeTypes.has(value.type)) return false;
  if (Object.keys(value).some(key => !["type", "text", "attrs", "marks", "content"].includes(key))) return false;
  if (isRoot ? value.type !== "doc" : value.type === "doc") return false;
  if (value.type === "text" && typeof value.text !== "string") return false;
  if (value.type !== "text" && value.text !== undefined) return false;
  if (value.type !== "text" && value.marks !== undefined) return false;
  if (value.type === "text" && value.content !== undefined) return false;
  if (value.text !== undefined && (value.type !== "text" || typeof value.text !== "string")) return false;
  if (value.marks !== undefined && (!Array.isArray(value.marks) || !value.marks.every(isRichTextMark))) return false;
  if (value.content !== undefined && (!Array.isArray(value.content) || !value.content.every(child => isRichTextNode(child)))) return false;
  if (value.attrs !== undefined) {
    if (!isRecord(value.attrs)) return false;
    if (value.type === "taskItem") {
      if (typeof value.attrs.checked !== "boolean" || Object.keys(value.attrs).some(key => key !== "checked")) return false;
    } else if (value.type === "orderedList") {
      if (value.attrs.start !== undefined && (!Number.isInteger(value.attrs.start) || Number(value.attrs.start) < 1)) return false;
      if (Object.keys(value.attrs).some(key => key !== "start")) return false;
    } else if (Object.keys(value.attrs).length) return false;
  }
  const children = Array.isArray(value.content) ? value.content : [];
  if (value.type === "doc" && children.some(child => !["paragraph", "bulletList", "orderedList", "taskList"].includes(child.type))) return false;
  if (value.type === "paragraph" && children.some(child => !["text", "hardBreak"].includes(child.type))) return false;
  if (["text", "hardBreak"].includes(value.type) && children.length) return false;
  if (["bulletList", "orderedList"].includes(value.type) && (!children.length || children.some(child => child.type !== "listItem"))) return false;
  if (value.type === "taskList" && (!children.length || children.some(child => child.type !== "taskItem"))) return false;
  if (["listItem", "taskItem"].includes(value.type) && (!children.length || children.some(child => child.type !== "paragraph"))) return false;
  if (value.type === "taskItem" && typeof value.attrs?.checked !== "boolean") return false;
  return true;
}

export function isRichTextDocument(value: unknown): value is RichTextDocument {
  return isRichTextNode(value, true) && Array.isArray(value.content);
}

function textNode(text: string, marks: RichTextMark[] = []): RichTextNode {
  return marks.length ? { type: "text", text, marks } : { type: "text", text };
}

function parseInlineMarkdown(value: string): RichTextNode[] {
  const nodes: RichTextNode[] = [];
  const pattern = /(\*\*|__)(.+?)\1|(?<!\*)\*([^*\n]+?)\*|(?<!_)_([^_\n]+?)_|<u>(.*?)<\/u>|\[([^\]]+)\]\([^)]*\)|`([^`]+)`/gi;
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(textNode(value.slice(cursor, index)));
    if (match[2] !== undefined) nodes.push(textNode(match[2], [{ type: "bold" }]));
    else if (match[3] !== undefined || match[4] !== undefined) nodes.push(textNode(match[3] ?? match[4], [{ type: "italic" }]));
    else if (match[5] !== undefined) nodes.push(textNode(match[5], [{ type: "underline" }]));
    else nodes.push(textNode(match[6] ?? match[7] ?? ""));
    cursor = index + match[0].length;
  }
  if (cursor < value.length) nodes.push(textNode(value.slice(cursor)));
  return nodes.filter(node => node.text !== "");
}

function paragraph(value = ""): RichTextNode {
  const content = parseInlineMarkdown(value.trim());
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

function listItem(value: string, task = false, checked = false): RichTextNode {
  return task
    ? { type: "taskItem", attrs: { checked }, content: [paragraph(value)] }
    : { type: "listItem", content: [paragraph(value)] };
}

export function richTextFromMarkdown(value: string): RichTextDocument {
  const source = value.replace(/\r\n?/g, "\n").trim();
  if (!source) return structuredClone(EMPTY_RICH_TEXT);
  const content: RichTextNode[] = [];
  const lines = source.split("\n");
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    const task = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/);
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    const ordered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (task) {
      const items: RichTextNode[] = [];
      while (index < lines.length) {
        const current = lines[index].match(/^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/);
        if (!current) break;
        items.push(listItem(current[2], true, current[1].toLowerCase() === "x"));
        index += 1;
      }
      content.push({ type: "taskList", content: items });
    } else if (bullet) {
      const items: RichTextNode[] = [];
      while (index < lines.length) {
        const current = lines[index].match(/^\s*[-*+]\s+(?!\[[ xX]\]\s)(.*)$/);
        if (!current) break;
        items.push(listItem(current[1]));
        index += 1;
      }
      content.push({ type: "bulletList", content: items });
    } else if (ordered) {
      const start = Number(ordered[1]);
      const items: RichTextNode[] = [];
      while (index < lines.length) {
        const current = lines[index].match(/^\s*\d+[.)]\s+(.*)$/);
        if (!current) break;
        items.push(listItem(current[1]));
        index += 1;
      }
      content.push({ type: "orderedList", attrs: { start }, content: items });
    } else if (!line.trim()) {
      index += 1;
    } else {
      const paragraphLines = [line.replace(/^\s*(?:>\s*|#{1,6}\s+)/, "")];
      index += 1;
      while (index < lines.length && lines[index].trim() && !/^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(lines[index])) {
        paragraphLines.push(lines[index]);
        index += 1;
      }
      content.push(paragraph(paragraphLines.join(" ")));
    }
  }
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

export function richTextFromPlainText(value: string, style: RoadmapTextStyle = "plain"): RichTextDocument {
  if (style === "plain") {
    const lines = value.replace(/\r\n?/g, "\n").split("\n");
    const content = lines.filter((line, index) => line.trim() || (index > 0 && index < lines.length - 1)).map(line => paragraph(line));
    return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
  }
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const items = lines.map(line => listItem(line, style === "checklist"));
  const type = style === "bullets" ? "bulletList" : style === "numbered" ? "orderedList" : "taskList";
  return { type: "doc", content: items.length ? [{ type, ...(type === "orderedList" ? { attrs: { start: 1 } } : {}), content: items }] : [{ type: "paragraph" }] };
}

function collectText(node: RichTextNode, blocks: string[]): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  const text = (node.content ?? []).map(child => collectText(child, blocks)).join("");
  if (node.type === "paragraph") blocks.push(text);
  return text;
}

export function richTextToPlainText(document: RichTextDocument): string {
  const blocks: string[] = [];
  for (const node of document.content ?? []) collectText(node, blocks);
  return blocks.join("\n").trim();
}

export function richTextToParagraphs(document: RichTextDocument): string[] {
  const plain = richTextToPlainText(document);
  return plain ? plain.split(/\n+/).map(item => item.trim()).filter(Boolean) : [""];
}

export function richTextToRoadmapStyle(document: RichTextDocument): RoadmapTextStyle {
  if (document.content?.length !== 1) return "plain";
  if (document.content[0].type === "bulletList") return "bullets";
  if (document.content[0].type === "orderedList") return "numbered";
  if (document.content[0].type === "taskList") return "checklist";
  return "plain";
}

export function resolveRichText(value: unknown, fallback: string, style: RoadmapTextStyle = "plain") {
  return isRichTextDocument(value) ? value : richTextFromPlainText(fallback, style);
}
