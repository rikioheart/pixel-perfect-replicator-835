-- 1. Attribution automatique lors de la validation d'un événement
CREATE OR REPLACE FUNCTION public.grant_loyalty_on_event_validation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  p record;
BEGIN
  IF NEW.status IN ('VALIDATED','COMPLETED','DONE','TERMINE')
     AND COALESCE(OLD.status,'') IS DISTINCT FROM NEW.status THEN
    FOR p IN
      SELECT DISTINCT user_id, activity_id
      FROM public.participations
      WHERE event_id = NEW.id
        AND registration_status IN ('ATTENDED','VALIDATED','CONFIRMED')
    LOOP
      PERFORM public.apply_loyalty_rules(p.user_id, p.activity_id, NEW.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_loyalty ON public.events;
CREATE TRIGGER trg_events_loyalty
AFTER UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.grant_loyalty_on_event_validation();

-- 2. Recalcul à la demande pour un adhérent
CREATE OR REPLACE FUNCTION public.recompute_loyalty_for_member(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  p record;
  granted int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;
  IF auth.uid() <> _user_id AND NOT public.is_bureau(auth.uid()) THEN
    RAISE EXCEPTION 'Recalcul réservé au Bureau';
  END IF;

  FOR p IN
    SELECT user_id, activity_id, event_id
    FROM public.participations
    WHERE user_id = _user_id
      AND registration_status IN ('ATTENDED','VALIDATED','CONFIRMED')
  LOOP
    granted := granted + public.apply_loyalty_rules(p.user_id, p.activity_id, p.event_id);
  END LOOP;

  RETURN granted;
END;
$$;

-- 3. Recalcul global (Bureau uniquement)
CREATE OR REPLACE FUNCTION public.recompute_loyalty_all()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  p record;
  granted int := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_bureau(auth.uid()) THEN
    RAISE EXCEPTION 'Recalcul global réservé au Bureau';
  END IF;

  FOR p IN
    SELECT user_id, activity_id, event_id
    FROM public.participations
    WHERE registration_status IN ('ATTENDED','VALIDATED','CONFIRMED')
  LOOP
    granted := granted + public.apply_loyalty_rules(p.user_id, p.activity_id, p.event_id);
  END LOOP;

  RETURN granted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_loyalty_for_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_loyalty_all() TO authenticated;