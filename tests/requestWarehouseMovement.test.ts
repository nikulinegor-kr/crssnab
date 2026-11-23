import { expect, test } from "bun:test";
import { requestMovementEntries, requestReceiptEntries, type RequestWarehouseLedgerRow } from "../src/lib/requestWarehouseMovement";

test("shows old and partial receipts with the recorded receiver and warehouse", () => {
  const receipts = requestReceiptEntries(
    [{ id: "legacy", document_id: "receipt-1", received_at: "2026-11-22T04:00:00Z", receiver_name: "Иванов", warehouse: { name: "Склад А" } }],
    [
      { id: "batch", document_id: "receipt-2", created_at: "2026-11-23T04:00:00Z", receiver_name: "Петрова", warehouse: { name: "Склад Б" } },
      { id: "defect", document_id: null, created_at: "2026-11-23T05:00:00Z", receiver_name: "Петрова", warehouse: { name: "Склад Б" } },
    ],
  );
  expect(receipts.map(({ id, receiver, warehouse, documentId }) => [id, receiver, warehouse, documentId])).toEqual([
    ["defect", "Петрова", "Склад Б", null],
    ["batch", "Петрова", "Склад Б", "receipt-2"],
    ["legacy", "Иванов", "Склад А", "receipt-1"],
  ]);
});

const base: RequestWarehouseLedgerRow = {
  id: 1,
  operation: "move_out",
  delta: -2,
  created_at: "2026-11-23T05:00:00Z",
  warehouse: { name: "Склад А" },
  cell: { code: "А-01" },
  item: { name: "Фильтр", unit: "шт" },
  line: { destination: { name: "Склад Б" }, destination_cell: { code: "Б-03" } },
  document: { recipient_name: null, object: null, equipment: null },
};

test("a transfer appears only once and has both its source and destination", () => {
  const [transfer] = requestMovementEntries([base, { ...base, id: 2, operation: "move_in", delta: 2 }]);
  expect(requestMovementEntries([base, { ...base, id: 2, operation: "move_in", delta: 2 }])).toHaveLength(1);
  expect(transfer).toMatchObject({ title: "Перемещение", route: "Склад А · А-01 → Склад Б · Б-03", item: "Фильтр", quantity: 2 });
});

test("an issue identifies the recipient and target and returns use the actual ledger warehouse", () => {
  const issue = { ...base, operation: "issue", document: { ...base.document, recipient_name: "Иванов", object: { name: "Производственная база" } } };
  const returned = { ...base, id: 2, operation: "return", delta: 1, warehouse: { name: "Склад Б" }, cell: null, line: null };
  expect(requestMovementEntries([issue, returned]).map(event => [event.title, event.route, event.quantity])).toEqual([
    ["Возврат на склад", "Склад Б", 1],
    ["Выдача", "Склад А · А-01 → Иванов · Производственная база", 2],
  ]);
});
