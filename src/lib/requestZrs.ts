export interface RequestZrsValues {
  request_date?: string | null;
  description?: string | null;
  applicant?: string | null;
  priority?: string | null;
  availability_delivery_time?: string | null;
  estimated_delivery_days?: number | null;
  payment_percentage?: number | null;
  executor?: string | null;
}

/** Shared lines for the ZRS preview, clipboard text and generated PDF. */
export function buildRequestZrsLines(values: RequestZrsValues, objectName?: string | null): string[] {
  const requestDate = values.request_date
    ? new Date(values.request_date).toLocaleDateString("ru-RU")
    : "-";

  return [
    `Дата заявки: ${requestDate}`,
    `Объект: ${objectName || "-"}`,
    `Заявка: ${values.description || "-"}`,
    `Заявитель: ${values.applicant || "-"}`,
    `Приоритет: ${values.priority || "-"}`,
    `Наличие: ${values.availability_delivery_time || "-"}`,
    `Срок доставки: ${values.estimated_delivery_days ? `${values.estimated_delivery_days} дн.` : "-"}`,
    `Оплата: ${values.payment_percentage ?? 0}%`,
    `Исполнил: ${values.executor || "-"}`,
  ];
}
