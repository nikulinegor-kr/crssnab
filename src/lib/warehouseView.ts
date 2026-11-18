import type { WhBalance, WhUnit } from "@/components/warehouse-qr/types";

export interface WarehouseProduct {
  id: string;
  article: string | null;
  category: string | null;
  min_stock: number | null;
  unit: string | null;
}

export interface WarehouseStockRow {
  unit: WhUnit;
  quantity: number;
  article: string;
  category: string;
  stock: "normal" | "low" | "unknown";
  minimum: number | null;
}

/** A product's minimum applies to all its batches in this warehouse together. */
export function warehouseStockRows(
  units: WhUnit[],
  balances: WhBalance[],
  products: WarehouseProduct[],
  warehouseId: string,
): WarehouseStockRow[] {
  const quantities = new Map<string, number>();
  for (const balance of balances) {
    if (balance.warehouse_id !== warehouseId) continue;
    quantities.set(
      balance.unit_id,
      (quantities.get(balance.unit_id) ?? 0) + Number(balance.quantity),
    );
  }
  const productMap = new Map(products.map((product) => [product.id, product]));
  const productTotals = new Map<string, number>();
  const productUnits = new Map<string, Set<string>>();
  for (const unit of units) {
    const quantity = quantities.get(unit.id) ?? 0;
    if (!unit.product_id || quantity <= 0) continue;
    productTotals.set(
      unit.product_id,
      (productTotals.get(unit.product_id) ?? 0) + quantity,
    );
    const measures = productUnits.get(unit.product_id) ?? new Set<string>();
    measures.add(unit.unit);
    productUnits.set(unit.product_id, measures);
  }
  return units.flatMap<WarehouseStockRow>((unit) => {
    const quantity = quantities.get(unit.id) ?? 0;
    if (quantity <= 0) return [];
    const product = productMap.get(unit.product_id ?? "");
    const minimum = product?.min_stock;
    const comparable =
      product != null &&
      minimum != null &&
      minimum > 0 &&
      productUnits.get(product.id)?.size === 1 &&
      (!product.unit || product.unit === unit.unit);
    return [
      {
        unit,
        quantity,
        article: product?.article ?? "",
        category: product?.category ?? "",
        minimum: comparable ? minimum : null,
        stock: comparable
          ? (productTotals.get(product.id) ?? 0) < minimum
            ? "low"
            : "normal"
          : "unknown",
      },
    ];
  });
}

export function warehouseSummary(rows: WarehouseStockRow[]) {
  const amounts = new Map<string, number>();
  const lowProducts = new Set<string>();
  for (const row of rows) {
    amounts.set(
      row.unit.unit,
      (amounts.get(row.unit.unit) ?? 0) + row.quantity,
    );
    if (row.stock === "low")
      lowProducts.add(row.unit.product_id ?? row.unit.id);
  }
  return {
    positions: rows.length,
    low: lowProducts.size,
    amounts: [...amounts.entries()],
  };
}

export function filterWarehouseStock(
  rows: WarehouseStockRow[],
  search: string,
  stock: string,
  category: string,
) {
  const terms = search
    .trim()
    .toLocaleLowerCase("ru")
    .split(/\s+/)
    .filter(Boolean);
  return rows.filter(
    (row) =>
      (stock === "all" || row.stock === stock) &&
      (category === "all" || row.category === category) &&
      terms.every((term) =>
        [
          row.unit.name,
          row.article,
          row.unit.serial_number,
          row.unit.batch_number,
          row.unit.qr_token,
        ]
          .join(" ")
          .toLocaleLowerCase("ru")
          .includes(term),
      ),
  );
}
