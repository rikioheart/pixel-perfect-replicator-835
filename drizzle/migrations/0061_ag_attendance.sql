CREATE TABLE public.ag_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES public.governance_records(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('PRESENT', 'REPRESENTED', 'EXCUSED')),
  proxy_holder_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  recorded_by uuid DEFAULT auth.uid(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (record_id, member_id),
  CHECK (status <> 'REPRESENTED' OR proxy_holder_id IS NOT NULL),
  CHECK (proxy_holder_id IS NULL OR proxy_holder_id <> member_id)
);
COMMENT ON TABLE public.ag_attendance IS 'Émargement nominatif des assemblées générales (registre de gouvernance, Bureau seul).';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ag_attendance TO authenticated;
GRANT ALL ON public.ag_attendance TO service_role;
ALTER TABLE public.ag_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY ag_attendance_bureau ON public.ag_attendance
  FOR ALL TO authenticated
  USING (public.is_bureau(auth.uid()))
  WITH CHECK (public.is_bureau(auth.uid()));

-- Uniquement sur une AG ; le mandataire doit être présent ; horodatage et auteur imposés.
CREATE OR REPLACE FUNCTION public.guard_ag_attendance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.governance_records WHERE id = NEW.record_id AND kind = 'AG') THEN
    RAISE EXCEPTION 'L''émargement est réservé aux assemblées générales.';
  END IF;
  IF NEW.status = 'REPRESENTED' AND NOT EXISTS (
    SELECT 1 FROM public.ag_attendance
    WHERE record_id = NEW.record_id AND member_id = NEW.proxy_holder_id AND status = 'PRESENT'
  ) THEN
    RAISE EXCEPTION 'Le mandataire doit être émargé présent.';
  END IF;
  IF NEW.status <> 'REPRESENTED' THEN NEW.proxy_holder_id := NULL; END IF;
  NEW.recorded_by := auth.uid();
  NEW.recorded_at := now();
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.guard_ag_attendance() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_ag_attendance_guard
  BEFORE INSERT OR UPDATE ON public.ag_attendance
  FOR EACH ROW EXECUTE FUNCTION public.guard_ag_attendance();

-- Un présent qui part ou devient représenté libère ses procurations.
CREATE OR REPLACE FUNCTION public.release_ag_proxies()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' OR NEW.status <> 'PRESENT' THEN
    DELETE FROM public.ag_attendance
    WHERE record_id = OLD.record_id AND proxy_holder_id = OLD.member_id AND status = 'REPRESENTED';
  END IF;
  RETURN NULL;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.release_ag_proxies() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_ag_attendance_release
  AFTER UPDATE OF status OR DELETE ON public.ag_attendance
  FOR EACH ROW EXECUTE FUNCTION public.release_ag_proxies();

-- Journal de chaque émargement.
CREATE OR REPLACE FUNCTION public.audit_ag_attendance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _row public.ag_attendance;
BEGIN
  _row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, old_values, new_values, metadata)
  VALUES (auth.uid(),
    CASE WHEN TG_OP = 'DELETE' THEN 'AG_ATTENDANCE_CLEARED' ELSE 'AG_ATTENDANCE_SET' END,
    'governance_record', _row.record_id,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE jsonb_build_object('status', OLD.status, 'proxy_holder_id', OLD.proxy_holder_id) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE jsonb_build_object('status', NEW.status, 'proxy_holder_id', NEW.proxy_holder_id) END,
    jsonb_build_object('member_id', _row.member_id));
  RETURN NULL;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.audit_ag_attendance() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_ag_attendance_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.ag_attendance
  FOR EACH ROW EXECUTE FUNCTION public.audit_ag_attendance();