import { supabase } from "@/integrations/supabase/client";
import { downloadBlob } from "@/lib/saveImage";
import { extractStoragePath } from "@/lib/storageUrl";

const tables = [
  "requests", "request_items", "request_shipments", "shipment_items", "request_activities",
  "request_objects", "request_participants", "request_priorities", "request_statuses",
  "suppliers", "supplier_lists", "supplier_list_items", "equipment",
  "planner_tasks", "planner_stages", "planner_task_comments", "planner_task_dependencies",
  "material_folders", "material_objects", "material_sections", "material_statements", "material_statement_items",
  "warehouses", "warehouse_products", "warehouse_cells", "warehouse_units", "warehouse_balances",
  "warehouse_damaged_balances", "warehouse_documents", "warehouse_document_lines", "warehouse_ledger",
  "warehouse_inventories", "warehouse_inventory_lines", "warehouse_issues", "warehouse_issue_returns",
  "warehouse_issue_usages", "warehouse_request_receipts", "warehouse_receipt_batches", "warehouse_receipt_batch_lines",
] as const;

type ExportRow = Record<string, unknown>;
const attachmentBuckets = new Set(["request-photos", "request-documents"]);
const pageSize = 500;

export async function exportOrganizationData(orgId: string, includeAttachments: boolean, progress: (message: string) => void) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Войдите в CRM, чтобы выгрузить данные");
  const { data: allowed, error: permissionError } = await supabase.rpc("user_is_org_admin", {
    _user_id: user.id, _org_id: orgId,
  });
  if (permissionError) throw permissionError;
  if (!allowed) throw new Error("Выгрузка доступна владельцу или администратору организации");

  const { data: organization, error: organizationError } = await supabase.from("organizations")
    .select("id,name").eq("id", orgId).single();
  if (organizationError) throw organizationError;

  const records: Record<string, ExportRow[]> = {};
  for (const [index, table] of tables.entries()) {
    progress(`Собираем данные · ${index + 1} из ${tables.length} разделов`);
    const rows: ExportRow[] = [];
    let cursor: string | number | undefined;
    while (true) {
      let query = supabase.from(table).select("*").eq("organization_id", orgId).order("id").limit(pageSize);
      if (cursor !== undefined) query = query.gt("id", cursor);
      const { data, error } = await query;
      if (error) throw new Error(`Раздел ${table} не выгружен: ${error.message}`);
      rows.push(...(data ?? []));
      if (!data || data.length < pageSize) break;
      cursor = data[data.length - 1].id;
    }
    records[table] = rows;
  }

  const cleanReference = (url: string) => extractStoragePath(url) ? url.split(/[?#]/, 1)[0] : url;
  const exportedRecords = Object.fromEntries(Object.entries(records).map(([key, rows]) => [
    key,
    rows.map(({ qr_token: _qrToken, ...row }) => Object.fromEntries(Object.entries(row).map(([field, value]) => [
      field,
      field.endsWith("_url") && typeof value === "string" ? cleanReference(value)
        : field.endsWith("_urls") && Array.isArray(value) ? value.map(url => typeof url === "string" ? cleanReference(url) : url)
        : value,
    ]))),
  ]));
  const exportedAt = new Date().toISOString();
  const name = `crss-${orgId.slice(0, 8)}-${exportedAt.slice(0, 10)}`;
  const snapshot = {
    format_version: 1, exported_at: exportedAt, organization,
    record_counts: Object.fromEntries(Object.entries(records).map(([key, rows]) => [key, rows.length])),
    records: exportedRecords,
  };
  if (!includeAttachments) {
    downloadBlob(new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }), `${name}.json`);
    return { unavailable: 0 };
  }

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const links = new Set<string>();
  for (const table of ["requests", "request_shipments"]) {
    for (const row of records[table]) {
      for (const field of ["photo_url", "document_url", "photo_urls", "document_urls"]) {
        const value = row[field];
        for (const url of Array.isArray(value) ? value : [value]) {
          if (typeof url === "string" && url.trim()) links.add(url);
        }
      }
    }
  }
  const files = new Map<string, string>();
  const manifest: { reference: string; file: string | null }[] = [];
  let index = 0;
  for (const link of links) {
    progress(`Скачиваем вложения · ${++index} из ${links.size}`);
    const path = extractStoragePath(link);
    let file: string | null = null;
    if (path && attachmentBuckets.has(path.bucket) && path.path.split("/").every(segment => segment && segment !== "." && segment !== ".." && !segment.includes("\\"))) {
      const key = `${path.bucket}/${path.path}`;
      file = files.get(key) ?? null;
      if (!file) {
        const { data, error } = await supabase.storage.from(path.bucket).download(path.path);
        if (!error && data) {
          file = `attachments/${key}`;
          zip.file(file, data);
          files.set(key, file);
        }
      }
    }
    // Signed query strings can contain temporary access tokens.
    manifest.push({ reference: link.split(/[?#]/, 1)[0], file });
  }
  zip.file("data.json", JSON.stringify({ ...snapshot, attachments: manifest }, null, 2));
  progress("Собираем архив");
  downloadBlob(await zip.generateAsync({ type: "blob" }), `${name}.zip`);
  return { unavailable: manifest.filter(entry => !entry.file).length };
}
