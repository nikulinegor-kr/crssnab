-- НЕ ПРИМЕНЕНО к рабочей базе. Добавочный публичный номер заявки REQ-00001.
-- Старые заявки нумеруются по дате создания (затем id), новые — серверной последовательностью.
CREATE SEQUENCE IF NOT EXISTS public.requests_public_number_seq AS bigint START 1 MINVALUE 1;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS public_number bigint;
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at NULLS LAST, id) AS rn
  FROM public.requests WHERE public_number IS NULL
)
UPDATE public.requests r SET public_number = o.rn
  + COALESCE((SELECT max(public_number) FROM public.requests), 0)
FROM ordered o WHERE r.id = o.id;
SELECT setval('public.requests_public_number_seq',
  GREATEST(COALESCE((SELECT max(public_number) FROM public.requests), 0), 1),
  (SELECT count(*) > 0 FROM public.requests WHERE public_number IS NOT NULL));
ALTER TABLE public.requests ALTER COLUMN public_number SET DEFAULT nextval('public.requests_public_number_seq');
ALTER SEQUENCE public.requests_public_number_seq OWNED BY public.requests.public_number;
ALTER TABLE public.requests ALTER COLUMN public_number SET NOT NULL;
ALTER TABLE public.requests ADD CONSTRAINT requests_public_number_key UNIQUE (public_number);
-- Номер постоянный: изменить его нельзя.
CREATE OR REPLACE FUNCTION public.requests_keep_public_number() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.public_number IS DISTINCT FROM OLD.public_number THEN
    RAISE EXCEPTION 'public_number is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER requests_keep_public_number BEFORE UPDATE OF public_number ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.requests_keep_public_number();
