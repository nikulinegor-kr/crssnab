import { formatCompanyName, normalizeForComparison } from "@/lib/companyFormat";
import type { RequestInvoiceSlot } from "@/lib/requestInvoices";

export interface RequestItem {
  article: string;
  name: string;
  quantity: number;
  unit: string;
  price: number | null;
}

export interface InvoiceSupplier {
  id: string;
  name: string;
  inn?: string | null;
}

export interface RecognizedInvoiceItem {
  article?: unknown;
  name?: unknown;
  quantity?: unknown;
  qty?: unknown;
  unit?: unknown;
  price?: unknown;
}

export interface RecognizedInvoice {
  contractor?: unknown;
  supplier_name?: unknown;
  supplier_inn?: unknown;
  invoice_number?: unknown;
  amount?: unknown;
  total_amount?: unknown;
  items?: RecognizedInvoiceItem[] | null;
  preparation?: unknown;
}

export interface InvoiceAutofillResult {
  patch: Record<string, string | number>;
  filledFields: string[];
  missing: string[];
  contractorName: string | null;
  contractorInn: string | null;
  matchedSupplier: InvoiceSupplier | null;
  items: RequestItem[];
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function normalizeInvoiceAmount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const normalized = typeof value === "string"
    ? value.replace(/\s/g, "").replace(",", ".")
    : value;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : null;
}

function normalizedQuantity(value: unknown): number {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

export function normalizeRecognizedItems(items: RecognizedInvoice["items"]): RequestItem[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    const name = text(item?.name);
    if (!name) return [];
    return [{
      article: text(item.article),
      name,
      quantity: normalizedQuantity(item.quantity ?? item.qty),
      unit: text(item.unit) || "шт",
      price: normalizeInvoiceAmount(item.price),
    }];
  });
}

function comparableCompanyName(value: string): string {
  return normalizeForComparison(formatCompanyName(value))
    .replace(/["«»'’().\-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchInvoiceSupplier(
  contractor: string,
  inn: string,
  suppliers: InvoiceSupplier[] = [],
): InvoiceSupplier | null {
  if (inn) {
    const byInn = suppliers.find((supplier) => supplier.inn?.replace(/\D/g, "") === inn.replace(/\D/g, ""));
    if (byInn) return byInn;
  }
  if (!contractor) return null;
  const normalized = comparableCompanyName(contractor);
  return suppliers.find((supplier) => {
    const candidate = comparableCompanyName(supplier.name);
    return candidate === normalized || (
      normalized.length >= 5 && candidate.length >= 5 &&
      (candidate.includes(normalized) || normalized.includes(candidate))
    );
  }) ?? null;
}

export function getInvoiceSlotFields(slot: RequestInvoiceSlot) {
  if (slot === 2) return { number: "invoice_number_2", amount: "amount_2" } as const;
  if (slot === 3) return { number: "invoice_number_3", amount: "amount_3" } as const;
  return { number: "invoice_number", amount: "amount" } as const;
}

export function buildInvoiceAutofill(
  data: RecognizedInvoice,
  slot: RequestInvoiceSlot,
  suppliers: InvoiceSupplier[] = [],
): InvoiceAutofillResult {
  const patch: Record<string, string | number> = {};
  const filledFields: string[] = [];
  const missing: string[] = [];
  const fields = getInvoiceSlotFields(slot);
  const invoiceNumber = text(data?.invoice_number);
  const amount = normalizeInvoiceAmount(data?.amount ?? data?.total_amount);
  const rawContractor = text(data?.contractor ?? data?.supplier_name);
  const contractorName = rawContractor ? formatCompanyName(rawContractor) : null;
  const contractorInn = text(data?.supplier_inn) || null;
  const matchedSupplier = matchInvoiceSupplier(contractorName ?? "", contractorInn ?? "", suppliers);

  if (invoiceNumber) {
    patch[fields.number] = invoiceNumber;
    filledFields.push("номер счёта");
  } else {
    missing.push("номер счёта");
  }

  if (amount != null) {
    patch[fields.amount] = amount;
    filledFields.push("стоимость");
  } else {
    missing.push("итоговая сумма");
  }

  if (slot === 1) {
    if (matchedSupplier) {
      patch.contractor = matchedSupplier.name;
      filledFields.push("контрагент");
    } else if (contractorName) {
      patch.contractor = contractorName;
      filledFields.push("контрагент");
    } else {
      missing.push("контрагент");
    }
  }

  const items = normalizeRecognizedItems(data?.items);
  if (!items.length) missing.push("позиции");

  return { patch, filledFields, missing, contractorName, contractorInn, matchedSupplier, items };
}

function itemSignature(item: RequestItem): string {
  return JSON.stringify([
    item.article.trim().toLocaleLowerCase("ru"),
    item.name.trim().toLocaleLowerCase("ru"),
    item.quantity,
    (item.unit || "шт").trim().toLocaleLowerCase("ru"),
    item.price ?? null,
  ]);
}

/** Adds only missing occurrences, preserving manual rows and repeated identical invoice rows. */
export function mergeRecognizedItems(existing: RequestItem[], recognized: RequestItem[]) {
  const counts = new Map<string, number>();
  for (const item of existing) {
    const signature = itemSignature(item);
    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }

  const additions: RequestItem[] = [];
  for (const item of recognized) {
    const signature = itemSignature(item);
    const existingCount = counts.get(signature) ?? 0;
    const recognizedCount = additions.filter((candidate) => itemSignature(candidate) === signature).length + 1;
    if (recognizedCount <= existingCount) continue;
    additions.push(item);
  }

  return { items: [...existing, ...additions], added: additions.length };
}

export function invoiceAutofillMessage(
  result: Pick<InvoiceAutofillResult, "filledFields" | "missing">,
  addedItems: number,
  recognizedItems: number,
) {
  const parts: string[] = [];
  if (result.filledFields.length) parts.push(`Заполнено: ${result.filledFields.join(", ")}`);
  if (addedItems > 0) parts.push(`Добавлено позиций: ${addedItems}`);
  else if (recognizedItems > 0) parts.push("Новых позиций нет — они уже добавлены");
  if (result.missing.length) parts.push(`Не найдено: ${result.missing.join(", ")}`);
  return parts.join(". ");
}
