import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  buildRequestInvoiceMaxPayload,
  getRequestInvoiceMaxError,
  type RequestInvoiceMaxInput,
} from "@/lib/requestInvoiceMax";

export async function sendRequestInvoiceToMax(request: RequestInvoiceMaxInput, documentUrl: string) {
  if (!request.id || !request.organization_id) {
    throw new Error("Не удалось определить заявку или организацию");
  }
  if (!documentUrl) {
    throw new Error("Сначала прикрепите и сохраните файл счёта");
  }

  const { data, error } = await supabase.functions.invoke("max-direct-send", {
    body: buildRequestInvoiceMaxPayload(request, documentUrl),
  });

  if (error) {
    const details = error instanceof FunctionsHttpError
      ? await error.context.text()
      : error.message;
    throw new Error(details || "Не удалось отправить счёт в MAX");
  }

  const deliveryError = getRequestInvoiceMaxError(data);
  if (deliveryError) throw new Error(deliveryError);
  return data;
}
