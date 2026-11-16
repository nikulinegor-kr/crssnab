export type RequestInvoiceSlot = 1 | 2 | 3;

export type RequestInvoiceRecord = {
  amount?: number | null;
  amount_2?: number | null;
  amount_3?: number | null;
  invoice_number?: string | null;
  invoice_number_2?: string | null;
  invoice_number_3?: string | null;
  invoice_date?: string | null;
  contractor?: string | null;
};

export function getRequestInvoiceRequisites(request: RequestInvoiceRecord, slot: RequestInvoiceSlot = 1) {
  if (slot === 2) {
    return {
      amount: request.amount_2 ?? null,
      invoiceNumber: request.invoice_number_2 ?? null,
      // В текущей модели контрагент принадлежит только основному счёту.
      contractor: null,
    };
  }
  if (slot === 3) {
    return {
      amount: request.amount_3 ?? null,
      invoiceNumber: request.invoice_number_3 ?? null,
      contractor: null,
    };
  }
  return {
    amount: request.amount ?? null,
    invoiceNumber: request.invoice_number ?? null,
    contractor: request.contractor ?? null,
  };
}

/** Сброс основного счёта не затрагивает дату, файлы, оплату и дополнительные счета. */
export function getInvoiceResetPatch(slot: RequestInvoiceSlot = 1): Record<string, null> {
  if (slot === 2) return { amount_2: null, invoice_number_2: null };
  if (slot === 3) return { amount_3: null, invoice_number_3: null };
  return { amount: null, invoice_number: null, contractor: null };
}

/** Удаление счёта не удаляет связанные документы и другие счета. */
export function getInvoiceDeletePatch(slot: RequestInvoiceSlot = 1): Record<string, null> {
  if (slot === 1) return { ...getInvoiceResetPatch(1), invoice_date: null };
  return getInvoiceResetPatch(slot);
}

export function hasInvoiceRequisites(request: RequestInvoiceRecord, slot: RequestInvoiceSlot = 1): boolean {
  const values = getRequestInvoiceRequisites(request, slot);
  return values.amount != null || Boolean(values.invoiceNumber?.trim()) || Boolean(values.contractor?.trim());
}
