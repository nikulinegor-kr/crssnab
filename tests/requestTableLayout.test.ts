import { describe, expect, test } from "bun:test";
import { DEFAULT_COLUMN_VISIBILITY } from "../src/components/requests/TableColumnSettings";
import { DEFAULT_COLUMN_WIDTHS } from "../src/hooks/useTableColumnWidths";
import { calculateRequestTableLayout } from "../src/lib/requestTableLayout";

const allVisible = Object.fromEntries(
  Object.keys(DEFAULT_COLUMN_VISIBILITY).map((key) => [key, true]),
) as typeof DEFAULT_COLUMN_VISIBILITY;

describe("request table fluid layout", () => {
  test("keeps fixed service columns and distributes all extra width by slider proportions", () => {
    const preferred = { ...DEFAULT_COLUMN_WIDTHS, description: 300, comments: 100 };
    const base = calculateRequestTableLayout(0, preferred, allVisible);
    const layout = calculateRequestTableLayout(base.baseWidth + 400, preferred, allVisible);

    expect(layout.tableWidth).toBe(base.baseWidth + 400);
    expect(layout.widths.description).toBe(600);
    expect(layout.widths.comments).toBe(200);
    expect(layout.widths.status).toBe(preferred.status);
    expect(layout.widths.amount).toBe(preferred.amount);
    expect(layout.fillerWidth).toBe(0);
  });

  test("gives all extra width to the only visible text column", () => {
    const visibility = { ...allVisible, comments: false };
    const base = calculateRequestTableLayout(0, DEFAULT_COLUMN_WIDTHS, visibility);
    const layout = calculateRequestTableLayout(base.baseWidth + 275, DEFAULT_COLUMN_WIDTHS, visibility);

    expect(layout.widths.description).toBe(DEFAULT_COLUMN_WIDTHS.description + 275);
    expect(layout.tableWidth).toBe(base.baseWidth + 275);
    expect(layout.fillerWidth).toBe(0);
  });

  test("extends rows with a filler when both text columns are hidden", () => {
    const visibility = { ...allVisible, description: false, comments: false };
    const base = calculateRequestTableLayout(0, DEFAULT_COLUMN_WIDTHS, visibility);
    const layout = calculateRequestTableLayout(base.baseWidth + 320, DEFAULT_COLUMN_WIDTHS, visibility);

    expect(layout.fillerWidth).toBe(320);
    expect(layout.tableWidth).toBe(base.baseWidth + 320);
    expect(layout.widths.delivery_date).toBe(DEFAULT_COLUMN_WIDTHS.delivery_date);
  });

  test("uses preferred widths and inner scrolling when space is insufficient", () => {
    const base = calculateRequestTableLayout(0, DEFAULT_COLUMN_WIDTHS, allVisible);
    const layout = calculateRequestTableLayout(base.baseWidth - 500, DEFAULT_COLUMN_WIDTHS, allVisible);

    expect(layout.tableWidth).toBe(base.baseWidth);
    expect(layout.baseWidth).toBe(base.baseWidth);
    expect(layout.widths).toEqual(DEFAULT_COLUMN_WIDTHS);
    expect(layout.fillerWidth).toBe(0);
  });
});
