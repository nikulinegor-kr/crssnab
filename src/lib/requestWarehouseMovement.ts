type Warehouse = { name: string } | null;
type Cell = { code: string } | null;

export type LegacyWarehouseReceipt = {
  id: string;
  document_id: string;
  received_at: string;
  receiver_name: string;
  warehouse: Warehouse;
};

export type WarehouseReceiptBatch = Omit<LegacyWarehouseReceipt, "document_id" | "received_at"> & {
  document_id: string | null;
  created_at: string;
};

export function requestReceiptEntries(legacy: LegacyWarehouseReceipt[], batches: WarehouseReceiptBatch[]) {
  return [...legacy, ...batches]
    .map(row => ({
      id: row.id,
      documentId: row.document_id,
      at: "received_at" in row ? row.received_at : row.created_at,
      receiver: row.receiver_name.trim() && row.receiver_name.trim() !== "—" ? row.receiver_name : "Не указан",
      warehouse: row.warehouse?.name ?? "Склад недоступен",
    }))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id));
}

export const REQUEST_WAREHOUSE_OPERATIONS = ["move_out", "issue", "return", "return_reversal"] as const;
type Operation = typeof REQUEST_WAREHOUSE_OPERATIONS[number];

export type RequestWarehouseLedgerRow = {
  id: number;
  operation: string;
  delta: number;
  created_at: string;
  warehouse: Warehouse;
  cell: Cell;
  item: { name: string; unit: string } | null;
  line: { destination: Warehouse; destination_cell: Cell } | null;
  document: {
    recipient_name: string | null;
    object: { name: string } | null;
    equipment: { model: string; plate_number: string | null } | null;
  };
};

const operationLabels: Record<Operation, string> = {
  move_out: "Перемещение",
  issue: "Выдача",
  return: "Возврат на склад",
  return_reversal: "Отмена возврата",
};

const place = (warehouse: Warehouse, cell: Cell) => [warehouse?.name ?? "Склад недоступен", cell?.code]
  .filter(Boolean).join(" · ");

export function requestMovementEntries(rows: RequestWarehouseLedgerRow[]) {
  return [...rows]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id)
    .flatMap(row => {
      const operation = REQUEST_WAREHOUSE_OPERATIONS.find(value => value === row.operation);
      if (!operation) return [];
      const warehouse = place(row.warehouse, row.cell);
      const { recipient_name, object, equipment } = row.document;
      const destinations = [
        recipient_name,
        object?.name,
        [equipment?.plate_number, equipment?.model].filter(Boolean).join(" · "),
      ].filter(Boolean);
      let route = warehouse;
      if (operation === "move_out") {
        route = `${warehouse} → ${place(row.line?.destination ?? null, row.line?.destination_cell ?? null)}`;
      } else if (operation === "issue" && destinations.length > 0) {
        route = `${warehouse} → ${destinations.join(" · ")}`;
      }
      return [{
        id: row.id,
        at: row.created_at,
        title: operationLabels[operation],
        route,
        item: row.item?.name ?? "Позиция недоступна",
        quantity: Math.abs(row.delta),
        unit: row.item?.unit ?? "",
      }];
    });
}
