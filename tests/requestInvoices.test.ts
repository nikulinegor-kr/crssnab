import { describe, expect, it } from "bun:test";
import { getInvoiceDeletePatch, getInvoiceResetPatch } from "../src/lib/requestInvoices";

describe("request invoice actions", () => {
  it("reset clears exactly main amount, invoice number and contractor", () => {
    expect(getInvoiceResetPatch(1)).toEqual({ amount: null, invoice_number: null, contractor: null });
  });

  it("reset does not touch secondary invoices, invoice date or documents", () => {
    const patch = getInvoiceResetPatch(1);
    for (const preserved of ["amount_2", "invoice_number_2", "amount_3", "invoice_number_3", "invoice_date", "document_url", "document_urls", "payment_percent"]) {
      expect(patch).not.toHaveProperty(preserved);
    }
  });

  it("deleting the main invoice preserves documents and other invoices", () => {
    expect(getInvoiceDeletePatch(1)).toEqual({ amount: null, invoice_number: null, contractor: null, invoice_date: null });
  });

  it("deleting a secondary invoice clears only its own fields", () => {
    expect(getInvoiceDeletePatch(2)).toEqual({ amount_2: null, invoice_number_2: null });
    expect(getInvoiceDeletePatch(3)).toEqual({ amount_3: null, invoice_number_3: null });
  });
});
