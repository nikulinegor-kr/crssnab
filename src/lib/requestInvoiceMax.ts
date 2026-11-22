export const REQUESTS_MAX_CHAT_ID = "-75086506652357";

export type RequestInvoiceMaxInput = {
  id: string;
  organization_id: string;
  description?: string | null;
};

export function requestInvoiceDisplayName(url: string, description?: string | null): string {
  const fromUrl = decodeURIComponent(url.split("?")[0].split("/").pop() || "").trim();
  if (fromUrl) return fromUrl;
  const title = description?.trim() || "Заявка";
  return `${title}-счёт.pdf`;
}

export function selectRequestInvoiceUrl(
  documentUrls: Array<string | null | undefined> | null | undefined,
  legacyDocumentUrl?: string | null,
): string | null {
  const urls = (documentUrls ?? []).filter((url): url is string => Boolean(url?.trim()));
  if (!urls.length && legacyDocumentUrl?.trim()) urls.push(legacyDocumentUrl);
  if (!urls.length) return null;
  return [...urls].reverse().find((url) => url.toLowerCase().includes("zrs")) ?? urls[urls.length - 1];
}

export function buildRequestInvoiceMaxPayload(
  request: RequestInvoiceMaxInput,
  documentUrl: string,
  fileName = requestInvoiceDisplayName(documentUrl, request.description),
) {
  return {
    chat_id: REQUESTS_MAX_CHAT_ID,
    text: `Счёт — ${request.description?.trim() || "Заявка"}`,
    organization_id: request.organization_id,
    request_id: request.id,
    document_url: documentUrl,
    file_name: fileName,
    document_only: true,
    mode: "legacy",
  } as const;
}

export function getRequestInvoiceMaxError(data: unknown): string | null {
  if (!data || typeof data !== "object") return "Сервис MAX вернул пустой ответ";
  const response = data as { ok?: boolean; delivered?: boolean; error?: string; response?: string };
  if (response.ok || response.delivered) return null;
  return response.error || response.response || "MAX не подтвердил доставку файла";
}
