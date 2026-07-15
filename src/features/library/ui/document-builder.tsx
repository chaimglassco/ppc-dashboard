"use client";

/* eslint-disable @next/next/no-img-element */
import { ArrowDown, ArrowUp, ExternalLink, Eye, List as ListIcon, LoaderCircle, Pencil, Play, Plus, Trash2, Video, X } from "lucide-react";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createBlankContentElement, getInitialContentElements, getTopicsFromContentElements } from "../domain/document-elements";
import type { LibraryContentElement, LibraryContentElementType, LibraryDocument, Topic } from "../domain/types";
import { Markdown } from "./markdown";
import styles from "./document-builder.module.css";

const ELEMENT_OPTIONS: Array<{ type: LibraryContentElementType; label: string }> = [
  { type: "topic", label: "Add Topic" },
  { type: "statement", label: "Centered Statement" },
  { type: "quote", label: "Blue Callout" },
  { type: "bullets", label: "Bullet Text" },
  { type: "checklist", label: "Checklist Bullets" },
  { type: "numbered", label: "Numbered Text" },
  { type: "insight", label: "Key Insight" },
  { type: "table", label: "Editable Table" },
  { type: "accordion", label: "Dropdown" },
  { type: "feature", label: "Feature Card" },
  { type: "code", label: "Blue Text Block" },
  { type: "timeline", label: "Roadmap" },
  { type: "flowchart", label: "Diagnostic Flow" },
];

type DocumentBuilderProps = {
  doc: LibraryDocument;
  activeTopicId: string;
  onTopicChange: (id: string) => void;
  onSave: (elements: LibraryContentElement[]) => Promise<void> | void;
  onSaveVideoUrl: (url: string) => Promise<void> | void;
};

export function DocumentBuilder({ doc, activeTopicId, onTopicChange, onSave, onSaveVideoUrl }: DocumentBuilderProps) {
  const [elements, setElements] = useState(() => getInitialContentElements(doc));
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [previewImage, setPreviewImage] = useState("");
  const [useStructuredPreview, setUseStructuredPreview] = useState(Boolean(doc.contentElements));
  const [isReorderOpen, setIsReorderOpen] = useState(false);
  const [reorderIds, setReorderIds] = useState<string[]>([]);

  const structuredTopics = getTopicsFromContentElements(elements);
  const topics = useStructuredPreview || isEditMode ? structuredTopics : doc.topics;

  const updateElement = (id: string, updates: Partial<LibraryContentElement>) => {
    setElements(current => current.map(element => element.id === id ? { ...element, ...updates } : element));
  };

  const addElement = (type: LibraryContentElementType) => {
    const next = createBlankContentElement(type, structuredTopics.length + 1);
    setElements(current => [...current, next]);
    setIsAddMenuOpen(false);
    if (type === "topic") window.requestAnimationFrame(() => onTopicChange(next.id));
  };

  const deleteElement = (id: string) => {
    setElements(current => current.filter(element => element.id !== id));
    if (activeTopicId === id) onTopicChange(structuredTopics.find(topic => topic.id !== id)?.id ?? "");
  };

  const openReorder = () => {
    setIsAddMenuOpen(false);
    setReorderIds(elements.map(element => element.id));
    setIsReorderOpen(true);
  };

  const moveReorderItem = (fromIndex: number, toIndex: number) => {
    setReorderIds(current => {
      if (toIndex < 0 || toIndex >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const saveReorder = async () => {
    const byId = new Map(elements.map(element => [element.id, element]));
    let partNumber = 0;
    const next = reorderIds
      .map(id => byId.get(id))
      .filter((element): element is LibraryContentElement => Boolean(element))
      .map(element => element.type === "topic" ? { ...element, eyebrow: `Part ${++partNumber}` } : element);

    setIsSaving(true);
    try {
      await onSave(next);
      setElements(next);
      setUseStructuredPreview(true);
      setIsReorderOpen(false);
      setNotice("Element order saved.");
      window.setTimeout(() => setNotice(""), 2400);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save the element order.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEditMode = async () => {
    if (!isEditMode) {
      setNotice("");
      setIsEditMode(true);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(elements);
      setUseStructuredPreview(true);
      setIsEditMode(false);
      setIsAddMenuOpen(false);
      setNotice("Changes saved. Preview updated.");
      window.setTimeout(() => setNotice(""), 2400);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save document changes.");
    } finally {
      setIsSaving(false);
    }
  };

  return <>
    <details className="mobile-topics">
      <summary>On this page · {topics.filter(topic => topic.level === 2).length} topics</summary>
      <TopicLinks topics={topics} active={activeTopicId} onSelect={onTopicChange} />
    </details>
    <div className="reader-layout" style={{ gridTemplateColumns: "minmax(230px, 270px) minmax(0, 1fr)", gap: 14 }}>
      <aside className={`topic-sidebar ${styles.sidebar}`}>
        <div className={styles.sidebarContent}>
          <strong>ON THIS PAGE</strong>
          <TopicLinks topics={topics} active={activeTopicId} onSelect={onTopicChange} onDelete={isEditMode ? deleteElement : undefined} />
        </div>
        <BuilderControls isEditMode={isEditMode} isSaving={isSaving} isOpen={isAddMenuOpen} notice={notice} onToggle={toggleEditMode} onToggleMenu={() => setIsAddMenuOpen(value => !value)} onAdd={addElement} />
      </aside>
      <article className={`prose ${styles.document}`}>
        <DocumentHeader doc={doc} isEditMode={isEditMode} onSaveVideoUrl={onSaveVideoUrl} />
        {isEditMode ? (
          <div className={styles.reorderBar} aria-label="Document element controls">
            <button
              className={styles.reorderButton}
              type="button"
              onClick={openReorder}
              disabled={elements.length < 2}
              title={elements.length < 2 ? "Add at least two elements to reorder them" : "Reorder document elements"}
            >
              <ListIcon aria-hidden="true" />
              REORDER
            </button>
          </div>
        ) : null}
        {isEditMode || useStructuredPreview ? <div className={styles.blocks}>{elements.map(element => isEditMode
          ? <ElementEditor key={element.id} element={element} onUpdate={updates => updateElement(element.id, updates)} onDelete={() => deleteElement(element.id)} onPreviewImage={setPreviewImage} />
          : <ElementPreview key={element.id} element={element} onPreviewImage={setPreviewImage} />)}</div>
          : <Markdown body={doc.body} topics={doc.topics} onTopic={onTopicChange} />}
      </article>
    </div>
    <div className={styles.mobileControls}><BuilderControls isEditMode={isEditMode} isSaving={isSaving} isOpen={isAddMenuOpen} notice={notice} onToggle={toggleEditMode} onToggleMenu={() => setIsAddMenuOpen(value => !value)} onAdd={addElement} /></div>
    {previewImage ? <div className={styles.imageModal} role="dialog" aria-modal="true" aria-label="Image preview">
      <div><button type="button" onClick={() => setPreviewImage("")} aria-label="Close image preview"><X /></button><img src={previewImage} alt="Document feature preview" /></div>
    </div> : null}
    {isReorderOpen ? <ReorderDialog elements={elements} order={reorderIds} isSaving={isSaving} onMove={moveReorderItem} onCancel={() => setIsReorderOpen(false)} onSave={() => void saveReorder()} /> : null}
  </>;
}

function getElementSummary(element: LibraryContentElement, index: number) {
  const typeLabel = ELEMENT_OPTIONS.find(option => option.type === element.type)?.label ?? element.type;
  if (element.type === "topic") return { typeLabel, title: previewText(element.title || element.label, `Topic ${index + 1}`) };
  if (element.type === "statement" || element.type === "quote" || element.type === "code") return { typeLabel, title: previewText(element.text, `Untitled ${typeLabel}`) };
  if (element.type === "bullets" || element.type === "checklist" || element.type === "numbered") return { typeLabel, title: previewText(element.items.find(Boolean) ?? "", `Untitled ${typeLabel}`) };
  if (element.type === "table") return { typeLabel, title: previewText(element.columns.filter(Boolean).join(" / "), "Untitled table") };
  if (element.type === "accordion") return { typeLabel, title: previewText(element.dropdowns?.[0]?.title || element.title, "Untitled dropdown") };
  if (element.type === "timeline") return { typeLabel, title: previewText(element.title, "Untitled roadmap") };
  if (element.type === "flowchart") return { typeLabel, title: previewText(element.nodes[0]?.title ?? "", "Untitled diagnostic flow") };
  return { typeLabel, title: previewText(element.title, `Untitled ${typeLabel}`) };
}

function ReorderDialog({ elements, order, isSaving, onMove, onCancel, onSave }: { elements: LibraryContentElement[]; order: string[]; isSaving: boolean; onMove: (fromIndex: number, toIndex: number) => void; onCancel: () => void; onSave: () => void }) {
  const byId = new Map(elements.map(element => [element.id, element]));
  const ordered = order.map(id => byId.get(id)).filter((element): element is LibraryContentElement => Boolean(element));
  return <div className={styles.reorderBackdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !isSaving) onCancel(); }}>
    <section className={styles.reorderDialog} role="dialog" aria-modal="true" aria-labelledby="reorder-title">
      <header><div><span>DOCUMENT ELEMENTS</span><h2 id="reorder-title">Reorder elements</h2><p>Move items up or down. Topic part numbers update automatically.</p></div><button type="button" onClick={onCancel} disabled={isSaving} aria-label="Close reorder elements"><X /></button></header>
      <ol className={styles.reorderList}>{ordered.map((element, index) => {
        const summary = getElementSummary(element, index);
        return <li key={element.id}>
          <span className={styles.reorderIndex}>{index + 1}</span>
          <div className={styles.reorderCopy}><span>{summary.typeLabel}</span><strong title={summary.title}>{summary.title}</strong></div>
          <div className={styles.reorderActions}>
            <button type="button" onClick={() => onMove(index, index - 1)} disabled={isSaving || index === 0} aria-label={`Move ${summary.title} up`}><ArrowUp /></button>
            <button type="button" onClick={() => onMove(index, index + 1)} disabled={isSaving || index === ordered.length - 1} aria-label={`Move ${summary.title} down`}><ArrowDown /></button>
          </div>
        </li>;
      })}</ol>
      <footer><button className={styles.reorderCancel} type="button" onClick={onCancel} disabled={isSaving}>Cancel</button><button className={styles.reorderSave} type="button" onClick={onSave} disabled={isSaving}>{isSaving ? "Saving..." : "Save order"}</button></footer>
    </section>
  </div>;
}

function setTopicTooltip(button: HTMLButtonElement, value: string) {
  const title = button.querySelector<HTMLElement>(".topic-title");
  if (title && title.scrollWidth > title.clientWidth + 1) {
    button.dataset.tooltip = value;
    button.title = value;
  } else {
    delete button.dataset.tooltip;
    button.removeAttribute("title");
  }
}

function TopicLinks({ topics, active, onSelect, onDelete }: { topics: Topic[]; active: string; onSelect: (id: string) => void; onDelete?: (id: string) => void }) {
  let part = 0;
  return <nav aria-label="Topics">{topics.map(topic => {
    const number = topic.level === 2 ? ++part : null;
    return <div className={styles.topicRow} key={topic.id}>
      <button className={`${topic.level === 3 ? "nested " : ""}${active === topic.id ? "active" : ""}`} aria-current={active === topic.id ? "location" : undefined} onMouseEnter={event => setTopicTooltip(event.currentTarget, topic.title)} onFocus={event => setTopicTooltip(event.currentTarget, topic.title)} onClick={() => onSelect(topic.id)}>
        {number ? <span className="topic-number" aria-hidden="true">{number}</span> : <span className="topic-branch" aria-hidden="true">–</span>}
        <span className="topic-title">{topic.title}</span>
      </button>
      {onDelete && topic.level === 2 ? <button className={styles.topicDelete} type="button" aria-label={`Delete ${topic.title}`} onClick={() => onDelete(topic.id)}><Trash2 /></button> : null}
    </div>;
  })}</nav>;
}

function BuilderControls({ isEditMode, isSaving, isOpen, notice, onToggle, onToggleMenu, onAdd }: { isEditMode: boolean; isSaving: boolean; isOpen: boolean; notice: string; onToggle: () => void; onToggleMenu: () => void; onAdd: (type: LibraryContentElementType) => void }) {
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPlacement, setMenuPlacement] = useState<"up" | "down">("up");
  const [menuMaxHeight, setMenuMaxHeight] = useState(420);

  const toggleAddMenu = () => {
    if (!isOpen && addButtonRef.current) {
      const rect = addButtonRef.current.getBoundingClientRect();
      const desiredHeight = Math.min(520, ELEMENT_OPTIONS.length * 36 + 16);
      const spaceAbove = Math.max(0, rect.top - 12);
      const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - 12);
      const shouldOpenDown = spaceAbove < desiredHeight && spaceBelow >= 160;
      const placement = shouldOpenDown ? "down" : "up";
      const availableSpace = placement === "down" ? spaceBelow : spaceAbove;
      setMenuPlacement(placement);
      setMenuMaxHeight(Math.max(140, Math.min(desiredHeight, availableSpace - 8)));
    }
    onToggleMenu();
  };

  return <div className={styles.controls}>
    {notice ? <p role="status">{notice}</p> : null}
    <div>
      <button className={`${styles.modeButton} ${isEditMode ? styles.editing : ""}`} type="button" onClick={onToggle} disabled={isSaving} aria-pressed={isEditMode} aria-label={isEditMode ? "Save changes and switch to view mode" : "Switch to edit mode"}>
        {isSaving ? <LoaderCircle className={styles.spinner} /> : isEditMode ? <Pencil /> : <Eye />}
      </button>
      {isEditMode ? <div className={styles.addWrap}>
        <button ref={addButtonRef} className={styles.addButton} type="button" onClick={toggleAddMenu} aria-expanded={isOpen} aria-label="Add document element"><Plus /></button>
        {isOpen ? <div className={`${styles.addMenu} ${menuPlacement === "down" ? styles.addMenuDown : styles.addMenuUp}`} style={{ maxHeight: menuMaxHeight }}>{ELEMENT_OPTIONS.map(option => <button key={option.type} type="button" onClick={() => onAdd(option.type)}><Plus />{option.label}</button>)}</div> : null}
      </div> : null}
    </div>
  </div>;
}

function DocumentHeader({ doc, isEditMode, onSaveVideoUrl }: { doc: LibraryDocument; isEditMode: boolean; onSaveVideoUrl: (url: string) => Promise<void> | void }) {
  const videoUrl = normalizeVideoUrl(doc.videoUrl ?? "");
  const videoThumbnailUrl = getYouTubeThumbnailUrl(videoUrl);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(videoUrl);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const saveVideo = async () => {
    const value = draft.trim();
    const normalizedUrl = normalizeVideoUrl(value);
    if (!normalizedUrl) {
      setError("Enter a valid YouTube or HTTPS video link.");
      return;
    }
    setIsSaving(true);
    try {
      await onSaveVideoUrl(normalizedUrl);
      setError("");
      setIsEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the video link.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeVideo = async () => {
    setIsSaving(true);
    try {
      await onSaveVideoUrl("");
      setDraft("");
      setError("");
      setIsEditing(false);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Unable to remove the video link.");
    } finally {
      setIsSaving(false);
    }
  };

  return <header className={`reader-header ${styles.documentHeader}`}>
    <div className={styles.headerCopy}>
      <div className="eyebrow">{doc.category} · {doc.type}</div>
      <h1>{doc.title}</h1>
      <p>{doc.description}</p>
      <div className="reader-meta"><span>Updated {new Date(doc.updatedAt).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}</span><span>{doc.readingMinutes} min read</span></div>
    </div>
    <div className={styles.videoControl}>
      {isEditing && isEditMode ? <form onSubmit={event => { event.preventDefault(); void saveVideo(); }}>
        <label htmlFor={`video-url-${doc.id}`}>Video tutorial link</label>
        <input id={`video-url-${doc.id}`} type="url" value={draft} onChange={event => setDraft(event.target.value)} placeholder="https://youtube.com/watch?v=..." autoFocus />
        {error ? <p role="alert">{error}</p> : null}
        <div><button type="submit" disabled={isSaving || !draft.trim()}>{isSaving ? "Saving…" : "Save link"}</button><button type="button" onClick={() => { setDraft(videoUrl); setError(""); setIsEditing(false); }}>Cancel</button>{videoUrl ? <button type="button" onClick={() => void removeVideo()} disabled={isSaving}>Remove</button> : null}</div>
      </form> : videoUrl ? <div className={styles.videoActions}>
        <a className={styles.videoThumbnail} href={videoUrl} target="_blank" rel="noopener noreferrer" aria-label="Open video tutorial">
          {videoThumbnailUrl ? <img src={videoThumbnailUrl} alt={`${doc.title} video tutorial thumbnail`} /> : <span className={styles.genericThumbnail}><Video aria-hidden="true" />Video tutorial</span>}
          <span className={styles.playBadge} aria-hidden="true"><Play /></span>
        </a>
        <div className={styles.videoActionRow}>
          <a className={styles.watchVideoButton} href={videoUrl} target="_blank" rel="noopener noreferrer">WATCH THE VIDEO <ExternalLink aria-hidden="true" /></a>
          {isEditMode ? <button type="button" onClick={() => setIsEditing(true)} aria-label="Edit video tutorial link"><Pencil /></button> : null}
        </div>
      </div> : isEditMode ? <button className={styles.addVideoButton} type="button" onClick={() => setIsEditing(true)}><Video aria-hidden="true" />Add a Video Link</button> : null}
    </div>
  </header>;
}

function normalizeVideoUrl(value: string) {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function getYouTubeThumbnailUrl(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let videoId = "";
    if (host === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (host === "youtube.com" || host === "m.youtube.com") {
      videoId = url.searchParams.get("v") ?? "";
      if (!videoId) {
        const parts = url.pathname.split("/").filter(Boolean);
        if (["embed", "shorts", "live"].includes(parts[0])) videoId = parts[1] ?? "";
      }
    }
    return /^[a-zA-Z0-9_-]{6,}$/.test(videoId) ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "";
  } catch {
    return "";
  }
}

function previewText(value: string, fallback = "") { return value.trim() || fallback; }

function ElementPreview({ element, onPreviewImage }: { element: LibraryContentElement; onPreviewImage: (url: string) => void }) {
  if (element.type === "topic") return <section id={element.id} className={styles.topicBlock}>
    <p className={styles.eyebrow}>{element.eyebrow}</p><h2>{previewText(element.title, "Header Topic Title")}</h2><span className={styles.rule} />
    <div className={styles.topicBody}>{element.body.filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    {element.callout ? <div className={styles.quote}>{element.callout}</div> : null}
  </section>;
  if (element.type === "statement") return <section className={styles.statement}>{previewText(element.text)}</section>;
  if (element.type === "quote") return <section className={styles.quote}>{previewText(element.text)}</section>;
  if (element.type === "bullets") return <ul className={`${styles.list} ${styles.bulletList}`}>{element.items.filter(Boolean).map((item, index) => <li key={index}>{item}</li>)}</ul>;
  if (element.type === "checklist") return <ul className={styles.checklist}>{element.items.filter(Boolean).map((item, index) => <li key={index}><input type="checkbox" disabled aria-label={item} /><span>{item}</span></li>)}</ul>;
  if (element.type === "numbered") return <ol className={`${styles.list} ${styles.numberedList}`}>{element.items.filter(Boolean).map((item, index) => <li key={index}>{item}</li>)}</ol>;
  if (element.type === "insight") return <section className={styles.insight}><strong>{previewText(element.title, "Key Insight")}</strong><p>{previewText(element.text)}</p></section>;
  if (element.type === "table") return <ElementTable element={element} />;
  if (element.type === "accordion") return <section className={styles.accordionList}>{getDropdowns(element).map((dropdown, index) => <details className={styles.accordion} open={index === 0} key={index}><summary>{previewText(dropdown.title, "Dropdown title")}</summary><p>{previewText(dropdown.text)}</p></details>)}</section>;
  if (element.type === "feature") return <section className={styles.feature}><div><span>{element.label}</span><h3>{previewText(element.title, "Feature title")}</h3><p>{previewText(element.text)}</p>{element.buttonText ? <button type="button">{element.buttonText}</button> : null}</div><button className={styles.imageButton} type="button" onClick={() => element.imageUrl && onPreviewImage(element.imageUrl)}>{element.imageUrl ? <img src={element.imageUrl} alt="" /> : "Image preview"}</button></section>;
  if (element.type === "code") return <section className={styles.code}><span>{element.label}</span><pre>{previewText(element.text)}</pre></section>;
  if (element.type === "timeline") return <section className={styles.timeline}><h3>{previewText(element.title, "Roadmap title")}</h3>{element.steps.map((step, index) => <div key={index}><span>{index + 1}</span><div><strong>{previewText(step.title, "Step title")}</strong><p>{previewText(step.text)}</p></div></div>)}</section>;
  return <section className={styles.flow}>{element.nodes.map((node, index) => <div key={index}><strong>{previewText(node.title, "Flow box title")}</strong>{node.text ? <span>{node.text}</span> : null}</div>)}</section>;
}

function ElementTable({ element }: { element: LibraryContentElement }) {
  const columnWidths = element.columnWidths?.length === element.columns.length ? element.columnWidths : undefined;
  return <div className={styles.tableWrap}><table className={columnWidths ? styles.sizedTable : undefined} style={columnWidths ? { minWidth: columnWidths.reduce((total, width) => total + width, 0) } : undefined}>{columnWidths ? <colgroup>{columnWidths.map((width, index) => <col key={index} style={{ width }} />)}</colgroup> : null}<thead><tr>{element.columns.map((column, index) => <th key={index}>{previewText(column, `Column ${index + 1}`)}</th>)}</tr></thead><tbody>{element.rows.map((row, rowIndex) => <tr key={rowIndex}>{element.columns.map((_, columnIndex) => <td key={columnIndex}>{row[columnIndex] ?? ""}</td>)}</tr>)}</tbody></table></div>;
}

function ElementEditor({ element, onUpdate, onDelete, onPreviewImage }: { element: LibraryContentElement; onUpdate: (updates: Partial<LibraryContentElement>) => void; onDelete: () => void; onPreviewImage: (url: string) => void }) {
  const updateItem = (index: number, value: string) => onUpdate({ items: element.items.map((item, itemIndex) => itemIndex === index ? value : item) });
  const updatePair = (field: "steps" | "nodes", index: number, key: "title" | "text", value: string) => onUpdate({ [field]: element[field].map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) });
  const editor = (() => {
    if (element.type === "topic") return <section id={element.id} className={styles.topicBlock}><p className={styles.eyebrow}>{element.eyebrow}</p><input className={styles.topicTitleInput} value={element.title} onChange={event => onUpdate({ title: event.target.value, label: event.target.value || element.label })} placeholder="Header topic title" /><span className={styles.rule} /><textarea className={styles.topicTextarea} value={element.body.join("\n\n")} onChange={event => onUpdate({ body: event.target.value.split(/\n\s*\n/) })} placeholder="Topic content..." /><input className={styles.input} value={element.callout ?? ""} onChange={event => onUpdate({ callout: event.target.value })} placeholder="Optional topic callout" /></section>;
    if (element.type === "statement") return <textarea className={`${styles.area} ${styles.statementEditor}`} value={element.text} onChange={event => onUpdate({ text: event.target.value })} placeholder="Centered statement text..." />;
    if (element.type === "quote") return <div className={styles.quote}><textarea className={styles.area} value={element.text} onChange={event => onUpdate({ text: event.target.value })} placeholder="Blue callout text..." /></div>;
    if (element.type === "bullets" || element.type === "checklist" || element.type === "numbered") {
      const placeholder = element.type === "numbered" ? "Numbered text..." : element.type === "checklist" ? "Checklist item..." : "Bullet text...";
      const addLabel = element.type === "numbered" ? "number" : element.type === "checklist" ? "checklist item" : "bullet";
      return <div className={`${styles.itemEditor} ${element.type === "checklist" ? styles.checklistEditor : ""}`}>{element.items.map((item, index) => <label key={index}>{element.type === "checklist" ? <input type="checkbox" disabled aria-hidden="true" /> : <span>{element.type === "numbered" ? `${index + 1}.` : "•"}</span>}<input className={styles.input} value={item} onChange={event => updateItem(index, event.target.value)} placeholder={placeholder} /></label>)}<button type="button" onClick={() => onUpdate({ items: [...element.items, ""] })}>Add {addLabel}</button></div>;
    }
    if (element.type === "insight") return <section className={styles.insight}><input className={styles.input} value={element.title} onChange={event => onUpdate({ title: event.target.value })} placeholder="Key Insight" /><textarea className={styles.area} value={element.text} onChange={event => onUpdate({ text: event.target.value })} placeholder="Insight content..." /></section>;
    if (element.type === "table") return <TableEditor element={element} onUpdate={onUpdate} />;
    if (element.type === "accordion") return <AccordionEditor element={element} onUpdate={onUpdate} />;
    if (element.type === "feature") return <section className={styles.featureEditor}><div><input className={styles.input} value={element.label} onChange={event => onUpdate({ label: event.target.value })} placeholder="Feature label" /><input className={styles.input} value={element.title} onChange={event => onUpdate({ title: event.target.value })} placeholder="Feature title" /><textarea className={styles.area} value={element.text} onChange={event => onUpdate({ text: event.target.value })} placeholder="Feature text..." /><input className={styles.input} value={element.buttonText} onChange={event => onUpdate({ buttonText: event.target.value })} placeholder="Button text" /></div><div><input className={styles.input} value={element.imageUrl} onChange={event => onUpdate({ imageUrl: event.target.value })} placeholder="Image URL" /><button className={styles.imageButton} type="button" onClick={() => element.imageUrl && onPreviewImage(element.imageUrl)}>{element.imageUrl ? <img src={element.imageUrl} alt="" /> : "Clickable image preview"}</button></div></section>;
    if (element.type === "code") return <section className={styles.code}><input value={element.label} onChange={event => onUpdate({ label: event.target.value })} placeholder="Block label" /><textarea value={element.text} onChange={event => onUpdate({ text: event.target.value })} placeholder="Blue text block content..." /></section>;
    if (element.type === "timeline") return <section className={styles.timelineEditor}><input className={styles.input} value={element.title} onChange={event => onUpdate({ title: event.target.value })} placeholder="Roadmap title" />{element.steps.map((step, index) => <div key={index}><span>{index + 1}</span><div><input className={styles.input} value={step.title} onChange={event => updatePair("steps", index, "title", event.target.value)} placeholder="Step title" /><input className={styles.input} value={step.text} onChange={event => updatePair("steps", index, "text", event.target.value)} placeholder="Step description" /></div></div>)}<button type="button" onClick={() => onUpdate({ steps: [...element.steps, { title: "", text: "" }] })}>Add step</button></section>;
    return <section className={styles.flowEditor}>{element.nodes.map((node, index) => <div key={index}><input value={node.title} onChange={event => updatePair("nodes", index, "title", event.target.value)} placeholder="Flow box title" /><input value={node.text} onChange={event => updatePair("nodes", index, "text", event.target.value)} placeholder="Connector text" /></div>)}<button type="button" onClick={() => onUpdate({ nodes: [...element.nodes, { title: "", text: "" }] })}>Add flow step</button></section>;
  })();
  return <div className={styles.editorShell}><button className={styles.deleteBlock} type="button" onClick={onDelete} aria-label={`Delete ${element.type} block`}><Trash2 /></button>{editor}</div>;
}

function getDropdowns(element: LibraryContentElement) {
  return element.dropdowns?.length ? element.dropdowns : [{ title: element.title, text: element.text }];
}

function AccordionEditor({ element, onUpdate }: { element: LibraryContentElement; onUpdate: (updates: Partial<LibraryContentElement>) => void }) {
  const dropdowns = getDropdowns(element);
  const saveDropdowns = (next: Array<{ title: string; text: string }>) => onUpdate({ dropdowns: next, title: next[0]?.title ?? "", text: next[0]?.text ?? "" });
  const updateDropdown = (index: number, field: "title" | "text", value: string) => saveDropdowns(dropdowns.map((dropdown, dropdownIndex) => dropdownIndex === index ? { ...dropdown, [field]: value } : dropdown));
  return <section className={styles.accordionEditor}>
    {dropdowns.map((dropdown, index) => <div className={styles.accordionEditorItem} key={index}>
      <input className={styles.input} value={dropdown.title} onChange={event => updateDropdown(index, "title", event.target.value)} placeholder="Dropdown title..." />
      <textarea className={styles.area} value={dropdown.text} onChange={event => updateDropdown(index, "text", event.target.value)} placeholder="Dropdown content..." />
      {dropdowns.length > 1 ? <button className={styles.removeDropdown} type="button" onClick={() => saveDropdowns(dropdowns.filter((_, dropdownIndex) => dropdownIndex !== index))} aria-label={`Remove dropdown ${index + 1}`}><Trash2 /></button> : null}
    </div>)}
    <button className={styles.addDropdown} type="button" onClick={() => saveDropdowns([...dropdowns, { title: "", text: "" }])}><Plus />Add another dropdown</button>
  </section>;
}

function TableEditor({ element, onUpdate }: { element: LibraryContentElement; onUpdate: (updates: Partial<LibraryContentElement>) => void }) {
  const updateColumn = (index: number, value: string) => onUpdate({ columns: element.columns.map((column, columnIndex) => columnIndex === index ? value : column) });
  const updateCell = (rowIndex: number, columnIndex: number, value: string) => onUpdate({ rows: element.rows.map((row, nextRowIndex) => nextRowIndex === rowIndex ? row.map((cell, nextColumnIndex) => nextColumnIndex === columnIndex ? value : cell) : row) });
  const columnWidths = element.columnWidths?.length === element.columns.length ? element.columnWidths : undefined;
  const startColumnResize = (index: number, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const table = event.currentTarget.closest("table");
    if (!table) return;
    const startX = event.clientX;
    const startWidths = Array.from(table.querySelectorAll("th"), header => header.getBoundingClientRect().width);
    const minimumWidth = 100;
    const onMove = (moveEvent: PointerEvent) => {
      const next = [...startWidths];
      let delta = moveEvent.clientX - startX;
      if (index < next.length - 1) {
        delta = Math.max(minimumWidth - next[index], Math.min(delta, next[index + 1] - minimumWidth));
        next[index] += delta;
        next[index + 1] -= delta;
      } else {
        next[index] = Math.max(minimumWidth, next[index] + delta);
      }
      onUpdate({ columnWidths: next.map(width => Math.round(width)) });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };
  const addColumn = () => onUpdate({ columns: [...element.columns, ""], rows: element.rows.map(row => [...row, ""]), columnWidths: columnWidths ? [...columnWidths, 150] : undefined });
  return <div className={styles.tableEditor}><div className={styles.tableWrap}><table className={columnWidths ? styles.sizedTable : undefined} style={columnWidths ? { minWidth: columnWidths.reduce((total, width) => total + width, 0) } : undefined}>{columnWidths ? <colgroup>{columnWidths.map((width, index) => <col key={index} style={{ width }} />)}</colgroup> : null}<thead><tr>{element.columns.map((column, index) => <th key={index}><input className={styles.input} value={column} onChange={event => updateColumn(index, event.target.value)} placeholder="Column" /><button className={styles.columnResize} type="button" onPointerDown={event => startColumnResize(index, event)} aria-label={`Resize column ${index + 1}`} /></th>)}</tr></thead><tbody>{element.rows.map((row, rowIndex) => <tr key={rowIndex}>{element.columns.map((_, columnIndex) => <td key={columnIndex}><textarea className={styles.area} value={row[columnIndex] ?? ""} onChange={event => updateCell(rowIndex, columnIndex, event.target.value)} placeholder="Cell text" /></td>)}</tr>)}</tbody></table></div><div><button type="button" onClick={addColumn}>Add column</button><button type="button" onClick={() => onUpdate({ rows: [...element.rows, element.columns.map(() => "")] })}>Add row</button></div></div>;
}
