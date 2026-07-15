"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getTopicsFromContentElements } from "../domain/document-elements";
import type { LibraryContentElement, LibraryDocument } from "../domain/types";
import { useReadingState } from "../state/reading-state";
import { BookmarkButton } from "./bookmark-button";
import { DocumentBuilder } from "./document-builder";

export function Reader({ doc, onSaveContentElements, onSaveVideoUrl }: { doc: LibraryDocument; onSaveContentElements: (elements: LibraryContentElement[]) => Promise<void> | void; onSaveVideoUrl: (url: string) => Promise<void> | void }) {
  const { state, ready, recordView, setTopic, toggleComplete } = useReadingState();
  const readerTopics = useMemo(() => doc.contentElements?.length ? getTopicsFromContentElements(doc.contentElements) : doc.topics, [doc.contentElements, doc.topics]);
  const [active, setActive] = useState(readerTopics.find(topic => topic.level === 2)?.id ?? "");
  const resolvedActive = readerTopics.some(topic => topic.id === active) ? active : (readerTopics.find(topic => topic.level === 2)?.id ?? "");

  useEffect(() => { recordView(doc.id); }, [doc.id, recordView]);

  const complete = ready && state.completion[doc.id];
  const go = (id: string) => {
    setActive(id);
    setTopic(doc.id, id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (id) history.replaceState(null, "", `#${id}`);
  };

  return <>
    <div className="reader-top">
      <Link href="/library">← Back to Library</Link>
      <div><BookmarkButton id={doc.id} /><button className={complete ? "primary-button complete" : "secondary-button"} aria-pressed={complete} onClick={() => toggleComplete(doc.id)}>{complete ? "✓ Completed" : "Mark complete"}</button></div>
    </div>
    <DocumentBuilder
      key={`${doc.id}:${doc.updatedAt}:${doc.contentElements?.length ?? "legacy"}`}
      doc={doc}
      activeTopicId={resolvedActive}
      onTopicChange={go}
      onSave={onSaveContentElements}
      onSaveVideoUrl={onSaveVideoUrl}
    />
  </>;
}
