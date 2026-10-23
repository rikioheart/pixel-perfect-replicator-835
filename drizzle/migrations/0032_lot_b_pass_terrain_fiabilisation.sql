-- Lot B : Pass Terrain. Option A (tampon uniquement pour un particulier ACTIVE), unicité du code de pass,
-- transmission au Bureau des demandes hors ligne d'un jour passé (médiation, jamais d'attribution automatique).

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_cards_qr_code_key ON public.loyalty_cards(qr_code);

CREATE OR REPLACE FUNCTION public.award_manual_stamp(_member_id uuid, _bureau_id uuid, _activity_id uuid, _event_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); card uuid; k text; sid uuid; pro_name text; member_name text; m_type text; m_status text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF NOT public.is_professional(me) THEN RAISE EXCEPTION 'Réservé aux professionnels validés'; END IF;
  IF _member_id = me THEN RAISE EXCEPTION 'Impossible de s''attribuer un tampon'; END IF;
  SELECT membership_type, membership_status INTO m_type, m_status FROM public.profiles WHERE id = _member_id;
  IF m_type IS DISTINCT FROM 'PARTICULIER' THEN
    RAISE EXCEPTION 'Les tampons manuels sont réservés aux membres particuliers';
  END IF;
  IF m_status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'Adhésion pas encore validée par le Bureau : le tampon sera possible après validation';
  END IF;
  IF _bureau_id IS NULL OR NOT public.is_bureau(_bureau_id) THEN RAISE EXCEPTION 'Choisissez un membre du Bureau à informer'; END IF;
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
    (_bureau_id, me, 'LOYALTY_MANUAL', 'Tampon attribué manuellement', pro_name || ' a attribué un tampon à ' || member_name || ' — ' || trim(_reason), 'loyalty_stamp', sid, '/loyalty'),
    (_member_id, me, 'LOYALTY_STAMP', '+1 tampon', 'Validé par ' || pro_name || ' — ' || trim(_reason), 'loyalty_stamp', sid, '/loyalty');
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_values)
  VALUES (me, 'LOYALTY_MANUAL_STAMP', 'loyalty_stamp', sid, jsonb_build_object('member', _member_id, 'bureau', _bureau_id, 'activity', _activity_id, 'event', _event_id, 'reason', _reason));
  RETURN jsonb_build_object('awarded', true, 'stamp_id', sid);
END $$;

-- Liste proposée aux pros : seulement les particuliers dont l'adhésion est validée (Option A).
CREATE OR REPLACE FUNCTION public.list_particuliers()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN NOT public.is_professional(auth.uid()) THEN '[]'::jsonb ELSE COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', COALESCE(p.display_name, trim(concat(p.first_name,' ',p.last_name)))) ORDER BY p.display_name)
    FROM public.profiles p WHERE p.membership_type = 'PARTICULIER' AND p.membership_status = 'ACTIVE' AND p.id <> auth.uid()), '[]'::jsonb) END
$$;

-- Médiation : un pro transmet au Bureau une demande hors ligne d'un jour passé. Aucun tampon n'est créé.
CREATE OR REPLACE FUNCTION public.submit_offline_stamp_mediation(_local_id uuid, _member_id uuid, _bureau_id uuid, _reason text, _offline_day date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); today date := (now() AT TIME ZONE 'Europe/Paris')::date; pro_name text; member_name text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF NOT public.is_professional(me) THEN RAISE EXCEPTION 'Réservé aux professionnels validés'; END IF;
  IF _local_id IS NULL THEN RAISE EXCEPTION 'Demande locale invalide'; END IF;
  IF _member_id IS NULL OR _member_id = me THEN RAISE EXCEPTION 'Membre invalide'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _member_id AND membership_type = 'PARTICULIER') THEN
    RAISE EXCEPTION 'Les tampons manuels sont réservés aux membres particuliers';
  END IF;
  IF _bureau_id IS NULL OR NOT public.is_bureau(_bureau_id) THEN RAISE EXCEPTION 'Choisissez un membre du Bureau à informer'; END IF;
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
    left(coalesce(pro_name,'Un professionnel') || ' demande une médiation pour ' || coalesce(member_name,'un membre') || ' (séance du ' || to_char(_offline_day,'DD/MM/YYYY') || ') — ' || trim(_reason), 300),
    'profile', _member_id, '/members/' || _member_id);
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_values)
  VALUES (me, 'LOYALTY_OFFLINE_MEDIATION', 'offline_stamp_request', _local_id,
    jsonb_build_object('member', _member_id, 'bureau', _bureau_id, 'reason', trim(_reason), 'offline_day', _offline_day));
  RETURN jsonb_build_object('submitted', true);
END $$;

REVOKE EXECUTE ON FUNCTION public.submit_offline_stamp_mediation(uuid, uuid, uuid, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_offline_stamp_mediation(uuid, uuid, uuid, text, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.award_manual_stamp(uuid,uuid,uuid,uuid,text), public.list_particuliers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_manual_stamp(uuid,uuid,uuid,uuid,text), public.list_particuliers() TO authenticated;