"use client";

import { Bold, Italic, List, ListChecks, ListOrdered, Pilcrow, UnderlineIcon } from "lucide-react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { BubbleMenu, type BubbleMenuProps } from "@tiptap/react/menus";
import { renderJSONContentToReactElement } from "@tiptap/static-renderer/json/react";
import { useEffect, useRef, type ReactNode } from "react";
import { isRichTextDocument, richTextToPlainText } from "../domain/rich-text";
import type { RichTextDocument, RichTextMark, RichTextNode } from "../domain/types";
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
  TaskList,
  TaskItem.configure({ nested: false, a11y: { checkboxLabel: node => `Task item: ${node.textContent || "empty item"}` } }),
];

const inlineExtensions = [
  StarterKit.configure({ ...baseOptions, bulletList: false, orderedList: false, listItem: false, listKeymap: false }),
  Underline,
];

function normalizeEditorRichText(value: unknown): RichTextDocument | null {
  const normalizeNode = (node: unknown): unknown => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return node;
    const normalized = { ...(node as Record<string, unknown>) };
    if (normalized.type === "orderedList" && normalized.attrs && typeof normalized.attrs === "object" && !Array.isArray(normalized.attrs)) {
      const start = (normalized.attrs as Record<string, unknown>).start;
      normalized.attrs = start === undefined ? {} : { start };
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
    paragraph: ({ children }) => <p>{children}</p>,
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
};

export function shouldShowSelectionToolbar({ isEditable, from, to }: { isEditable: boolean; from: number; to: number }) {
  return isEditable && from !== to;
}

const bubbleMenuShouldShow: NonNullable<BubbleMenuProps["shouldShow"]> = ({ editor, from, to }) => shouldShowSelectionToolbar({ isEditable: editor.isEditable, from, to });
const bubbleMenuOptions = { strategy: "fixed", placement: "top", offset: 8, flip: true, shift: true } as const;
const appendBubbleMenuToBody = () => document.body;

export function RichTextEditor({ value, onChange, ariaLabel, placeholder = "Start typing…", allowLists = true, className = "" }: RichTextEditorProps) {
  const onChangeRef = useRef(onChange);
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
    } : null,
  });

  const run = (action: () => void) => {
    if (!editor) return;
    action();
  };
  const toolbarButton = (label: string, pressed: boolean, icon: ReactNode, action: () => void) => (
    <button type="button" aria-label={label} title={label} aria-pressed={pressed} disabled={!editor} onMouseDown={event => event.preventDefault()} onClick={() => run(action)}>
      {icon}<span>{label}</span>
    </button>
  );
  const formattingButtons = () => <>
    {toolbarButton("Normal", !(active?.bold || active?.italic || active?.underline), <Pilcrow aria-hidden="true" />, () => editor?.chain().focus(undefined, { scrollIntoView: false }).unsetAllMarks().unsetBold().unsetItalic().unsetUnderline().run())}
    {toolbarButton("Bold", Boolean(active?.bold), <Bold aria-hidden="true" />, () => editor?.chain().focus(undefined, { scrollIntoView: false }).toggleBold().run())}
    {toolbarButton("Italic", Boolean(active?.italic), <Italic aria-hidden="true" />, () => editor?.chain().focus(undefined, { scrollIntoView: false }).toggleItalic().run())}
    {toolbarButton("Underlined", Boolean(active?.underline), <UnderlineIcon aria-hidden="true" />, () => editor?.chain().focus(undefined, { scrollIntoView: false }).toggleUnderline().run())}
    {allowLists ? <>
      {toolbarButton("Bullets", Boolean(active?.bulletList), <List aria-hidden="true" />, () => editor?.chain().focus(undefined, { scrollIntoView: false }).toggleBulletList().run())}
      {toolbarButton("Checklist", Boolean(active?.taskList), <ListChecks aria-hidden="true" />, () => editor?.chain().focus(undefined, { scrollIntoView: false }).toggleTaskList().run())}
      {toolbarButton("Numbers", Boolean(active?.orderedList), <ListOrdered aria-hidden="true" />, () => editor?.chain().focus(undefined, { scrollIntoView: false }).toggleOrderedList().run())}
    </> : null}
  </>;

  return <section className={`${styles.composer} ${className}`.trim()}>
    <div className={styles.toolbar} role="toolbar" aria-label={`${ariaLabel} formatting`}>
      {formattingButtons()}
    </div>
    {editor ? <BubbleMenu editor={editor} appendTo={appendBubbleMenuToBody} shouldShow={bubbleMenuShouldShow} options={bubbleMenuOptions} className={styles.bubbleToolbar} role="toolbar" aria-label={`${ariaLabel} selection formatting`}>
      {formattingButtons()}
    </BubbleMenu> : null}
    <EditorContent editor={editor} />
  </section>;
}
