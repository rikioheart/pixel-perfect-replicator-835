-- Partage d'un dossier chien avec plusieurs professionnels en une fois (tout ou rien),
-- modification des rubriques par le propriétaire avec répercussion sur les accès dérivés,
-- et alerte au professionnel quand un accès lui est ouvert.

CREATE OR REPLACE FUNCTION public.share_dog_access_many(
  _dog_id uuid, _professional_ids uuid[], _identity boolean, _info boolean, _goals boolean,
  _activities boolean, _observations boolean, _context text, _expires_at timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE me uuid := auth.uid(); pid uuid; shared uuid[] := '{}'; skipped uuid[] := '{}';
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF _professional_ids IS NULL OR cardinality(_professional_ids) = 0 THEN
    RAISE EXCEPTION 'Choisissez au moins un professionnel';
  END IF;
  IF cardinality(_professional_ids) > 20 THEN
    RAISE EXCEPTION 'Vingt professionnels au maximum par partage';
  END IF;
  FOR pid IN SELECT DISTINCT unnest(_professional_ids) LOOP
    IF EXISTS (SELECT 1 FROM public.dog_professional_access a
               WHERE a.dog_id = _dog_id AND a.professional_id = pid AND NOT a.revoked
                 AND (a.expires_at IS NULL OR a.expires_at > now())) THEN
      skipped := skipped || pid;
    ELSE
      PERFORM public.share_dog_access(_dog_id, pid, _identity, _info, _goals, _activities, _observations, _context, _expires_at);
      shared := shared || pid;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('shared', to_jsonb(shared), 'skipped', to_jsonb(skipped));
END $$;

REVOKE ALL ON FUNCTION public.share_dog_access_many(uuid, uuid[], boolean, boolean, boolean, boolean, boolean, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_dog_access_many(uuid, uuid[], boolean, boolean, boolean, boolean, boolean, text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_dog_access(
  _access_id uuid, _identity boolean, _info boolean, _goals boolean,
  _activities boolean, _observations boolean, _expires_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE me uuid := auth.uid(); a public.dog_professional_access%ROWTYPE;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  SELECT * INTO a FROM public.dog_professional_access WHERE id = _access_id;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Accès introuvable'; END IF;
  IF NOT public.can_manage_dog(me, a.dog_id) THEN
    RAISE EXCEPTION 'Seul le propriétaire peut modifier cet accès';
  END IF;
  IF a.revoked OR (a.expires_at IS NOT NULL AND a.expires_at <= now()) THEN
    RAISE EXCEPTION 'Cet accès n''est plus actif : partagez à nouveau';
  END IF;
  IF _expires_at IS NOT NULL AND _expires_at <= now() THEN
    RAISE EXCEPTION 'La date de fin doit être dans le futur';
  END IF;
  UPDATE public.dog_professional_access SET
    can_identity = coalesce(_identity,false), can_info = coalesce(_info,false), can_goals = coalesce(_goals,false),
    can_activities = coalesce(_activities,false), can_observations = coalesce(_observations,false),
    expires_at = _expires_at
  WHERE id = _access_id;
  -- Les accès redonnés par ce professionnel ne dépassent jamais les nouveaux droits.
  WITH RECURSIVE tree AS (
    SELECT id FROM public.dog_professional_access WHERE source_access_id = _access_id
    UNION ALL SELECT c.id FROM public.dog_professional_access c JOIN tree t ON c.source_access_id = t.id)
  UPDATE public.dog_professional_access d SET
    can_identity = d.can_identity AND coalesce(_identity,false),
    can_info = d.can_info AND coalesce(_info,false),
    can_goals = d.can_goals AND coalesce(_goals,false),
    can_activities = d.can_activities AND coalesce(_activities,false),
    can_observations = d.can_observations AND coalesce(_observations,false),
    expires_at = CASE WHEN _expires_at IS NULL THEN d.expires_at
                      WHEN d.expires_at IS NULL OR d.expires_at > _expires_at THEN _expires_at
                      ELSE d.expires_at END
  WHERE d.id IN (SELECT id FROM tree) AND NOT d.revoked;
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (me, 'DOG_ACCESS_UPDATED', 'dog', a.dog_id,
    jsonb_build_object('access_id', a.id, 'identity', a.can_identity, 'info', a.can_info, 'goals', a.can_goals,
      'activities', a.can_activities, 'observations', a.can_observations, 'expires_at', a.expires_at),
    jsonb_build_object('access_id', a.id, 'identity', _identity, 'info', _info, 'goals', _goals,
      'activities', _activities, 'observations', _observations, 'expires_at', _expires_at));
END $$;

REVOKE ALL ON FUNCTION public.update_dog_access(uuid, boolean, boolean, boolean, boolean, boolean, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_dog_access(uuid, boolean, boolean, boolean, boolean, boolean, timestamptz) TO authenticated;

-- Retrait de l'accord « référent peut partager le suivi » : les accès redonnés par un référent perdent objectifs et observations.
CREATE OR REPLACE FUNCTION public.strip_followup_on_consent_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(OLD.referent_can_share_followup,false) AND NOT coalesce(NEW.referent_can_share_followup,false) THEN
    UPDATE public.dog_professional_access SET can_goals = false, can_observations = false
    WHERE dog_id = NEW.id AND source_access_id IS NOT NULL AND NOT revoked
      AND (can_goals OR can_observations);
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.strip_followup_on_consent_withdrawal() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS dogs_strip_followup_on_consent ON public.dogs;
CREATE TRIGGER dogs_strip_followup_on_consent
AFTER UPDATE OF referent_can_share_followup ON public.dogs
FOR EACH ROW EXECUTE FUNCTION public.strip_followup_on_consent_withdrawal();

-- Alerte au professionnel quand un dossier lui est ouvert (nouvel accès ou accès réactivé).
CREATE OR REPLACE FUNCTION public.notify_dog_access_shared()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE dog_name text;
BEGIN
  IF NEW.revoked THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NOT OLD.revoked THEN RETURN NEW; END IF;
  SELECT name INTO dog_name FROM public.dogs WHERE id = NEW.dog_id;
  PERFORM public.notify_member(NEW.professional_id, NEW.granted_by, 'DOG_SHARED',
    'Fiche chien partagée',
    'Le dossier de ' || coalesce(dog_name, 'un chien') || ' vous est ouvert' ||
      CASE WHEN coalesce(NEW.context,'') <> '' THEN ' : ' || NEW.context ELSE '' END,
    'dog', NEW.dog_id, '/espace-pro/chiens', interval '0');
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.notify_dog_access_shared() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS dog_access_notify_shared ON public.dog_professional_access;
CREATE TRIGGER dog_access_notify_shared
AFTER INSERT OR UPDATE OF revoked ON public.dog_professional_access
FOR EACH ROW EXECUTE FUNCTION public.notify_dog_access_shared();