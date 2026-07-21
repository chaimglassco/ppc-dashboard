import { fireEvent, render, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { richTextFromMarkdown } from "../domain/rich-text";
import { RichTextEditor, RichTextRenderer } from "./rich-text";

describe("RichTextEditor", () => {
  it("shows the full accessible toolbar and toggles list formatting visually", () => {
    const onChange = vi.fn();
    const view = render(<RichTextEditor ariaLabel="Body" value={richTextFromMarkdown("First item")} onChange={onChange} />);
    const toolbar = view.getByRole("toolbar", { name: "Body formatting" });
    expect(within(toolbar).getAllByRole("button").map(button => button.getAttribute("aria-label"))).toEqual(["Normal", "Bold", "Italic", "Underlined", "Bullets", "Checklist", "Numbers"]);
    fireEvent.click(within(toolbar).getByRole("button", { name: "Bold" }));
    expect(within(toolbar).getByRole("button", { name: "Bold" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(toolbar).getByRole("button", { name: "Normal" }));
    expect(within(toolbar).getByRole("button", { name: "Bold" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(within(toolbar).getByRole("button", { name: "Checklist" }));
    expect(view.getByRole("textbox", { name: "Body" }).querySelector('ul[data-type="taskList"]')).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: "doc" }), "First item");
    const checkbox = view.getByRole("textbox", { name: "Body" }).querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox).not.toBeDisabled();
    fireEvent.click(checkbox as HTMLInputElement);
    const savedDocument = onChange.mock.calls.at(-1)?.[0];
    expect(savedDocument.content[0].content[0].attrs.checked).toBe(true);
  });

  it("limits standalone row composers to inline styles", () => {
    const view = render(<RichTextEditor ariaLabel="Bullet row" allowLists={false} value={richTextFromMarkdown("Text")} onChange={vi.fn()} />);
    const toolbar = view.getByRole("toolbar", { name: "Bullet row formatting" });
    expect(within(toolbar).getAllByRole("button").map(button => button.getAttribute("aria-label"))).toEqual(["Normal", "Bold", "Italic", "Underlined"]);
  });

  it("emits validated ordered-list JSON when Numbers is selected", () => {
    const onChange = vi.fn();
    const view = render(<RichTextEditor ariaLabel="Numbered body" value={richTextFromMarkdown("First item")} onChange={onChange} />);
    fireEvent.click(within(view.getByRole("toolbar", { name: "Numbered body formatting" })).getByRole("button", { name: "Numbers" }));
    expect(view.getByRole("textbox", { name: "Numbered body" }).querySelector("ol")).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      content: [expect.objectContaining({ type: "orderedList", attrs: { start: 1 } })],
    }), "First item");
  });

  it("sanitizes pasted HTML through the allowlisted editor schema", async () => {
    const view = render(<RichTextEditor ariaLabel="Paste body" value={richTextFromMarkdown("")} onChange={vi.fn()} />);
    const editor = view.getByRole("textbox", { name: "Paste body" });
    fireEvent.paste(editor, { clipboardData: {
      types: ["text/html", "text/plain"],
      getData: (type: string) => type === "text/html" ? '<h1 style="color:red"><a href="https://example.com"><strong>Allowed text</strong></a><img src="bad.png"></h1>' : "Allowed text",
    } });
    await waitFor(() => expect(editor).toHaveTextContent("Allowed text"));
    expect(editor.querySelector("strong")).toBeInTheDocument();
    expect(editor.querySelector("h1, a, img")).not.toBeInTheDocument();
  });
});

describe("RichTextRenderer", () => {
  it("renders formatting and disabled reader checkboxes through the static renderer", () => {
    const view = render(<RichTextRenderer value={richTextFromMarkdown("**Important**\n\n- [x] Done")} />);
    expect(view.getByText("Important").tagName).toBe("STRONG");
    expect(view.getByRole("checkbox", { name: "Checklist item" })).toBeChecked();
    expect(view.getByRole("checkbox", { name: "Checklist item" })).toBeDisabled();
  });

  it("keeps semantic unordered and ordered lists in reader output", () => {
    const view = render(<RichTextRenderer value={richTextFromMarkdown("- Bullet item\n\n1. Numbered item")} />);
    expect(view.getByText("Bullet item").closest("ul")).toBeInTheDocument();
    expect(view.getByText("Numbered item").closest("ol")).toBeInTheDocument();
  });
});
