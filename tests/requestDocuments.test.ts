import { describe, expect, it } from "bun:test";
import { getRequestFileRemovalPatch, getRequestFileUrls } from "../src/lib/requestDocuments";

describe("request document removal", () => {
  it("removes only the selected document and advances the legacy primary URL", () => {
    const request = { id: "r1", document_url: "a", document_urls: ["a", "b"] };
    expect(getRequestFileRemovalPatch(request, "a", "document")).toEqual({ document_urls: ["b"], document_url: "b" });
  });

  it("preserves a different primary document and all unrelated photos", () => {
    const request = { id: "r1", document_url: "b", document_urls: ["a", "b"], photo_url: "p", photo_urls: ["p"] };
    expect(getRequestFileRemovalPatch(request, "a", "document")).toEqual({ document_urls: ["b"], document_url: "b" });
  });

  it("keeps invoices, contracts and delivery notes when the last document is deleted", () => {
    const request = {
      id: "r1",
      document_url: "invoice.pdf",
      document_urls: ["invoice.pdf", "contract.pdf", "delivery-note.pdf", "invoice-ZRS.pdf"],
    };
    expect(getRequestFileRemovalPatch(request, "invoice-ZRS.pdf", "document")).toEqual({
      document_urls: ["invoice.pdf", "contract.pdf", "delivery-note.pdf"],
      document_url: "invoice.pdf",
    });
  });

  it("does not duplicate a legacy document in the visible list", () => {
    expect(getRequestFileUrls({ id: "r1", document_url: "a", document_urls: ["a"] }, "document")).toEqual(["a"]);
  });

  it("removes only the selected photo and repairs the legacy primary URL", () => {
    expect(getRequestFileRemovalPatch({ id: "r1", photo_url: "p1", photo_urls: ["p1", "p2"] }, "p1", "photo")).toEqual({ photo_urls: ["p2"], photo_url: "p2" });
  });
});
