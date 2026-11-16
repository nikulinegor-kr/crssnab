export interface RequestDateSortable {
  request_date?: string | null;
}

const requestTime = (value?: string | null) => {
  if (!value) return Number.NEGATIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
};

/** Единый порядок реестра: сначала новые заявки, пустые даты — в конце. */
export const compareRequestsByDateDesc = (
  a: RequestDateSortable,
  b: RequestDateSortable,
) => requestTime(b.request_date) - requestTime(a.request_date);

export const sortRequestsByDateDesc = <T extends RequestDateSortable>(
  requests: readonly T[] | undefined,
): T[] => [...(requests ?? [])].sort(compareRequestsByDateDesc);
