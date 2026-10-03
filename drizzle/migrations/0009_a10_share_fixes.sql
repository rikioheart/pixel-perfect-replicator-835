SET check_function_bodies = off;
CREATE OR REPLACE FUNCTION public.can_share_entity(_user_id uuid, _entity_type text, _entity_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_vis text; v_sens text; v_owner uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF _entity_type = 'document' THEN
    SELECT d.visibility, d.sensitivity, d.uploaded_by INTO v_vis, v_sens, v_owner FROM public.documents d WHERE d.id = _entity_id;
    IF NOT FOUND THEN RETURN false; END IF;
    -- jamais de lien public pour un document Bureau ou SENSIBLE, quel que soit l'appelant
    IF upper(coalesce(v_vis,'')) = 'BUREAU' OR v_sens = 'SENSIBLE' THEN RETURN false; END IF;
    RETURN public.is_bureau(_user_id) OR v_owner = _user_id;
  END IF;
  IF public.is_bureau(_user_id) THEN RETURN true; END IF;
  IF _entity_type = 'project' THEN
    SELECT p.owner_id INTO v_owner FROM public.projects p WHERE p.id = _entity_id;
    RETURN v_owner IS NOT NULL AND v_owner = _user_id;
  END IF;
  IF _entity_type = 'event' THEN
    SELECT e.created_by INTO v_owner FROM public.events e WHERE e.id = _entity_id;
    RETURN v_owner IS NOT NULL AND v_owner = _user_id;
  END IF;
  RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.share_dog_access(_dog_id uuid, _professional_id uuid,
  _identity boolean, _info boolean, _goals boolean, _activities boolean, _observations boolean,
  _context text, _expires_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
    RAISE EXCEPTION 'Ce professionnel dispose déjà d''un accès actif : révoquez-le avant d''en accorder un nouveau';
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
END $$;