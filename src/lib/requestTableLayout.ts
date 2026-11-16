import type { ColumnVisibility } from "@/components/requests/TableColumnSettings";
import type { ColumnWidths } from "@/hooks/useTableColumnWidths";

export const REQUEST_TABLE_ACTION_WIDTH = 40;

export interface RequestTableLayout {
  /** Фактические ширины колонок после распределения свободного места. */
  widths: ColumnWidths;
  /** Минимальная ширина: ниже неё работает внутренняя горизонтальная прокрутка. */
  baseWidth: number;
  /** Ширина всей таблицы, не меньше доступной ширины контейнера. */
  tableWidth: number;
  /** Продолжение строк, если обе текстовые колонки скрыты. */
  fillerWidth: number;
}

export const calculateRequestTableLayout = (
  containerWidth: number,
  preferredWidths: ColumnWidths,
  visibility: ColumnVisibility,
): RequestTableLayout => {
  const widths = { ...preferredWidths };
  const selectWidth = visibility.select === false ? 8 : 32;
  const baseWidth = (Object.keys(visibility) as Array<keyof ColumnVisibility>).reduce(
    (sum, key) => key !== "select" && visibility[key] ? sum + preferredWidths[key] : sum,
    selectWidth + REQUEST_TABLE_ACTION_WIDTH,
  );
  const availableWidth = Number.isFinite(containerWidth) ? Math.max(0, Math.floor(containerWidth)) : 0;
  const extraWidth = Math.max(0, availableWidth - baseWidth);
  const hasDescription = visibility.description;
  const hasComments = visibility.comments;
  let fillerWidth = 0;

  if (extraWidth > 0 && hasDescription && hasComments) {
    const preferredTotal = preferredWidths.description + preferredWidths.comments;
    const descriptionShare = preferredTotal > 0 ? preferredWidths.description / preferredTotal : 0.5;
    const descriptionExtra = Math.round(extraWidth * descriptionShare);
    widths.description += descriptionExtra;
    widths.comments += extraWidth - descriptionExtra;
  } else if (extraWidth > 0 && hasDescription) {
    widths.description += extraWidth;
  } else if (extraWidth > 0 && hasComments) {
    widths.comments += extraWidth;
  } else if (extraWidth > 0) {
    fillerWidth = extraWidth;
  }

  return {
    widths,
    baseWidth,
    tableWidth: baseWidth + extraWidth,
    fillerWidth,
  };
};
