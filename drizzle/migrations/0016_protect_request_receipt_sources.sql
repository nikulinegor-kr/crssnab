CREATE OR REPLACE FUNCTION public.warehouse_request_receipt_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.status='posted' AND OLD.status='draft' AND NEW.doc_type='receipt' THEN
  IF NEW.request_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.warehouse_request_receipts WHERE request_id=NEW.request_id AND document_id=NEW.id) THEN RAISE EXCEPTION 'Осуществите приёмку из заявки'; END IF;
  IF EXISTS(SELECT 1 FROM public.warehouse_document_lines l JOIN public.warehouse_units u ON u.id=l.unit_id WHERE l.document_id=NEW.id AND u.request_item_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.warehouse_request_receipts r JOIN public.request_items it ON it.request_id=r.request_id WHERE r.document_id=NEW.id AND it.id=u.request_item_id)) THEN RAISE EXCEPTION 'Повторная приёмка ТМЦ заявки запрещена'; END IF;
 END IF;
 RETURN NEW;
END $$;