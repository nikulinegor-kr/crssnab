import { describe, expect, it } from "bun:test";
import {
  buildInvoiceAutofill,
  invoiceAutofillMessage,
  mergeRecognizedItems,
  normalizeRecognizedItems,
  type RequestItem,
} from "../src/lib/invoiceAutofill";

const syntheticInvoice = {
  contractor: "Общество с ограниченной ответственностью «Тестовый поставщик»",
  supplier_inn: "7701234567",
  invoice_number: "00017",
  amount: 12345.67,
  items: [
    { article: "A-01", name: "Фильтр тестовый", quantity: 2, unit: "шт", price: 1000.25 },
    { article: "B-02", name: "Прокладка тестовая", quantity: 3, unit: "упак", price: 50.5 },
  ],
};

describe("invoice autofill", () => {
  it("fills the selected main invoice with a leading-zero number, kopecks and the existing supplier name", () => {
    const result = buildInvoiceAutofill(syntheticInvoice, 1, [
      { id: "supplier-id", name: "ООО \"Тестовый поставщик\"", inn: "7701234567" },
    ]);
    expect(result.patch).toEqual({
      invoice_number: "00017",
      amount: 12345.67,
      contractor: "ООО \"Тестовый поставщик\"",
    });
    expect(result.matchedSupplier?.id).toBe("supplier-id");
    expect(result.items).toHaveLength(2);
  });

  it("targets only the selected secondary invoice and preserves all other invoice fields", () => {
    const result = buildInvoiceAutofill(syntheticInvoice, 2, []);
    expect(result.patch).toEqual({ invoice_number_2: "00017", amount_2: 12345.67 });
    expect(result.patch).not.toHaveProperty("invoice_number");
    expect(result.patch).not.toHaveProperty("amount");
    expect(result.patch).not.toHaveProperty("contractor");
  });

  it("keeps extracted item name, quantity, unit and price", () => {
    expect(normalizeRecognizedItems(syntheticInvoice.items)).toEqual([
      { article: "A-01", name: "Фильтр тестовый", quantity: 2, unit: "шт", price: 1000.25 },
      { article: "B-02", name: "Прокладка тестовая", quantity: 3, unit: "упак", price: 50.5 },
    ]);
  });

  it("does not duplicate positions when the same file is recognized again", () => {
    const first = mergeRecognizedItems([], normalizeRecognizedItems(syntheticInvoice.items));
    const second = mergeRecognizedItems(first.items, normalizeRecognizedItems(syntheticInvoice.items));
    expect(first.added).toBe(2);
    expect(second.added).toBe(0);
    expect(second.items).toHaveLength(2);
  });

  it("preserves manual positions and merges only missing occurrences", () => {
    const manual: RequestItem = { article: "Ручная", name: "Ручная позиция", quantity: 1, unit: "шт", price: 10 };
    const first = mergeRecognizedItems([manual], normalizeRecognizedItems(syntheticInvoice.items));
    const second = mergeRecognizedItems(first.items, normalizeRecognizedItems(syntheticInvoice.items));
    expect(second.items[0]).toEqual(manual);
    expect(second.items).toHaveLength(3);
  });

  it("reports only filled fields and the actual number of added items", () => {
    const result = buildInvoiceAutofill(syntheticInvoice, 1, []);
    expect(invoiceAutofillMessage(result, 0, 2)).toBe(
      "Заполнено: номер счёта, стоимость, контрагент. Новых позиций нет — они уже добавлены",
    );
  });

  it("clearly reports missing values in a partial result", () => {
    const result = buildInvoiceAutofill({ invoice_number: "00018", items: [] }, 1, []);
    expect(invoiceAutofillMessage(result, 0, 0)).toBe(
      "Заполнено: номер счёта. Не найдено: итоговая сумма, контрагент, позиции",
    );
  });

  it("supports contractor matching by normalized legal name without an INN", () => {
    const result = buildInvoiceAutofill({ ...syntheticInvoice, supplier_inn: null }, 1, [
      { id: "supplier-id", name: "ООО \"Тестовый поставщик\"" },
    ]);
    expect(result.patch.contractor).toBe("ООО \"Тестовый поставщик\"");
    expect(result.matchedSupplier?.id).toBe("supplier-id");
  });
});
