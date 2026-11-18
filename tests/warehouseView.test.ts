import { describe, expect, test } from "bun:test";
import {
  warehouseStockRows,
  warehouseSummary,
  filterWarehouseStock,
} from "../src/lib/warehouseView";
import type { WhUnit, WhBalance } from "../src/components/warehouse-qr/types";
const unit = (id: string, measure = "шт", product = "p"): WhUnit => ({
  id,
  name: `Товар ${id}`,
  unit: measure,
  product_id: product,
  kind: "batch",
  qr_token: `qr-${id}`,
  serial_number: null,
  batch_number: "Партия",
  created_at: "",
});
const balance = (id: string, qty: number, warehouse = "a"): WhBalance => ({
  id,
  unit_id: id,
  warehouse_id: warehouse,
  quantity: qty,
  cell_id: null,
});
const product = {
  id: "p",
  article: "A-01",
  category: "Расходники",
  min_stock: 5,
  unit: "шт",
};
describe("Warehouse presentation", () => {
  test("minimum compares combined product batches only in the chosen warehouse", () => {
    const rows = warehouseStockRows(
      [unit("1"), unit("2")],
      [
        balance("1", 2),
        balance("1", 1),
        balance("2", 2),
        balance("1", 100, "b"),
      ],
      [product],
      "a",
    );
    expect(rows.map((row) => row.quantity)).toEqual([3, 2]);
    expect(rows.map((row) => row.stock)).toEqual(["normal", "normal"]);
  });
  test("a low product is counted once across its batches", () => {
    const rows = warehouseStockRows(
      [unit("1"), unit("2")],
      [balance("1", 1), balance("2", 2)],
      [product],
      "a",
    );
    expect(rows.every((row) => row.stock === "low")).toBe(true);
    expect(warehouseSummary(rows).low).toBe(1);
  });
  test("mixed measurements are never compared or combined", () => {
    const rows = warehouseStockRows(
      [unit("1"), unit("2", "л")],
      [balance("1", 2), balance("2", 3)],
      [product],
      "a",
    );
    expect(rows.every((row) => row.stock === "unknown")).toBe(true);
    expect(warehouseSummary(rows).amounts).toEqual([
      ["шт", 2],
      ["л", 3],
    ]);
  });
  test("missing and zero minimums do not invent a normal status", () => {
    for (const minimum of [null, 0]) {
      expect(
        warehouseStockRows(
          [unit("1")],
          [balance("1", 2)],
          [{ ...product, min_stock: minimum }],
          "a",
        )[0].stock,
      ).toBe("unknown");
    }
  });
  test("zero, depleted and other warehouse units are excluded", () => {
    expect(
      warehouseStockRows(
        [unit("1"), unit("2")],
        [balance("1", 0), balance("2", 10, "b")],
        [product],
        "a",
      ),
    ).toEqual([]);
  });
  test("category, stock and all search terms apply together, including QR", () => {
    const rows = warehouseStockRows(
      [unit("1")],
      [balance("1", 2)],
      [product],
      "a",
    );
    expect(
      filterWarehouseStock(rows, "товар A-01 qr-1", "low", "Расходники"),
    ).toHaveLength(1);
    expect(filterWarehouseStock(rows, "", "normal", "all")).toHaveLength(0);
    expect(filterWarehouseStock(rows, "", "all", "Другое")).toHaveLength(0);
  });
});
