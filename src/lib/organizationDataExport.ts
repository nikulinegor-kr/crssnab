import { supabase } from "@/integrations/supabase/client";
import { downloadBlob } from "@/lib/saveImage";
import { extractStoragePath } from "@/lib/storageUrl";

const tables = [
  "requests", "request_items", "request_shipments", "shipment_items", "request_activities",
  "request_objects", "request_participants", "request_priorities", "request_statuses",
  "object_documents", "kp_suppliers", "deadstock_items", "filter_elements", "spare_parts",
  "director_invoice_decisions", "trust_letters", "conversations",
  "suppliers", "supplier_lists", "supplier_list_items", "equipment",
  "planner_tasks", "planner_stages", "planner_task_comments", "planner_task_dependencies",
  "material_folders", "material_objects", "material_sections", "material_statements", "material_statement_items",
  "warehouses", "warehouse_products", "warehouse_cells", "warehouse_units", "warehouse_balances",
  "warehouse_damaged_balances", "warehouse_documents", "warehouse_document_lines", "warehouse_ledger",
  "warehouse_inventories", "warehouse_inventory_lines", "warehouse_issues", "warehouse_issue_returns",
  "warehouse_issue_usages", "warehouse_request_receipts", "warehouse_receipt_batches", "warehouse_receipt_batch_lines",
] as const;

type ExportRow = Record<string, unknown>;
export const exportFormats = ["XLSX", "CSV", "JSON"] as const;
export type ExportFormat = typeof exportFormats[number];

const attachmentBuckets = new Set([
  "request-photos", "request-documents", "object-documents", "material-statements",
  "deadstock-photos", "deadstock-documents", "spare-parts-photos", "filter-photos",
  "planner-attachments", "chat-files", "letter-templates", "trust-letters", "avatars", "organization-logos",
]);

function spreadsheetCell(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return JSON.stringify(value);
}

function tabularRows(rows: ExportRow[]) {
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  return [columns, ...rows.map(row => columns.map(column => spreadsheetCell(row[column])))];
}

function csvCell(value: string | number | boolean) {
  const cell = typeof value === "string" && /^(?:\s*[=+@-]|[\t\r\n])/.test(value) ? "'" + value : String(value);
  return '"' + cell.replace(/"/g, '""') + '"';
}
const pageSize = 500;

export async function exportOrganizationData(orgId: string, format: ExportFormat, progress: (message: string) => void) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Войдите в CRM, чтобы выгрузить данные");
  const { data: allowed, error: permissionError } = await supabase.rpc("user_is_org_admin", {
    _user_id: user.id, _org_id: orgId,
  });
  if (permissionError) throw permissionError;
  if (!allowed) throw new Error("Выгрузка доступна владельцу или администратору организации");

  const { data: organization, error: organizationError } = await supabase.from("organizations")
    .select("id,name,logo_url").eq("id", orgId).single();
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

  for (const [table, foreignKey, parent] of [
    ["messages", "conversation_id", "conversations"],
    ["message_attachments", "message_id", "messages"],
  ] as const) {
    const ids = records[parent].map(row => String(row.id));
    const rows: ExportRow[] = [];
    for (let offset = 0; offset < ids.length; offset += 100) {
      let cursor: string | undefined;
      while (true) {
        let query = supabase.from(table).select("*").in(foreignKey, ids.slice(offset, offset + 100)).order("id").limit(pageSize);
        if (cursor) query = query.gt("id", cursor);
        const { data, error } = await query;
        if (error) throw new Error(`Раздел ${table} не выгружен: ${error.message}`);
        rows.push(...(data ?? []));
        if (!data || data.length < pageSize) break;
        cursor = data[data.length - 1].id;
      }
    }
    records[table] = rows;
  }

  const { data: letterSettings, error: letterError } = await supabase.from("organization_letter_settings")
    .select("*").eq("organization_id", orgId);
  if (letterError) throw letterError;
  records.organization_letter_settings = letterSettings ?? [];

  const links = new Map<string, ReturnType<typeof extractStoragePath>>();
  const rawBuckets: Record<string, Record<string, string>> = {
    trust_letters: { file_path: "trust-letters" },
    organization_letter_settings: { template_path: "letter-templates" },
    message_attachments: { file_url: "chat-files" },
    director_invoice_decisions: { document_path: "request-documents" },
    warehouse_receipt_batch_lines: { photo_paths: "request-photos" },
    spare_parts: { photos: "spare-parts-photos" },
    planner_tasks: { path: "planner-attachments" },
  };

  function collect(table: string, field: string, value: unknown): unknown {
    if (Array.isArray(value)) return value.map(item => collect(table, field, item));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, collect(table, key, entry)]));
    }
    if (typeof value !== "string" || !value.trim()) return value;

    const reference = value.split(/[?#]/, 1)[0];
    const path = extractStoragePath(reference);
    if (path) {
      links.set(`${path.bucket}/${path.path}`, path);
      return reference;
    }
    const bucket = rawBuckets[table]?.[field];
    if (bucket && !/^https?:/i.test(value)) {
      const path = value.startsWith(bucket + "/") ? value.slice(bucket.length + 1) : value;
      links.set(`${bucket}/${path}`, { bucket, path });
    } else if (/^(file|photo|document|logo)_urls?$/.test(field) && /^https?:/i.test(value)) {
      links.set(reference, null);
    }
    return value;
  }

  const exportedRecords = Object.fromEntries(Object.entries(records).map(([table, rows]) => [
    table, rows.map(row => Object.fromEntries(Object.entries(row)
      .filter(([field]) => field !== "qr_token" && field !== "request_number")
      .map(([field, value]) => [field, collect(table, field, value)]))),
  ]));
  const exportedOrganization = { ...organization, logo_url: collect("organizations", "logo_url", organization.logo_url) };
  const exportedAt = new Date().toISOString();
  const name = `crss-${orgId.slice(0, 8)}-${exportedAt.slice(0, 10)}`;
  const snapshot = {
    format_version: 1, exported_at: exportedAt, organization: exportedOrganization,
    record_counts: Object.fromEntries(Object.entries(records).map(([key, rows]) => [key, rows.length])),
    records: exportedRecords,
  };

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const files = new Map<string, string>();
  const manifest: { reference: string; file: string | null }[] = [];
  let index = 0;
  for (const [reference, path] of links) {
    progress(`Скачиваем вложения · ${++index} из ${links.size}`);
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
    manifest.push({ reference, file });
  }
  if (format === "JSON") {
    zip.file("data.json", JSON.stringify({ ...snapshot, attachments: manifest }, null, 2));
  } else {
    const datasets = { organization: [exportedOrganization], ...exportedRecords };
    zip.file("attachments-manifest.json", JSON.stringify(manifest, null, 2));
    if (format === "CSV") {
      for (const [table, rows] of Object.entries(datasets)) {
        zip.file(`data/${table}.csv`, "\uFEFF" + tabularRows(rows).map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n");
      }
    } else {
      const { utils, write } = await import("xlsx");
      const workbook = utils.book_new();
      for (const [index, [table, rows]] of Object.entries(datasets).entries()) {
        const prefix = `${index + 1}_`;
        utils.book_append_sheet(workbook, utils.aoa_to_sheet(tabularRows(rows)), prefix + table.slice(0, 31 - prefix.length));
      }
      zip.file("data.xlsx", write(workbook, { bookType: "xlsx", type: "array", compression: true }));
    }
  }
  progress("Собираем архив");
  downloadBlob(await zip.generateAsync({ type: "blob" }), `${name}.zip`);
  return { unavailable: manifest.filter(entry => !entry.file).length };
}
