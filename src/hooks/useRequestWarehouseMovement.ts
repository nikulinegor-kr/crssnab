import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { warehouseRows } from "@/lib/simpleWarehouse";
import {
  REQUEST_WAREHOUSE_OPERATIONS,
  requestMovementEntries,
  requestReceiptEntries,
  type LegacyWarehouseReceipt,
  type RequestWarehouseLedgerRow,
  type WarehouseReceiptBatch,
} from "@/lib/requestWarehouseMovement";

async function loadReceipts(organizationId: string, requestId: string, signal: AbortSignal) {
  const [legacy, batches] = await Promise.all([
    warehouseRows<LegacyWarehouseReceipt>((from, to) => supabase.from("warehouse_request_receipts")
      .select("id,document_id,received_at,receiver_name,warehouse:warehouses!warehouse_request_receipts_warehouse_id_fkey(name)")
      .eq("organization_id", organizationId).eq("request_id", requestId)
      .order("id").range(from, to).abortSignal(signal)),
    warehouseRows<WarehouseReceiptBatch>((from, to) => supabase.from("warehouse_receipt_batches")
      .select("id,document_id,created_at,receiver_name,warehouse:warehouses!warehouse_receipt_batches_warehouse_id_fkey(name)")
      .eq("organization_id", organizationId).eq("request_id", requestId)
      .order("id").range(from, to).abortSignal(signal)),
  ]);
  return requestReceiptEntries(legacy, batches);
}

async function forIdChunks<T>(ids: string[], load: (chunk: string[]) => Promise<T[]>) {
  const rows: T[] = [];
  for (let index = 0; index < ids.length; index += 100) {
    rows.push(...await load(ids.slice(index, index + 100)));
  }
  return rows;
}

async function loadMovements(organizationId: string, documentIds: string[], signal: AbortSignal) {
  // Receipt document lines also identify older accepted units without source_request_id.
  const accepted = await forIdChunks(documentIds, chunk => warehouseRows<{ unit_id: string }>(
    (from, to) => supabase.from("warehouse_document_lines")
      .select("unit_id").eq("organization_id", organizationId).in("document_id", chunk)
      .order("id").range(from, to).abortSignal(signal),
  ));
  const unitIds = [...new Set(accepted.map(line => line.unit_id))];
  const rows = await forIdChunks(unitIds, chunk => warehouseRows<RequestWarehouseLedgerRow>(
    (from, to) => supabase.from("warehouse_ledger").select(`
      id, operation, delta, created_at,
      warehouse:warehouses!warehouse_ledger_warehouse_id_fkey(name),
      cell:warehouse_cells!warehouse_ledger_cell_id_fkey(code),
      item:warehouse_units!warehouse_ledger_unit_id_fkey(name, unit),
      line:warehouse_document_lines!warehouse_ledger_line_id_fkey(
        destination:warehouses!warehouse_document_lines_to_warehouse_id_fkey(name),
        destination_cell:warehouse_cells!warehouse_document_lines_to_cell_id_fkey(code)
      ),
      document:warehouse_documents!warehouse_ledger_document_id_fkey!inner(
        status, recipient_name,
        object:request_objects!warehouse_documents_object_id_fkey(name),
        equipment:equipment!warehouse_documents_equipment_id_fkey(model, plate_number)
      )
    `).eq("organization_id", organizationId).eq("document.status", "posted")
      .in("unit_id", chunk).in("operation", REQUEST_WAREHOUSE_OPERATIONS)
      .order("id").range(from, to).abortSignal(signal),
  ));
  return requestMovementEntries(rows);
}

export function useRequestWarehouseMovement(organizationId: string | null, requestId: string, enabled: boolean) {
  // Existing warehouse operations invalidate this prefix after posting.
  const key = ["wh-qr", "request-movement", organizationId, requestId] as const;
  const receipts = useQuery({
    queryKey: [...key, "receipts"],
    queryFn: ({ signal }) => loadReceipts(organizationId!, requestId, signal),
    enabled: enabled && !!organizationId,
  });
  const documentIds = [...new Set(receipts.data?.flatMap(receipt => receipt.documentId ? [receipt.documentId] : []))].sort();
  const movements = useQuery({
    queryKey: [...key, "operations", documentIds],
    queryFn: ({ signal }) => loadMovements(organizationId!, documentIds, signal),
    enabled: enabled && !!organizationId && documentIds.length > 0,
  });
  return { receipts, movements, hasAcceptedStock: documentIds.length > 0 };
}
