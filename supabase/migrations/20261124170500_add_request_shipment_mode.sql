alter table public.request_shipments
  add column if not exists shipment_mode text
  check (shipment_mode in ('carrier', 'dedicated'));
