import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProductPortfolioPanel } from "./product-portfolio-panel";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const image = "data:image/jpeg;base64,/9j/";
function openForm() {
  const save = vi.fn(() => "");
  render(<ProductPortfolioPanel products={[]} tags={[]} loading={false} error="" selectedProductId="" onSelectProduct={vi.fn()} onRetry={vi.fn()} onCreateTag={() => ({ id: "", error: "" })} onSaveProduct={save} onDeleteProduct={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Add product" }));
  return { dialog: screen.getByRole("dialog"), save };
}

it("loads the ASIN image and includes it when the product is saved", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ asin: "B0FG4H5C6W", imageDataUrl: image }) })));
  const { dialog, save } = openForm();
  fireEvent.change(within(dialog).getByLabelText("Product name"), { target: { value: "Lead came" } });
  fireEvent.change(within(dialog).getByLabelText("ASIN"), { target: { value: "b0fg4h5c6w" } });
  expect(await screen.findByAltText("Product preview", {}, { timeout: 2000 })).toHaveAttribute("src", image);
  fireEvent.click(within(dialog).getByRole("button", { name: "Add product" }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ asin: "B0FG4H5C6W", imageDataUrl: image }));
});

it("does not overwrite a manual upload with a late lookup", async () => {
  let resolve!: (value: unknown) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise(value => { resolve = value; })));
  const { dialog } = openForm();
  fireEvent.change(within(dialog).getByLabelText("ASIN"), { target: { value: "B0FG4H5C6W" } });
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  fireEvent.change(within(dialog).getByLabelText(/Product image/), { target: { files: [new File(["manual"], "manual.png", { type: "image/png" })] } });
  const preview = await screen.findByAltText("Product preview");
  const manual = preview.getAttribute("src");
  resolve({ ok: true, json: async () => ({ asin: "B0FG4H5C6W", imageDataUrl: image }) });
  await waitFor(() => expect(preview).toHaveAttribute("src", manual));
});
