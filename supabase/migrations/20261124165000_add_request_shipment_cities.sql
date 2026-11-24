alter table public.request_shipments
  add column if not exists origin_city text,
  add column if not exists destination_city text;
