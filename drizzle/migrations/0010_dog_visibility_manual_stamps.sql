SET check_function_bodies = off;

ALTER TABLE public.dogs ADD COLUMN IF NOT EXISTS private_sections text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.dogs ADD COLUMN IF NOT EXISTS referent_can_share_followup boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hide_sensitive_dogs boolean NOT NULL DEFAULT false;
ALTER TABLE public.loyalty_stamps ADD COLUMN IF NOT EXISTS awarded_by uuid;
ALTER TABLE public.loyalty_stamps ADD COLUMN IF NOT EXISTS notified_bureau_id uuid;
ALTER TABLE public.loyalty_stamps ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE public.loyalty_stamps ADD COLUMN IF NOT EXISTS event_id uuid;
ALTER TABLE public.loyalty_stamps ADD COLUMN IF NOT EXISTS manual_key text;
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_stamps_manual_key_uniq ON public.loyalty_stamps(manual_key) WHERE manual_key IS NOT NULL;

-- Bureau : accès complet par défaut, retirable par la personne elle-même
CREATE OR REPLACE FUNCTION public.bureau_dog_full(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_bureau(_user_id) AND public.has_permission(_user_id, 'dogs.read_sensitive')
    AND NOT COALESCE((SELECT hide_sensitive_dogs FROM public.profiles WHERE id = _user_id), false)
$$;

CREATE OR REPLACE FUNCTION public.is_dog_keeper(_user_id uuid, _dog_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.dogs d WHERE d.id = _dog_id AND (d.owner_id = _user_id
    OR (d.household_id IS NOT NULL AND public.is_household_member(_user_id, d.household_id))))
$$;

-- Gestion des accès (partage/retrait) : propriétaire/foyer ou Bureau habilité
CREATE OR REPLACE FUNCTION public.can_manage_dog(_user_id uuid, _dog_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_dog_keeper(_user_id, _dog_id) OR public.bureau_dog_full(_user_id)
$$;

-- Rubrique visible : propriétaire, Bureau (hors rubriques privées), pro autorisé
CREATE OR REPLACE FUNCTION public.dog_section_visible(_user_id uuid, _dog_id uuid, _section text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_dog_keeper(_user_id, _dog_id)
    OR (public.bureau_dog_full(_user_id) AND NOT EXISTS (SELECT 1 FROM public.dogs d WHERE d.id = _dog_id AND _section = ANY (d.private_sections)))
    OR public.pro_dog_perm(_user_id, _dog_id, _section)
$$;

-- Vue opérationnelle pro : référent, activité/événement, réservation terrain
CREATE OR REPLACE FUNCTION public.can_view_dog_operational(_user_id uuid, _dog_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_professional(_user_id) AND (
    EXISTS (SELECT 1 FROM public.dog_referents r WHERE r.dog_id = _dog_id AND r.professional_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.participation_dogs pd JOIN public.participations p ON p.id = pd.participation_id
        LEFT JOIN public.activities a ON a.id = p.activity_id LEFT JOIN public.events e ON e.id = p.event_id
        WHERE pd.dog_id = _dog_id AND COALESCE(p.registration_status,'') <> 'CANCELLED'
          AND (a.professional_id = _user_id OR a.referent_id = _user_id OR _user_id = ANY (COALESCE(a.professional_ids,'{}'))
            OR e.professional_id = _user_id OR e.referent_id = _user_id OR _user_id = ANY (COALESCE(e.professional_ids,'{}'))))
    OR EXISTS (SELECT 1 FROM public.terrain_reservation_dogs rd JOIN public.terrain_reservations t ON t.id = rd.reservation_id
        WHERE rd.dog_id = _dog_id AND t.status <> 'CANCELLED' AND t.status <> 'REJECTED'
          AND (t.professional_id = _user_id OR t.requested_by = _user_id
            OR EXISTS (SELECT 1 FROM public.terrain_reservation_professionals rp WHERE rp.reservation_id = t.id AND rp.professional_id = _user_id))))
$$;

-- Chiens : la table n'est lue directement que par le propriétaire/foyer ; Bureau et pros passent par les fonctions
DROP POLICY IF EXISTS dogs_manage_own ON public.dogs;
DROP POLICY IF EXISTS dogs_select ON public.dogs;
CREATE POLICY dogs_manage_own ON public.dogs FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS dg_select ON public.dog_goals;
CREATE POLICY dg_select ON public.dog_goals FOR SELECT TO authenticated USING (public.dog_section_visible(auth.uid(), dog_id, 'goals'));
DROP POLICY IF EXISTS do_select ON public.dog_observations;
CREATE POLICY do_select ON public.dog_observations FOR SELECT TO authenticated USING (public.dog_section_visible(auth.uid(), dog_id, 'observations'));

-- Liste Bureau : tous les chiens (principal), détail selon habilitation et rubriques privées
CREATE OR REPLACE FUNCTION public.bureau_dogs()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); full boolean;
BEGIN
  IF NOT public.is_bureau(me) THEN RAISE EXCEPTION 'Réservé au Bureau'; END IF;
  full := public.bureau_dog_full(me);
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', d.id, 'name', d.name, 'breed', d.breed, 'sex', d.sex,
    'household', h.name, 'owner', COALESCE(p.display_name, trim(concat(p.first_name,' ',p.last_name))),
    'full', full, 'private_sections', d.private_sections,
    'info', CASE WHEN full AND NOT ('info' = ANY (d.private_sections)) THEN jsonb_build_object('character', d.character, 'needs', d.needs, 'useful_information', d.useful_information) END,
    'goals', CASE WHEN full AND NOT ('goals' = ANY (d.private_sections)) THEN (SELECT COALESCE(jsonb_agg(jsonb_build_object('title', g.title, 'status', g.status)), '[]'::jsonb) FROM public.dog_goals g WHERE g.dog_id = d.id) END,
    'observations', CASE WHEN full AND NOT ('observations' = ANY (d.private_sections)) THEN (SELECT COALESCE(jsonb_agg(jsonb_build_object('body', o.body, 'created_at', o.created_at) ORDER BY o.created_at DESC), '[]'::jsonb) FROM public.dog_observations o WHERE o.dog_id = d.id) END
  ) ORDER BY d.name) FROM public.dogs d LEFT JOIN public.households h ON h.id = d.household_id LEFT JOIN public.profiles p ON p.id = d.owner_id), '[]'::jsonb);
END $$;

-- Chiens côté pro : accès partagé + vue opérationnelle
CREATE OR REPLACE FUNCTION public.get_pro_dogs()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ids AS (
    SELECT a.dog_id FROM public.dog_professional_access a
      WHERE a.professional_id = auth.uid() AND NOT a.revoked AND (a.expires_at IS NULL OR a.expires_at > now())
    UNION SELECT d.id FROM public.dogs d WHERE public.can_view_dog_operational(auth.uid(), d.id)
  )
  SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'id', d.id,
      'is_referent', EXISTS (SELECT 1 FROM public.dog_referents r WHERE r.dog_id = d.id AND r.professional_id = auth.uid()),
      'operational', op.v,
      'can_share_followup', d.referent_can_share_followup,
      'expires_at', a.expires_at,
      'perms', jsonb_build_object('identity', COALESCE(a.can_identity,false) OR op.v, 'info', COALESCE(a.can_info,false) OR op.v, 'goals', COALESCE(a.can_goals,false), 'activities', COALESCE(a.can_activities,false), 'observations', COALESCE(a.can_observations,false)),
      'identity', CASE WHEN COALESCE(a.can_identity,false) OR op.v THEN jsonb_build_object('name', d.name, 'breed', d.breed, 'sex', d.sex, 'birth_date', d.birth_date, 'photo_url', d.photo_url) END,
      'info', CASE WHEN COALESCE(a.can_info,false) OR op.v THEN jsonb_build_object('character', d.character, 'needs', d.needs, 'useful_information', d.useful_information) END,
      'goals', CASE WHEN a.can_goals THEN (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', g.id, 'title', g.title, 'status', g.status) ORDER BY g.created_at DESC), '[]'::jsonb) FROM public.dog_goals g WHERE g.dog_id = d.id) END,
      'activities', CASE WHEN a.can_activities THEN (SELECT COALESCE(jsonb_agg(jsonb_build_object('title', COALESCE(ac.title, ev.title), 'date', COALESCE(ac.date, ev.start_date))), '[]'::jsonb)
          FROM public.participation_dogs pd JOIN public.participations p ON p.id = pd.participation_id
          LEFT JOIN public.activities ac ON ac.id = p.activity_id LEFT JOIN public.events ev ON ev.id = p.event_id
          WHERE pd.dog_id = d.id) END,
      'observations', CASE WHEN a.can_observations THEN (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', o.id, 'body', o.body, 'created_at', o.created_at, 'mine', o.author_id = auth.uid()) ORDER BY o.created_at DESC), '[]'::jsonb) FROM public.dog_observations o WHERE o.dog_id = d.id) END
    ) x
    FROM ids JOIN public.dogs d ON d.id = ids.dog_id
    LEFT JOIN public.dog_professional_access a ON a.dog_id = d.id AND a.professional_id = auth.uid() AND NOT a.revoked AND (a.expires_at IS NULL OR a.expires_at > now())
    CROSS JOIN LATERAL (SELECT public.can_view_dog_operational(auth.uid(), d.id) AS v) op
  ) s
$$;

-- Partage : le référent ne partage le suivi (objectifs/observations) qu'avec l'accord du propriétaire
CREATE OR REPLACE FUNCTION public.share_dog_access(_dog_id uuid, _professional_id uuid, _identity boolean, _info boolean, _goals boolean, _activities boolean, _observations boolean, _context text, _expires_at timestamp with time zone)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); src public.dog_professional_access%ROWTYPE; cur public.dog_professional_access%ROWTYPE; is_owner boolean; new_id uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF _professional_id = me THEN RAISE EXCEPTION 'Impossible de s''accorder un accès à soi-même'; END IF;
  IF NOT public.is_professional(_professional_id) THEN RAISE EXCEPTION 'Le destinataire doit être un professionnel validé'; END IF;
  IF coalesce(trim(_context),'') = '' THEN RAISE EXCEPTION 'Le contexte du partage est obligatoire'; END IF;
  is_owner := public.can_manage_dog(me, _dog_id);
  IF NOT is_owner THEN
    IF NOT EXISTS (SELECT 1 FROM public.dog_referents r WHERE r.dog_id = _dog_id AND r.professional_id = me) THEN
      RAISE EXCEPTION 'Seul le propriétaire ou un professionnel référent peut partager ce dossier';
    END IF;
    IF (coalesce(_goals,false) OR coalesce(_observations,false))
       AND NOT EXISTS (SELECT 1 FROM public.dogs d WHERE d.id = _dog_id AND d.referent_can_share_followup) THEN
      RAISE EXCEPTION 'Le propriétaire n''a pas autorisé le partage du suivi (objectifs, observations)';
    END IF;
    SELECT * INTO src FROM public.dog_professional_access a
      WHERE a.dog_id = _dog_id AND a.professional_id = me AND NOT a.revoked
        AND (a.expires_at IS NULL OR a.expires_at > now()) LIMIT 1;
    IF src.id IS NULL THEN RAISE EXCEPTION 'Aucun accès actif à partager'; END IF;
    IF (_identity AND NOT src.can_identity) OR (_info AND NOT src.can_info) OR (_goals AND NOT src.can_goals)
       OR (_activities AND NOT src.can_activities) OR (_observations AND NOT src.can_observations) THEN
      RAISE EXCEPTION 'Vous ne pouvez pas partager plus que vos propres droits';
    END IF;
    IF src.expires_at IS NOT NULL AND (_expires_at IS NULL OR _expires_at > src.expires_at) THEN
      _expires_at := src.expires_at;
    END IF;
  END IF;
  SELECT * INTO cur FROM public.dog_professional_access WHERE dog_id = _dog_id AND professional_id = _professional_id;
  IF cur.id IS NOT NULL AND NOT cur.revoked AND (cur.expires_at IS NULL OR cur.expires_at > now()) THEN
    RAISE EXCEPTION 'Ce professionnel dispose déjà d''un accès actif : retirez-le avant d''en accorder un nouveau';
  END IF;
  IF cur.id IS NOT NULL THEN
    UPDATE public.dog_professional_access SET can_identity = coalesce(_identity,false), can_info = coalesce(_info,false),
      can_goals = coalesce(_goals,false), can_activities = coalesce(_activities,false), can_observations = coalesce(_observations,false),
      granted_by = me, expires_at = _expires_at, context = trim(_context), source_access_id = src.id,
      revoked = false, revoked_at = NULL, revoked_by = NULL
    WHERE id = cur.id RETURNING id INTO new_id;
  ELSE
    INSERT INTO public.dog_professional_access (dog_id, professional_id, can_identity, can_info, can_goals,
      can_activities, can_observations, granted_by, expires_at, context, source_access_id)
    VALUES (_dog_id, _professional_id, coalesce(_identity,false), coalesce(_info,false), coalesce(_goals,false),
      coalesce(_activities,false), coalesce(_observations,false), me, _expires_at, trim(_context), src.id)
    RETURNING id INTO new_id;
  END IF;
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_values)
  VALUES (me, 'DOG_ACCESS_SHARED', 'dog', _dog_id, jsonb_build_object('access_id', new_id, 'to', _professional_id,
    'context', _context, 'expires_at', _expires_at, 'via_referent', NOT is_owner));
  RETURN new_id;
END $function$;

-- Tampon manuel par un professionnel, avec information d'un membre du Bureau choisi
CREATE OR REPLACE FUNCTION public.award_manual_stamp(_member_id uuid, _bureau_id uuid, _activity_id uuid, _event_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); card uuid; k text; sid uuid; pro_name text; member_name text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF NOT public.is_professional(me) THEN RAISE EXCEPTION 'Réservé aux professionnels validés'; END IF;
  IF _member_id = me THEN RAISE EXCEPTION 'Impossible de s''attribuer un tampon'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _member_id AND membership_type = 'PARTICULIER') THEN
    RAISE EXCEPTION 'Les tampons manuels sont réservés aux membres particuliers';
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

CREATE OR REPLACE FUNCTION public.list_bureau_members()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN '[]'::jsonb ELSE COALESCE((SELECT jsonb_agg(DISTINCT jsonb_build_object('id', p.id, 'name', COALESCE(p.display_name, trim(concat(p.first_name,' ',p.last_name)))))
    FROM public.profiles p WHERE public.is_bureau(p.id)), '[]'::jsonb) END
$$;

CREATE OR REPLACE FUNCTION public.list_particuliers()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN NOT public.is_professional(auth.uid()) THEN '[]'::jsonb ELSE COALESCE((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', COALESCE(p.display_name, trim(concat(p.first_name,' ',p.last_name)))) ORDER BY p.display_name)
    FROM public.profiles p WHERE p.membership_type = 'PARTICULIER' AND p.id <> auth.uid()), '[]'::jsonb) END
$$;

REVOKE EXECUTE ON FUNCTION public.award_manual_stamp(uuid,uuid,uuid,uuid,text), public.bureau_dogs(), public.list_bureau_members(), public.list_particuliers(), public.get_pro_dogs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_manual_stamp(uuid,uuid,uuid,uuid,text), public.bureau_dogs(), public.list_bureau_members(), public.list_particuliers(), public.get_pro_dogs() TO authenticated;