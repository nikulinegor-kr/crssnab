import { describe, expect, it } from "bun:test";
import {
  buildRequestInvoiceMaxPayload,
  getRequestInvoiceMaxError,
  requestInvoiceDisplayName,
  selectRequestInvoiceUrl,
} from "../src/lib/requestInvoiceMax";

const request = {
  id: "request-uuid",
  organization_id: "org-uuid",
  description: "Закупка кабеля",
};

describe("request invoice MAX action", () => {
  it("sends the selected saved file with request title and existing ids", () => {
    const url = "https://storage.test/request-documents/internal/invoice.pdf";
    expect(buildRequestInvoiceMaxPayload(request, url)).toEqual({
      chat_id: "-75086506652357",
      text: "Счёт — Закупка кабеля",
      organization_id: "org-uuid",
      request_id: "request-uuid",
      document_url: url,
      file_name: "invoice.pdf",
      document_only: true,
      mode: "legacy",
    });
  });

  it("uses the latest ZRS revision, otherwise the latest attached document", () => {
    const original = "https://storage.test/original.pdf";
    const zrsOld = "https://storage.test/old-ZRS.pdf";
    const zrsNew = "https://storage.test/new-ZRS.pdf";
    expect(selectRequestInvoiceUrl([original, zrsOld, zrsNew])).toBe(zrsNew);
    expect(selectRequestInvoiceUrl([original])).toBe(original);
    expect(selectRequestInvoiceUrl([], original)).toBe(original);
    expect(selectRequestInvoiceUrl([])).toBeNull();
  });

  it("does not expose an internal request number in the file caption", () => {
    const payload = buildRequestInvoiceMaxPayload({ ...request, description: "Закупка кабеля" }, "https://storage.test/invoice.pdf");
    expect(payload.text).toBe("Счёт — Закупка кабеля");
    expect(payload.text).not.toContain("REQ-");
  });

  it("requires confirmation of document delivery, not only a text response", () => {
    expect(getRequestInvoiceMaxError({ delivered: true })).toBeNull();
    expect(getRequestInvoiceMaxError({ delivered: false, error: "MAX rejected file" })).toBe("MAX rejected file");
    expect(getRequestInvoiceMaxError(null)).toBeTruthy();
  });

  it("keeps the attached file name for downloading and sending", () => {
    expect(requestInvoiceDisplayName("https://storage.test/invoice%20final.pdf?token=1", "Заявка")).toBe("invoice final.pdf");
  });
});
