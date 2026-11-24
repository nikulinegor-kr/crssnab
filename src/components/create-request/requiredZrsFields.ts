import type { FieldErrors } from "react-hook-form";
import type { RefinementCtx } from "zod";
import type { RequestZrsValues } from "@/lib/requestZrs";
import { REQUEST_SECTION_OPEN_EVENT } from "./FormSectionCard";

export function validateRequiredZrsFields(values: RequestZrsValues, ctx: RefinementCtx) {
  const required = [
    ["executor", !values.executor?.trim(), "Укажите исполнителя"],
    ["availability_delivery_time", !values.availability_delivery_time?.trim(), "Выберите наличие"],
    ["estimated_delivery_days", values.estimated_delivery_days == null, "Укажите срок доставки в днях"],
    ["payment_percentage", values.payment_percentage == null, "Укажите процент предоплаты"],
  ] as const;
  for (const [field, missing, message] of required) {
    if (missing) ctx.addIssue({ code: "custom", path: [field], message });
  }
}

export function revealRequestErrors(errors: FieldErrors) {
  if (errors.availability_delivery_time || errors.payment_percentage) {
    window.dispatchEvent(new CustomEvent(REQUEST_SECTION_OPEN_EVENT, { detail: "req-sec-invoice" }));
  }
  if (errors.estimated_delivery_days) {
    window.dispatchEvent(new CustomEvent(REQUEST_SECTION_OPEN_EVENT, { detail: "req-sec-logistics" }));
  }
}
