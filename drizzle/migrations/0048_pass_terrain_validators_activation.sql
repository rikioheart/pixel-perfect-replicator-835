-- Pass Terrain : statut valideur (pros validés automatiquement, Bureau sur activation) et pass personnel activable pour les non-particuliers.
CREATE TABLE public.pass_access (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  personal_pass_at timestamptz,
  validator_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pass_access TO authenticated;
GRANT ALL ON public.pass_access TO service_role;
ALTER TABLE public.pass_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY pass_access_select ON public.pass_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_bureau(auth.uid()));
COMMENT ON TABLE public.pass_access IS 'Écrit uniquement via set_personal_pass / set_pass_validator.';

CREATE OR REPLACE FUNCTION public.is_pass_validator(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_professional(_user_id)
    OR (public.is_bureau(_user_id) AND EXISTS (SELECT 1 FROM public.pass_access a WHERE a.user_id = _user_id AND a.validator_at IS NOT NULL))
$$;

CREATE OR REPLACE FUNCTION public.can_receive_stamps(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.membership_status = 'ACTIVE'
    AND (p.membership_type = 'PARTICULIER'
      OR EXISTS (SELECT 1 FROM public.pass_access a WHERE a.user_id = p.id AND a.personal_pass_at IS NOT NULL)))
$$;

CREATE OR REPLACE FUNCTION public.my_pass_access()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); p record; a record;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  SELECT membership_type, membership_status INTO p FROM public.profiles WHERE id = me;
  SELECT personal_pass_at, validator_at INTO a FROM public.pass_access WHERE user_id = me;
  RETURN jsonb_build_object(
    'membership_type', p.membership_type,
    'membership_status', p.membership_status,
    'is_pro', public.is_professional(me),
    'is_bureau', public.is_bureau(me),
    'personal_pass_at', a.personal_pass_at,
    'validator_at', a.validator_at,
    'is_validator', public.is_pass_validator(me),
    'can_receive_stamps', public.can_receive_stamps(me));
END $$;

CREATE OR REPLACE FUNCTION public.set_personal_pass(_active boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); m_type text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  SELECT membership_type INTO m_type FROM public.profiles WHERE id = me;
  IF m_type IS NULL THEN RAISE EXCEPTION 'Profil introuvable'; END IF;
  IF m_type = 'PARTICULIER' THEN RAISE EXCEPTION 'Votre pass personnel est déjà actif'; END IF;
  INSERT INTO public.pass_access (user_id, personal_pass_at, updated_at)
  VALUES (me, CASE WHEN _active THEN now() END, now())
  ON CONFLICT (user_id) DO UPDATE SET personal_pass_at = CASE WHEN _active THEN coalesce(public.pass_access.personal_pass_at, now()) END, updated_at = now();
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_values)
  VALUES (me, CASE WHEN _active THEN 'PASS_PERSONAL_ON' ELSE 'PASS_PERSONAL_OFF' END, 'pass_access', me, jsonb_build_object('membership_type', m_type));
  RETURN public.my_pass_access();
END $$;

CREATE OR REPLACE FUNCTION public.set_pass_validator(_active boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF NOT public.is_bureau(me) THEN RAISE EXCEPTION 'Activation réservée aux membres du Bureau (les professionnels validés sont valideurs d''office)'; END IF;
  INSERT INTO public.pass_access (user_id, validator_at, updated_at)
  VALUES (me, CASE WHEN _active THEN now() END, now())
  ON CONFLICT (user_id) DO UPDATE SET validator_at = CASE WHEN _active THEN coalesce(public.pass_access.validator_at, now()) END, updated_at = now();
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_values)
  VALUES (me, CASE WHEN _active THEN 'PASS_VALIDATOR_ON' ELSE 'PASS_VALIDATOR_OFF' END, 'pass_access', me, '{}'::jsonb);
  RETURN public.my_pass_access();
END $$;

REVOKE EXECUTE ON FUNCTION public.is_pass_validator(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_receive_stamps(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_pass_access() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_personal_pass(boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_pass_validator(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_pass_validator(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_receive_stamps(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_pass_access() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_personal_pass(boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_pass_validator(boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.award_manual_stamp(_member_id uuid, _bureau_id uuid, _activity_id uuid, _event_id uuid, _reason text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); card uuid; k text; sid uuid; pro_name text; member_name text; m_status text;
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
  k := 'MANUAL:' || me || ':' || _member_id || ':' || COALESCE(_activity_id::text, _event_id::text, (now() AT TIME ZONE 'Europe/Paris')::date::text);
  SELECT id INTO card FROM public.loyalty_cards WHERE member_id = _member_id;
  IF card IS NULL THEN INSERT INTO public.loyalty_cards (member_id) VALUES (_member_id) RETURNING id INTO card; END IF;
  INSERT INTO public.loyalty_stamps (card_id, activity_id, event_id, professional_id, awarded_by, notified_bureau_id, reason, stamps, note, manual_key)
  VALUES (card, _activity_id, _event_id, me, me, _bureau_id, trim(_reason), 1, 'MANUAL', k)
  ON CONFLICT (manual_key) WHERE manual_key IS NOT NULL DO NOTHING RETURNING id INTO sid;
  IF sid IS NULL THEN RETURN jsonb_build_object('awarded', false, 'message', 'Tampon déjà attribué pour ce motif'); END IF;
  SELECT COALESCE(display_name, trim(concat(first_name,' ',last_name))) INTO pro_name FROM public.profiles WHERE id = me;
  SELECT COALESCE(display_name, trim(concat(first_name,' ',last_name))) INTO member_name FROM public.profiles WHERE id = _member_id;
  INSERT INTO public.in_app_notifications (recipient_id, sender_id, kind, title, message, entity_type, entity_id, link_url) VALUES
    (_bureau_id, me, 'LOYALTY_MANUAL', 'Tampon attribué manuellement', coalesce(pro_name,'Un valideur') || ' a attribué un tampon à ' || coalesce(member_name,'un membre') || ' — ' || trim(_reason), 'loyalty_stamp', sid, '/loyalty'),
    (_member_id, me, 'LOYALTY_STAMP', '+1 tampon', 'Validé par ' || coalesce(pro_name,'un valideur') || ' — ' || trim(_reason), 'loyalty_stamp', sid, '/loyalty');
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_values)
  VALUES (me, 'LOYALTY_MANUAL_STAMP', 'loyalty_stamp', sid, jsonb_build_object('member', _member_id, 'bureau', _bureau_id, 'activity', _activity_id, 'event', _event_id, 'reason', _reason, 'validator_source', CASE WHEN public.is_professional(me) THEN 'PRO' ELSE 'BUREAU' END));
  RETURN jsonb_build_object('awarded', true, 'stamp_id', sid);
END $function$;

CREATE OR REPLACE FUNCTION public.submit_offline_stamp_mediation(_local_id uuid, _member_id uuid, _bureau_id uuid, _reason text, _offline_day date)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); today date := (now() AT TIME ZONE 'Europe/Paris')::date; pro_name text; member_name text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF NOT public.is_pass_validator(me) THEN RAISE EXCEPTION 'Réservé aux valideurs du Pass Terrain'; END IF;
  IF _local_id IS NULL THEN RAISE EXCEPTION 'Demande locale invalide'; END IF;
  IF _member_id IS NULL OR _member_id = me THEN RAISE EXCEPTION 'Membre invalide'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _member_id AND (p.membership_type = 'PARTICULIER'
      OR EXISTS (SELECT 1 FROM public.pass_access a WHERE a.user_id = p.id AND a.personal_pass_at IS NOT NULL))) THEN
    RAISE EXCEPTION 'Pass personnel non activé pour cette personne';
  END IF;
  IF _bureau_id IS NULL OR NOT public.is_bureau(_bureau_id) THEN RAISE EXCEPTION 'Choisissez un membre du Bureau à informer'; END IF;
  IF _bureau_id = me THEN RAISE EXCEPTION 'Choisissez un autre membre du Bureau à informer'; END IF;
  IF coalesce(trim(_reason),'') = '' THEN RAISE EXCEPTION 'Le motif est obligatoire'; END IF;
  IF _offline_day IS NULL OR _offline_day > today OR _offline_day < today - 30 THEN
    RAISE EXCEPTION 'Date de la demande hors ligne invalide (30 jours maximum)';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('offline_stamp_mediation:' || _local_id::text));
  IF EXISTS (SELECT 1 FROM public.audit_logs WHERE action = 'LOYALTY_OFFLINE_MEDIATION' AND entity_id = _local_id AND actor_id = me) THEN
    RETURN jsonb_build_object('submitted', false, 'message', 'Demande déjà transmise au Bureau');
  END IF;
  SELECT COALESCE(display_name, trim(concat(first_name,' ',last_name))) INTO pro_name FROM public.profiles WHERE id = me;
  SELECT COALESCE(display_name, trim(concat(first_name,' ',last_name))) INTO member_name FROM public.profiles WHERE id = _member_id;
  INSERT INTO public.in_app_notifications (recipient_id, sender_id, kind, title, message, entity_type, entity_id, link_url)
  VALUES (_bureau_id, me, 'LOYALTY_MEDIATION', 'Tampon hors ligne à examiner',
    left(coalesce(pro_name,'Un valideur') || ' demande une médiation pour ' || coalesce(member_name,'un membre') || ' (séance du ' || to_char(_offline_day,'DD/MM/YYYY') || ') — ' || trim(_reason), 300),
    'profile', _member_id, '/members/' || _member_id);
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_values)
  VALUES (me, 'LOYALTY_OFFLINE_MEDIATION', 'offline_stamp_request', _local_id,
    jsonb_build_object('member', _member_id, 'bureau', _bureau_id, 'reason', trim(_reason), 'offline_day', _offline_day));
  RETURN jsonb_build_object('submitted', true);
END $function$;

CREATE OR REPLACE FUNCTION public.list_particuliers()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN NOT public.is_pass_validator(auth.uid()) THEN '[]'::jsonb ELSE COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', COALESCE(p.display_name, trim(concat(p.first_name,' ',p.last_name)))) ORDER BY p.display_name)
    FROM public.profiles p WHERE p.id <> auth.uid() AND public.can_receive_stamps(p.id)), '[]'::jsonb) END
$function$;

CREATE OR REPLACE FUNCTION public.resolve_member_from_qr(_scanned_code text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); code text; n int; rec record;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF NOT (public.is_pass_validator(me) OR public.is_bureau(me)) THEN RAISE EXCEPTION 'Réservé aux valideurs du Pass Terrain et au Bureau'; END IF;
  code := lower(regexp_replace(coalesce(_scanned_code,''), '[^0-9a-fA-F]', '', 'g'));
  IF length(code) < 8 THEN RETURN jsonb_build_object('found', false, 'reason', 'INVALID'); END IF;
  IF length(code) = 32 THEN
    SELECT count(*) INTO n FROM public.loyalty_cards c WHERE replace(c.qr_code,'-','') = code;
  ELSE
    code := left(code, 8);
    SELECT count(*) INTO n FROM public.loyalty_cards c WHERE left(replace(c.qr_code,'-',''),8) = code;
  END IF;
  IF n = 0 THEN RETURN jsonb_build_object('found', false, 'reason', 'NOT_FOUND'); END IF;
  IF n > 1 THEN RETURN jsonb_build_object('found', false, 'reason', 'AMBIGUOUS'); END IF;
  SELECT c.member_id, c.total_stamps, p.membership_type, p.membership_status,
         coalesce(nullif(p.display_name,''), trim(concat(p.first_name,' ',left(coalesce(p.last_name,''),1)))) AS name
    INTO rec
    FROM public.loyalty_cards c JOIN public.profiles p ON p.id = c.member_id
    WHERE (length(code) = 32 AND replace(c.qr_code,'-','') = code) OR (length(code) = 8 AND left(replace(c.qr_code,'-',''),8) = code)
    LIMIT 1;
  IF rec.member_id IS NULL THEN RETURN jsonb_build_object('found', false, 'reason', 'NOT_FOUND'); END IF;
  RETURN jsonb_build_object('found', true, 'member_id', rec.member_id, 'display_name', rec.name,
    'membership_type', rec.membership_type, 'membership_status', rec.membership_status, 'total_stamps', rec.total_stamps,
    'can_receive_stamps', public.can_receive_stamps(rec.member_id), 'is_self', rec.member_id = me);
END $function$;