"use client";

import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Link2, List, ListChecks, ListOrdered, Pilcrow, UnderlineIcon } from "lucide-react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { BubbleMenu, type BubbleMenuProps } from "@tiptap/react/menus";
import { renderJSONContentToReactElement } from "@tiptap/static-renderer/json/react";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { isRichTextDocument, normalizeRichTextHref, richTextToPlainText } from "../domain/rich-text";
import type { RichTextDocument, RichTextMark, RichTextNode, TextAlignment } from "../domain/types";
import styles from "./rich-text.module.css";

const baseOptions = {
  blockquote: false,
  code: false,
  codeBlock: false,
  heading: false,
  horizontalRule: false,
  link: false,
  strike: false,
  underline: false,
  trailingNode: false,
} as const;

const fullExtensions = [
  StarterKit.configure(baseOptions),
  Underline,
  Link.configure({
    autolink: false,
    defaultProtocol: "https",
    enableClickSelection: false,
    HTMLAttributes: { target: "_blank", rel: "noopener noreferrer", class: null },
    isAllowedUri: url => normalizeRichTextHref(url) !== null,
    linkOnPaste: true,
    openOnClick: false,
  }),
  TextAlign.configure({ types: ["paragraph"], alignments: ["left", "center", "right"], defaultAlignment: null }),
  TaskList,
  TaskItem.configure({ nested: false, a11y: { checkboxLabel: node => `Task item: ${node.textContent || "empty item"}` } }),
];

const inlineExtensions = [
  StarterKit.configure({ ...baseOptions, bulletList: false, orderedList: false, listItem: false, listKeymap: false }),
  Underline,
  Link.configure({
    autolink: false,
    defaultProtocol: "https",
    enableClickSelection: false,
    HTMLAttributes: { target: "_blank", rel: "noopener noreferrer", class: null },
    isAllowedUri: url => normalizeRichTextHref(url) !== null,
    linkOnPaste: true,
    openOnClick: false,
  }),
  TextAlign.configure({ types: ["paragraph"], alignments: ["left", "center", "right"], defaultAlignment: null }),
];

function normalizeEditorRichText(value: unknown): RichTextDocument | null {
  const normalizeNode = (node: unknown): unknown => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return node;
    const normalized = { ...(node as Record<string, unknown>) };
    if (normalized.type === "orderedList" && normalized.attrs && typeof normalized.attrs === "object" && !Array.isArray(normalized.attrs)) {
      const start = (normalized.attrs as Record<string, unknown>).start;
      normalized.attrs = start === undefined ? {} : { start };
    }
    if (normalized.type === "paragraph" && normalized.attrs && typeof normalized.attrs === "object" && !Array.isArray(normalized.attrs)) {
      const textAlign = (normalized.attrs as Record<string, unknown>).textAlign;
      if (["left", "center", "right"].includes(String(textAlign))) normalized.attrs = { textAlign };
      else delete normalized.attrs;
    }
    if (Array.isArray(normalized.marks)) {
      const normalizedMarks = normalized.marks.flatMap(mark => {
        if (!mark || typeof mark !== "object" || Array.isArray(mark)) return [];
        const type = String((mark as Record<string, unknown>).type ?? "");
        if (["bold", "italic", "underline"].includes(type)) return [{ type }];
        if (type !== "link") return [];
        const attrs = (mark as Record<string, unknown>).attrs;
        const href = attrs && typeof attrs === "object" && !Array.isArray(attrs)
          ? normalizeRichTextHref(String((attrs as Record<string, unknown>).href ?? ""))
          : null;
        return href ? [{ type: "link", attrs: { href } }] : [];
      });
      if (normalizedMarks.length) normalized.marks = normalizedMarks;
      else delete normalized.marks;
    }
    if (Array.isArray(normalized.content)) normalized.content = normalized.content.map(normalizeNode);
    return normalized;
  };
  const normalized = normalizeNode(value);
  return isRichTextDocument(normalized) ? normalized : null;
}

const renderRichText = renderJSONContentToReactElement<RichTextMark, RichTextNode>({
  nodeMapping: {
    doc: ({ children }) => <>{children}</>,
    paragraph: ({ node, children }) => <p style={node.attrs?.textAlign ? { textAlign: node.attrs.textAlign } : undefined}>{children}</p>,
    text: ({ node }) => node.text ?? "",
    hardBreak: () => <br />,
    bulletList: ({ children }) => <ul>{children}</ul>,
    orderedList: ({ node, children }) => <ol start={typeof node.attrs?.start === "number" ? node.attrs.start : undefined}>{children}</ol>,
    listItem: ({ children }) => <li>{children}</li>,
    taskList: ({ children }) => <ul data-type="taskList">{children}</ul>,
    taskItem: ({ node, children }) => <li data-type="taskItem" data-checked={Boolean(node.attrs?.checked)}>
      <label><input type="checkbox" checked={Boolean(node.attrs?.checked)} disabled readOnly aria-label="Checklist item" /><span /></label>
      <div>{children}</div>
    </li>,
  },
  markMapping: {
    bold: ({ children }) => <strong>{children}</strong>,
    italic: ({ children }) => <em>{children}</em>,
    underline: ({ children }) => <u>{children}</u>,
    link: ({ mark, children }) => {
      const href = mark.type === "link" ? normalizeRichTextHref(mark.attrs.href) : null;
      return href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <>{children}</>;
    },
  },
});

export function RichTextRenderer({ value, className = "" }: { value: RichTextDocument; className?: string }) {
  return <div className={`${styles.content} ${className}`.trim()}>{renderRichText({ content: value })}</div>;
}

type RichTextEditorProps = {
  value: RichTextDocument;
  onChange: (value: RichTextDocument, plainText: string) => void;
  ariaLabel: string;
  placeholder?: string;
  allowLists?: boolean;
  className?: string;
  defaultTextAlignment?: TextAlignment;
  onTextAlignmentChange?: (alignment: TextAlignment) => void;
};

type ToolbarSurface = "main" | "selection";
type LinkEditorState = { surface: ToolbarSurface; href: string; error: string; canRemove: boolean };
type SelectionRange = { from: number; to: number };

function LinkEditorPopover({
  value,
  error,
  canRemove,
  onChange,
  onApply,
  onRemove,
  onCancel,
}: {
  value: string;
  error: string;
  canRemove: boolean;
  onChange: (value: string) => void;
  onApply: () => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const errorId = useId();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onApply();
  };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };
  return <form className={styles.linkPopover} aria-label="Edit link" onSubmit={submit} onMouseDown={event => event.stopPropagation()}>
    <label>
      <span>Link URL</span>
      <input autoFocus type="text" inputMode="url" value={value} onChange={event => onChange(event.target.value)} onKeyDown={keyDown} placeholder="https://example.com" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />
    </label>
    {error ? <p id={errorId} role="alert">{error}</p> : null}
    <div>
      <button type="button" onClick={onCancel}>Cancel</button>
      {canRemove ? <button className={styles.removeLinkButton} type="button" onClick={onRemove}>Remove link</button> : null}
      <button className={styles.applyLinkButton} type="submit">Apply</button>
    </div>
  </form>;
}

export function shouldShowSelectionToolbar({ isEditable, from, to }: { isEditable: boolean; from: number; to: number }) {
  return isEditable && from !== to;
}

const bubbleMenuShouldShow: NonNullable<BubbleMenuProps["shouldShow"]> = ({ editor, from, to }) => shouldShowSelectionToolbar({ isEditable: editor.isEditable, from, to });
const bubbleMenuOptions = { strategy: "fixed", placement: "top", offset: 8, flip: true, shift: true } as const;
const appendBubbleMenuToBody = () => document.body;

export function RichTextEditor({
  value,
  onChange,
  ariaLabel,
  placeholder = "Start typing…",
  allowLists = true,
  className = "",
  defaultTextAlignment = "left",
  onTextAlignmentChange,
}: RichTextEditorProps) {
  const onChangeRef = useRef(onChange);
  const [selectedRange, setSelectedRange] = useState<SelectionRange | null>(null);
  const [linkEditor, setLinkEditor] = useState<LinkEditorState | null>(null);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  const editor = useEditor({
    extensions: allowLists ? fullExtensions : inlineExtensions,
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        role: "textbox",
        "data-placeholder": placeholder,
        class: styles.editable,
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const next = normalizeEditorRichText(currentEditor.getJSON());
      if (next) onChangeRef.current(next, richTextToPlainText(next));
    },
  }, [allowLists]);

  useEffect(() => {
    if (!editor) return;
    const current = normalizeEditorRichText(editor.getJSON());
    if (JSON.stringify(current) !== JSON.stringify(value)) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  const active = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => currentEditor ? {
      bold: currentEditor.isActive("bold"),
      italic: currentEditor.isActive("italic"),
      underline: currentEditor.isActive("underline"),
      bulletList: currentEditor.isActive("bulletList"),
      orderedList: currentEditor.isActive("orderedList"),
      taskList: currentEditor.isActive("taskList"),
      link: currentEditor.isActive("link"),
      selectionEmpty: currentEditor.state.selection.empty,
      textAlignment: currentEditor.isActive({ textAlign: "center" })
        ? "center"
        : currentEditor.isActive({ textAlign: "right" })
          ? "right"
          : currentEditor.isActive({ textAlign: "left" })
            ? "left"
            : null,
    } : null,
  });

  const run = (action: () => void) => {
    if (!editor) return;
    action();
  };
  const toolbarButton = (label: string, pressed: boolean, icon: ReactNode, action: () => void, disabled = false) => (
    <button type="button" aria-label={label} title={label} aria-pressed={pressed} disabled={!editor || disabled} onMouseDown={event => event.preventDefault()} onClick={() => run(action)}>
      {icon}
    </button>
  );
  const setAlignment = (alignment: TextAlignment) => {
    editor?.chain().focus(undefined, { scrollIntoView: false }).setTextAlign(alignment).run();
    onTextAlignmentChange?.(alignment);
  };
  const restoreSelection = () => {
    if (!editor || !selectedRange) return;
    editor.chain().focus(undefined, { scrollIntoView: false }).setTextSelection(selectedRange).run();
  };
  const closeLinkEditor = (restore = true) => {
    if (restore) restoreSelection();
    setSelectedRange(null);
    setLinkEditor(null);
  };
  const openLinkEditor = (surface: ToolbarSurface) => {
    if (!editor) return;
    if (editor.state.selection.empty && editor.isActive("link")) {
      editor.chain().focus(undefined, { scrollIntoView: false }).extendMarkRange("link").run();
    }
    const { from, to } = editor.state.selection;
    if (from === to) return;
    setSelectedRange({ from, to });
    const href = normalizeRichTextHref(String(editor.getAttributes("link").href ?? "")) ?? "";
    setLinkEditor({ surface, href, error: "", canRemove: editor.isActive("link") });
  };
  const applyLink = () => {
    if (!editor || !linkEditor || !selectedRange) return;
    const href = normalizeRichTextHref(linkEditor.href);
    if (!href) {
      setLinkEditor(current => current ? { ...current, error: "Enter a valid HTTP, HTTPS, email, or Library link." } : current);
      return;
    }
    editor.chain().focus(undefined, { scrollIntoView: false }).setTextSelection(selectedRange).setLink({ href }).run();
    closeLinkEditor(false);
  };
  const removeLink = () => {
    if (!editor || !selectedRange) return;
    editor.chain().focus(undefined, { scrollIntoView: false }).setTextSelection(selectedRange).unsetLink().run();
    closeLinkEditor(false);
  };
  const linkPopover = (surface: ToolbarSurface) => linkEditor?.surface === surface ? <LinkEditorPopover
      value={linkEditor.href}
      error={linkEditor.error}
      canRemove={linkEditor.canRemove}
      onChange={href => setLinkEditor(current => current ? { ...current, href, error: "" } : current)}
      onApply={applyLink}
      onRemove={removeLink}
      onCancel={() => closeLinkEditor()}
    /> : null;
  const linkControl = (surface: ToolbarSurface) => <div className={styles.linkControl}>
    {toolbarButton("Link", Boolean(active?.link), <Link2 aria-hidden="true" />, () => openLinkEditor(surface), Boolean(active?.selectionEmpty && !active?.link))}
    {surface === "selection" ? linkPopover(surface) : null}
  </div>;
  const formattingButtons = (surface: ToolbarSurface) => <>
    <div className={styles.toolbarGroup} role="group" aria-label="Text styles">
      {toolbarButton("Normal", !(active?.bold || active?.italic || active?.underline), <Pilcrow aria-hidden="true" />, () => editor?.chain().focus(undefined, { scrollIntoView: false }).unsetBold().unsetItalic().unsetUnderline().run())}
      {toolbarButton("Bold", Boolean(active?.bold), <Bold aria-hidden="true" />, () => editor?.chain().focus(undefined, { scrollIntoView: false }).toggleBold().run())}
      {toolbarButton("Italic", Boolean(active?.italic), <Italic aria-hidden="true" />, () => editor?.chain().focus(undefined, { scrollIntoView: false }).toggleItalic().run())}
      {toolbarButton("Underlined", Boolean(active?.underline), <UnderlineIcon aria-hidden="true" />, () => editor?.chain().focus(undefined, { scrollIntoView: false }).toggleUnderline().run())}
    </div>
    <span className={styles.toolbarSeparator} aria-hidden="true" />
    <div className={styles.toolbarGroup} role="group" aria-label="Text alignment">
      {toolbarButton("Align left", (active?.textAlignment ?? defaultTextAlignment) === "left", <AlignLeft aria-hidden="true" />, () => setAlignment("left"))}
      {toolbarButton("Align center", (active?.textAlignment ?? defaultTextAlignment) === "center", <AlignCenter aria-hidden="true" />, () => setAlignment("center"))}
      {toolbarButton("Align right", (active?.textAlignment ?? defaultTextAlignment) === "right", <AlignRight aria-hidden="true" />, () => setAlignment("right"))}
    </div>
    {allowLists ? <>
      <span className={styles.toolbarSeparator} aria-hidden="true" />
      <div className={styles.toolbarGroup} role="group" aria-label="Lists">
        {toolbarButton("Bullets", Boolean(active?.bulletList), <List aria-hidden="true" />, () => editor?.chain().focus(undefined, { scrollIntoView: false }).toggleBulletList().run())}
        {toolbarButton("Checklist", Boolean(active?.taskList), <ListChecks aria-hidden="true" />, () => editor?.chain().focus(undefined, { scrollIntoView: false }).toggleTaskList().run())}
        {toolbarButton("Numbers", Boolean(active?.orderedList), <ListOrdered aria-hidden="true" />, () => editor?.chain().focus(undefined, { scrollIntoView: false }).toggleOrderedList().run())}
      </div>
    </> : null}
    <span className={styles.toolbarSeparator} aria-hidden="true" />
    <div className={styles.toolbarGroup} role="group" aria-label="Links">{linkControl(surface)}</div>
  </>;

  return <section className={`${styles.composer} ${className}`.trim()}>
    <div className={styles.toolbar} role="toolbar" aria-label={`${ariaLabel} formatting`}>
      {formattingButtons("main")}
    </div>
    {linkEditor?.surface === "main" ? <div className={styles.mainLinkPopover}>{linkPopover("main")}</div> : null}
    {editor ? <BubbleMenu editor={editor} appendTo={appendBubbleMenuToBody} shouldShow={bubbleMenuShouldShow} options={bubbleMenuOptions} className={styles.bubbleToolbar} role="toolbar" aria-label={`${ariaLabel} selection formatting`}>
      {formattingButtons("selection")}
    </BubbleMenu> : null}
    <EditorContent editor={editor} />
  </section>;
}
