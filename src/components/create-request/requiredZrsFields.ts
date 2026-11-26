import type { FieldErrors } from "react-hook-form";
import type { RefinementCtx } from "zod";
import type { RequestZrsValues } from "@/lib/requestZrs";
import { REQUEST_SECTION_OPEN_EVENT } from "./FormSectionCard";

export const PAYMENT_REQUIRED_STATUSES = new Set([
  "Готов к отгрузке", "В пути", "Доставлено в ТК", "Доставлено", "В работе",
]);

type RequestValidationValues = RequestZrsValues & {
  status?: string;
  contractor?: string | null;
  invoice_number?: string | null;
  invoice_number_2?: string | null;
  invoice_number_3?: string | null;
  amount?: number | null;
  amount_2?: number | null;
  amount_3?: number | null;
  payment_percent?: number | null;
  shipment_date?: string;
  delivery_date?: string;
};

export function hasAddedInvoice(values: RequestValidationValues, hasFile: boolean) {
  return hasFile || Boolean(values.invoice_number?.trim() || values.invoice_number_2?.trim() || values.invoice_number_3?.trim())
    || values.amount != null || values.amount_2 != null || values.amount_3 != null;
}

export function validateRequiredZrsFields(values: RequestValidationValues, ctx: RefinementCtx, hasFile: boolean, requireAvailability = true) {
  const required = [
    ["applicant_justification", !values.justification_not_required && !values.applicant_justification?.trim(), "Укажите обоснование заявки"],
    ["executor", !values.executor?.trim(), "Укажите исполнителя"],
    ["availability_delivery_time", requireAvailability && !values.availability_delivery_time?.trim(), "Выберите наличие"],
  ] as const;
  for (const [field, missing, message] of required) {
    if (missing) ctx.addIssue({ code: "custom", path: [field], message });
  }
  if (hasAddedInvoice(values, hasFile)) {
    if (!values.contractor?.trim()) ctx.addIssue({ code: "custom", path: ["contractor"], message: "Укажите контрагента" });
    if (values.estimated_delivery_days == null) ctx.addIssue({ code: "custom", path: ["estimated_delivery_days"], message: "Укажите срок доставки в днях" });
    if (values.payment_percentage == null) ctx.addIssue({ code: "custom", path: ["payment_percentage"], message: "Укажите процент предоплаты" });
    for (const [numberField, amountField] of [["invoice_number", "amount"], ["invoice_number_2", "amount_2"], ["invoice_number_3", "amount_3"]] as const) {
      if (numberField !== "invoice_number" && !values[numberField]?.trim() && values[amountField] == null) continue;
      if (!values[numberField]?.trim()) ctx.addIssue({ code: "custom", path: [numberField], message: "Укажите номер счёта" });
      if (values[amountField] == null) ctx.addIssue({ code: "custom", path: [amountField], message: "Укажите сумму счёта" });
    }
  }
  if (PAYMENT_REQUIRED_STATUSES.has(values.status ?? "") && values.payment_percent !== 50 && values.payment_percent !== 100) {
    ctx.addIssue({ code: "custom", path: ["payment_percent"], message: "Отметьте фактическую оплату 50% или 100%" });
  }
  if (values.status === "В пути") {
    if (!values.shipment_date) ctx.addIssue({ code: "custom", path: ["shipment_date"], message: "Укажите дату отгрузки" });
    if (!values.delivery_date) ctx.addIssue({ code: "custom", path: ["delivery_date"], message: "Укажите дату доставки" });
  }
}

export function revealRequestErrors(errors: FieldErrors) {
  if (errors.availability_delivery_time || errors.payment_percentage || errors.payment_percent ||
      errors.contractor || errors.invoice_number || errors.invoice_number_2 || errors.invoice_number_3 ||
      errors.amount || errors.amount_2 || errors.amount_3) {
    window.dispatchEvent(new CustomEvent(REQUEST_SECTION_OPEN_EVENT, { detail: "req-sec-invoice" }));
  }
  if (errors.estimated_delivery_days || errors.shipment_date || errors.delivery_date) {
    window.dispatchEvent(new CustomEvent(REQUEST_SECTION_OPEN_EVENT, { detail: "req-sec-logistics" }));
  }
}
