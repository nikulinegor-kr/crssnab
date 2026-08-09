ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS payment_date date;

CREATE OR REPLACE FUNCTION public.set_payment_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_date IS NULL
     AND (COALESCE(NEW.payment_percentage, 0) > 0 OR NEW.payment_status IN ('Оплачен','Оплачено'))
     AND (TG_OP = 'INSERT'
          OR COALESCE(OLD.payment_percentage,0) = 0 AND COALESCE(NEW.payment_percentage,0) > 0
          OR COALESCE(OLD.payment_status,'') IS DISTINCT FROM NEW.payment_status) THEN
    NEW.payment_date := CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_payment_date ON public.requests;
CREATE TRIGGER trg_set_payment_date
BEFORE INSERT OR UPDATE ON public.requests
FOR EACH ROW EXECUTE FUNCTION public.set_payment_date();

UPDATE public.requests
SET payment_date = COALESCE(invoice_date, request_date)
WHERE payment_date IS NULL
  AND (COALESCE(payment_percentage,0) > 0 OR payment_status IN ('Оплачен','Оплачено'));

CREATE TABLE IF NOT EXISTS public.report_inclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  period text NOT NULL,
  decision text NOT NULL DEFAULT 'Требует проверки',
  note text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, period)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_inclusions TO authenticated;
GRANT ALL ON public.report_inclusions TO service_role;

ALTER TABLE public.report_inclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members view report inclusions"
ON public.report_inclusions FOR SELECT TO authenticated
USING (public.user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "org members insert report inclusions"
ON public.report_inclusions FOR INSERT TO authenticated
WITH CHECK (public.user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "org members update report inclusions"
ON public.report_inclusions FOR UPDATE TO authenticated
USING (public.user_has_org_access(auth.uid(), organization_id))
WITH CHECK (public.user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "org admins delete report inclusions"
ON public.report_inclusions FOR DELETE TO authenticated
USING (public.user_is_org_admin(auth.uid(), organization_id));

CREATE TRIGGER trg_report_inclusions_updated_at
BEFORE UPDATE ON public.report_inclusions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();