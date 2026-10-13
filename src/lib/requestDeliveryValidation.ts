import { supabase } from "@/integrations/supabase/client";

export const DELIVERED_STATUS = "Доставлено";

type Dates = { shipment_date?: string | null; delivery_date?: string | null; actual_arrival_date?: string | null };

/** Возвращает текст ошибки, если для «Доставлено» не хватает дат выхода и прихода. */
export function deliveryDatesError(r: Dates | null | undefined): string | null {
  const missing: string[] = [];
  if (!r?.shipment_date) missing.push("дату выхода (отгрузки)");
  if (!r?.delivery_date && !r?.actual_arrival_date) missing.push("дату прихода");
  return missing.length ? `Укажите ${missing.join(" и ")}, чтобы поставить «Доставлено»` : null;
}

/** Проверяет заявки в базе; возвращает id заявок, у которых не хватает дат. */
export async function findRequestsMissingDeliveryDates(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("requests")
    .select("id, shipment_date, delivery_date, actual_arrival_date")
    .in("id", ids);
  if (error) throw error;
  return (data ?? []).filter((r: any) => deliveryDatesError(r)).map((r: any) => r.id);
}
