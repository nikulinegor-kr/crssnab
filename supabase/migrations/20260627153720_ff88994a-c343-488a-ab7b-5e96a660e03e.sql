
CREATE OR REPLACE FUNCTION public.normalize_transport_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v text;
  k text;
BEGIN
  IF NEW.transport_company IS NULL THEN RETURN NEW; END IF;
  v := btrim(NEW.transport_company);
  IF v = '' THEN
    NEW.transport_company := NULL;
    RETURN NEW;
  END IF;
  k := lower(v);
  NEW.transport_company := CASE
    WHEN k IN ('азимут','азиму') THEN 'Азимут'
    WHEN k IN ('тройка','тройка дв','тройкадв') THEN 'Тройка ДВ'
    WHEN k IN ('слтк','стлк') THEN 'СЛТК'
    WHEN k = 'dpd' THEN 'DPD'
    WHEN k IN ('карго','карго нск','карго порт','каргопорт') THEN 'Карго'
    WHEN k = 'авиа' THEN 'Авиа'
    WHEN k IN ('cdek','сдэк','сдек') THEN 'СДЭК'
    WHEN k IN ('ozon','озон') THEN 'Ozon'
    WHEN k IN ('стеил','стэил') THEN 'Стеил'
    WHEN k = 'гулый' THEN 'Гулый'
    WHEN k IN ('максима','гк максима','кг максима') THEN 'ГК Максима'
    WHEN k IN ('энергия','тк энергия') THEN 'Энергия'
    ELSE v
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_transport_company ON public.requests;
CREATE TRIGGER trg_normalize_transport_company
BEFORE INSERT OR UPDATE OF transport_company ON public.requests
FOR EACH ROW EXECUTE FUNCTION public.normalize_transport_company();
