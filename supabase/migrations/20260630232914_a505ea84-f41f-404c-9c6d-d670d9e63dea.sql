GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_shipments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipment_items TO authenticated;
GRANT ALL ON public.request_shipments TO service_role;
GRANT ALL ON public.shipment_items TO service_role;