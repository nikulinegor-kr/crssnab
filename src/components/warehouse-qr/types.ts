export interface WhWarehouse { id: string; name: string }
export interface WhCell { id: string; warehouse_id: string; code: string; description: string | null; qr_token: string; is_active: boolean }
export interface WhUnit { id: string; kind: "item" | "batch"; name: string; request_title?:string|null;request_number?:string|null;source_request_id?:string|null; serial_number: string | null; batch_number: string | null; unit: string; qr_token: string; product_id: string | null; created_at: string }
export interface WhBalance { id: string; unit_id: string; warehouse_id: string; cell_id: string | null; quantity: number }
export interface WhIssue { id: string; unit_id: string; warehouse_id: string; cell_id: string | null; recipient_name: string; issued_qty: number; returned_qty: number; request_id: string | null; object_id: string | null; created_at: string }
