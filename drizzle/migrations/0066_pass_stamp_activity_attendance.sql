-- Tampon Pass Terrain lié à une activité => présence synchronisée (sans double tampon automatique).

-- Activités récentes (7 derniers jours à demain, non annulées) que le valideur encadre ; Bureau : toutes.
CREATE OR REPLACE FUNCTION public.list_stamp_activities()
RETURNS TABLE (id uuid, title text, date timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.id, a.title, a.date
  FROM public.activities a
  WHERE auth.uid() IS NOT NULL
    AND public.is_pass_validator(auth.uid())
    AND a.status <> 'CANCELLED'
    AND a.date IS NOT NULL
    AND a.date >= now() - interval '7 days'
    AND a.date <= now() + interval '1 day'
    AND (
      public.is_bureau(auth.uid())
      OR a.professional_id = auth.uid()
      OR auth.uid() = ANY (a.professional_ids)
      OR a.referent_id = auth.uid()
      OR a.created_by = auth.uid()
    )
  ORDER BY a.date DESC
  LIMIT 30
$$;
REVOKE EXECUTE ON FUNCTION public.list_stamp_activities() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_stamp_activities() TO authenticated, service_role;

-- Une présence issue d'un tampon manuel ne déclenche pas la fidélité automatique :
-- le tampon récompense déjà cette présence (pas de double tampon).
CREATE OR REPLACE FUNCTION public.grant_loyalty_on_participation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(current_setting('lvdc.manual_stamp_sync', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.registration_status IN ('ATTENDED','VALIDATED','CONFIRMED')
     AND COALESCE(OLD.registration_status, '') IS DISTINCT FROM NEW.registration_status THEN
    PERFORM public.apply_loyalty_rules(NEW.user_id, NEW.activity_id, NEW.event_id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.award_manual_stamp(_member_id uuid, _bureau_id uuid, _activity_id uuid, _event_id uuid, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); card uuid; k text; sid uuid; pro_name text; member_name text; m_status text; synced boolean := false;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF NOT public.is_pass_validator(me) THEN RAISE EXCEPTION 'Réservé aux valideurs du Pass Terrain (professionnels validés, Bureau après activation)'; END IF;
  IF _member_id = me THEN RAISE EXCEPTION 'Impossible de s''attribuer un tampon'; END IF;
  SELECT membership_status INTO m_status FROM public.profiles WHERE id = _member_id;
  IF m_status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'Adhésion pas encore validée par le Bureau : le tampon sera possible après validation';
  END IF;
  IF NOT public.can_receive_stamps(_member_id) THEN
    RAISE EXCEPTION 'Pass personnel non activé : la personne doit d''abord l''activer dans « Mon pass »';
  END IF;
  IF _bureau_id IS NULL OR NOT public.is_bureau(_bureau_id) THEN RAISE EXCEPTION 'Choisissez un membre du Bureau à informer'; END IF;
  IF _bureau_id = me THEN RAISE EXCEPTION 'Choisissez un autre membre du Bureau à informer'; END IF;
  IF _bureau_id = _member_id THEN RAISE EXCEPTION 'La personne tamponnée ne peut pas être le membre du Bureau informé'; END IF;
  IF coalesce(trim(_reason),'') = '' THEN RAISE EXCEPTION 'Le motif est obligatoire'; END IF;
  IF _activity_id IS NOT NULL AND _event_id IS NOT NULL THEN RAISE EXCEPTION 'Choisissez une activité OU un événement'; END IF;
  IF _activity_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.activities a
    WHERE a.id = _activity_id
      AND a.status <> 'CANCELLED'
      AND a.date IS NOT NULL
      AND a.date >= now() - interval '7 days'
      AND a.date <= now() + interval '1 day'
      AND (public.is_bureau(me) OR a.professional_id = me OR me = ANY (a.professional_ids) OR a.referent_id = me OR a.created_by = me)
  ) THEN
    RAISE EXCEPTION 'Activité non rattachable : choisissez une activité récente que vous encadrez';
  END IF;
  k := 'MANUAL:' || me || ':' || _member_id || ':' || COALESCE(_activity_id::text, _event_id::text, (now() AT TIME ZONE 'Europe/Paris')::date::text);
  SELECT id INTO card FROM public.loyalty_cards WHERE member_id = _member_id;
  IF card IS NULL THEN INSERT INTO public.loyalty_cards (member_id) VALUES (_member_id) RETURNING id INTO card; END IF;
  INSERT INTO public.loyalty_stamps (card_id, activity_id, event_id, professional_id, awarded_by, notified_bureau_id, reason, stamps, note, manual_key)
  VALUES (card, _activity_id, _event_id, me, me, _bureau_id, trim(_reason), 1, 'MANUAL', k)
  ON CONFLICT (manual_key) WHERE manual_key IS NOT NULL DO NOTHING RETURNING id INTO sid;

  -- Présence synchronisée sur l'activité (idempotent, même si le tampon existait déjà).
  IF _activity_id IS NOT NULL THEN
    PERFORM set_config('lvdc.manual_stamp_sync', 'on', true);
    INSERT INTO public.participations (user_id, activity_id, registration_status, validated_at, validated_by, notes)
    VALUES (_member_id, _activity_id, 'ATTENDED', now(), me, 'Présence confirmée par tampon Pass Terrain')
    ON CONFLICT (user_id, activity_id) WHERE activity_id IS NOT NULL
    DO UPDATE SET registration_status = 'ATTENDED', validated_at = now(), validated_by = me
    WHERE public.participations.registration_status IS DISTINCT FROM 'ATTENDED';
    PERFORM set_config('lvdc.manual_stamp_sync', '', true);
    synced := true;
  END IF;

  IF sid IS NULL THEN RETURN jsonb_build_object('awarded', false, 'message', 'Tampon déjà attribué pour ce motif', 'attendance_synced', synced); END IF;
  SELECT COALESCE(display_name, trim(concat(first_name,' ',last_name))) INTO pro_name FROM public.profiles WHERE id = me;
  SELECT COALESCE(display_name, trim(concat(first_name,' ',last_name))) INTO member_name FROM public.profiles WHERE id = _member_id;
  INSERT INTO public.in_app_notifications (recipient_id, sender_id, kind, title, message, entity_type, entity_id, link_url) VALUES
    (_bureau_id, me, 'LOYALTY_MANUAL', 'Tampon attribué manuellement', coalesce(pro_name,'Un valideur') || ' a attribué un tampon à ' || coalesce(member_name,'un membre') || ' — ' || trim(_reason), 'loyalty_stamp', sid, '/loyalty');
  RETURN jsonb_build_object('awarded', true, 'stamp_id', sid, 'attendance_synced', synced);
END $function$;