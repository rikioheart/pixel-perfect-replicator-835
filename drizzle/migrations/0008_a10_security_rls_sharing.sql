SET check_function_bodies = off;

-- C1 : garde des colonnes sensibles du profil
CREATE OR REPLACE FUNCTION public.guard_profile_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_bureau(auth.uid()) THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.membership_status := 'PENDING';
    IF NEW.membership_type NOT IN ('PARTICULIER','PROFESSIONNEL') THEN NEW.membership_type := 'PARTICULIER'; END IF;
  ELSE
    IF NEW.membership_type IS DISTINCT FROM OLD.membership_type
       OR NEW.membership_status IS DISTINCT FROM OLD.membership_status THEN
      RAISE EXCEPTION 'Seul le Bureau peut modifier le type ou le statut d''adhésion';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_profiles_guard_membership ON public.profiles;
CREATE TRIGGER trg_profiles_guard_membership BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_membership();

-- un professionnel n'est reconnu qu'une fois validé
CREATE OR REPLACE FUNCTION public.is_professional(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id
    AND p.membership_type = 'PROFESSIONNEL' AND p.membership_status = 'ACTIVE')
$$;

-- C2 : fonctions internes non appelables par l'API
REVOKE EXECUTE ON FUNCTION public.apply_loyalty_rules(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_once(uuid, text, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_daily_reminders() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_weekly_bureau_digest() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_bureau_bootstrap() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_loyalty_rules(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_once(uuid, text, text, text, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_daily_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.run_weekly_bureau_digest() TO service_role;

-- Permissions de gouvernance des données sensibles
INSERT INTO public.permissions (code, name, description, module, action) VALUES
  ('dogs.read_sensitive', 'Consulter les dossiers chiens', 'Accès Bureau aux dossiers, objectifs et observations des chiens', 'members', 'read_sensitive'),
  ('data.read_sensitive', 'Consulter les données sensibles', 'Accès aux contenus marqués SENSIBLE', 'settings', 'read_sensitive')
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.code = 'ADMIN_BUREAU' AND p.code IN ('dogs.read_sensitive','data.read_sensitive')
ON CONFLICT DO NOTHING;

-- I2 : le Bureau n'accède aux chiens que s'il a la permission
CREATE OR REPLACE FUNCTION public.can_manage_dog(_user_id uuid, _dog_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.dogs d WHERE d.id = _dog_id AND (
    d.owner_id = _user_id
    OR (public.is_bureau(_user_id) AND public.has_permission(_user_id, 'dogs.read_sensitive'))
    OR (d.household_id IS NOT NULL AND public.is_household_member(_user_id, d.household_id))))
$$;
DROP POLICY IF EXISTS dogs_manage_own ON public.dogs;
DROP POLICY IF EXISTS dogs_select ON public.dogs;
CREATE POLICY dogs_manage_own ON public.dogs FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR (public.is_bureau(auth.uid()) AND public.has_permission(auth.uid(),'dogs.read_sensitive')))
  WITH CHECK (owner_id = auth.uid() OR (public.is_bureau(auth.uid()) AND public.has_permission(auth.uid(),'dogs.read_sensitive')));
CREATE POLICY dogs_select ON public.dogs FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR (public.is_bureau(auth.uid()) AND public.has_permission(auth.uid(),'dogs.read_sensitive')));

-- I4 : sensibilité à 3 niveaux
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS sensitivity text NOT NULL DEFAULT 'INTERNE';
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS sensitivity text NOT NULL DEFAULT 'INTERNE';
ALTER TABLE public.dog_observations ADD COLUMN IF NOT EXISTS sensitivity text NOT NULL DEFAULT 'SENSIBLE';
UPDATE public.documents SET sensitivity = 'SENSIBLE' WHERE upper(coalesce(visibility,'')) = 'BUREAU';
ALTER TABLE public.documents ADD CONSTRAINT documents_sensitivity_chk CHECK (sensitivity IN ('PUBLIC','INTERNE','SENSIBLE'));
ALTER TABLE public.comments ADD CONSTRAINT comments_sensitivity_chk CHECK (sensitivity IN ('PUBLIC','INTERNE','SENSIBLE'));
ALTER TABLE public.dog_observations ADD CONSTRAINT dog_obs_sensitivity_chk CHECK (sensitivity IN ('PUBLIC','INTERNE','SENSIBLE'));

DROP POLICY IF EXISTS documents_select ON public.documents;
CREATE POLICY documents_select ON public.documents FOR SELECT TO authenticated
  USING (
    (upper(coalesce(visibility,'')) <> 'BUREAU' AND sensitivity <> 'SENSIBLE')
    OR public.is_bureau(auth.uid())
    OR (sensitivity = 'SENSIBLE' AND public.has_permission(auth.uid(),'data.read_sensitive'))
    OR uploaded_by = auth.uid());

-- C3 : commentaires visibles selon l'objet parent
CREATE OR REPLACE FUNCTION public.can_view_comment_target(_user_id uuid, _type text, _id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v text; owner uuid; proj uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF public.is_bureau(_user_id) THEN RETURN true; END IF;
  IF _type = 'project' THEN RETURN public.can_view_project(_user_id, _id); END IF;
  IF _type = 'task' THEN
    SELECT t.project_id, t.assigned_user_id, upper(coalesce(t.visibility,'')) INTO proj, owner, v FROM public.tasks t WHERE t.id = _id;
    IF NOT FOUND THEN RETURN false; END IF;
    IF owner = _user_id OR v IN ('ASSOCIATION','MEMBERS','PUBLIC') THEN RETURN true; END IF;
    RETURN proj IS NOT NULL AND public.can_view_project(_user_id, proj);
  END IF;
  IF _type = 'event' THEN
    SELECT upper(coalesce(e.visibility,'')), e.created_by INTO v, owner FROM public.events e WHERE e.id = _id;
    IF NOT FOUND THEN RETURN false; END IF;
    RETURN v <> 'BUREAU' OR owner = _user_id;
  END IF;
  IF _type = 'document' THEN
    SELECT upper(coalesce(d.visibility,'')), d.uploaded_by INTO v, owner FROM public.documents d WHERE d.id = _id;
    IF NOT FOUND THEN RETURN false; END IF;
    RETURN (v <> 'BUREAU' AND (SELECT sensitivity FROM public.documents WHERE id = _id) <> 'SENSIBLE') OR owner = _user_id;
  END IF;
  RETURN false;
END $$;

DROP POLICY IF EXISTS comments_select ON public.comments;
CREATE POLICY comments_select ON public.comments FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR (
    public.can_view_comment_target(auth.uid(), entity_type, entity_id)
    AND (sensitivity <> 'SENSIBLE' OR public.is_bureau(auth.uid()))));
DROP POLICY IF EXISTS comments_insert ON public.comments;
CREATE POLICY comments_insert ON public.comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.can_view_comment_target(auth.uid(), entity_type, entity_id));

-- I1 : réservations terrain limitées aux personnes concernées
CREATE OR REPLACE FUNCTION public.can_view_terrain_reservation(_user_id uuid, _rid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.can_manage_terrain_reservation(_user_id, _rid)
    OR EXISTS (SELECT 1 FROM public.terrain_reservation_professionals p WHERE p.reservation_id = _rid AND p.professional_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.terrain_reservation_people pp WHERE pp.reservation_id = _rid AND pp.person_id = public.current_person_id(_user_id))
    OR EXISTS (SELECT 1 FROM public.terrain_reservation_dogs d WHERE d.reservation_id = _rid AND public.can_manage_dog(_user_id, d.dog_id))
$$;
DROP POLICY IF EXISTS terrain_resv_select ON public.terrain_reservations;
CREATE POLICY terrain_resv_select ON public.terrain_reservations FOR SELECT TO authenticated
  USING (public.can_view_terrain_reservation(auth.uid(), id));

-- créneaux occupés (sans détail) pour l'agenda partagé
CREATE OR REPLACE FUNCTION public.terrain_busy_slots(_from date, _to date)
RETURNS TABLE(resource_id uuid, date date, start_time time, end_time time)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT r.resource_id, r.date, r.start_time, r.end_time FROM public.terrain_reservations r
  WHERE auth.uid() IS NOT NULL AND r.date BETWEEN _from AND _to
    AND upper(r.status) NOT IN ('CANCELLED','ANNULE','REFUSED','REFUSE')
$$;
REVOKE EXECUTE ON FUNCTION public.terrain_busy_slots(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.terrain_busy_slots(date, date) TO authenticated;

-- chevauchement contrôlé par la base
CREATE OR REPLACE FUNCTION public.check_terrain_reservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.end_time <= NEW.start_time THEN
    RAISE EXCEPTION 'L''heure de fin doit être postérieure à l''heure de début';
  END IF;
  IF upper(coalesce(NEW.status,'')) NOT IN ('CANCELLED','ANNULE','REFUSED','REFUSE') AND EXISTS (
    SELECT 1 FROM public.terrain_reservations r WHERE r.id <> NEW.id AND r.resource_id = NEW.resource_id
      AND r.date = NEW.date AND r.start_time < NEW.end_time AND r.end_time > NEW.start_time
      AND upper(coalesce(r.status,'')) NOT IN ('CANCELLED','ANNULE','REFUSED','REFUSE')) THEN
    RAISE EXCEPTION 'Ce créneau est déjà réservé';
  END IF;
  RETURN NEW;
END $$;

-- I3 : partage explicite et contextualisé d'un dossier chien
ALTER TABLE public.dog_professional_access
  ADD COLUMN IF NOT EXISTS context text,
  ADD COLUMN IF NOT EXISTS source_access_id uuid REFERENCES public.dog_professional_access(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sensitivity text NOT NULL DEFAULT 'SENSIBLE',
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by uuid;

CREATE OR REPLACE FUNCTION public.share_dog_access(_dog_id uuid, _professional_id uuid,
  _identity boolean, _info boolean, _goals boolean, _activities boolean, _observations boolean,
  _context text, _expires_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE me uuid := auth.uid(); src public.dog_professional_access%ROWTYPE; is_owner boolean; new_id uuid;
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
        AND (a.expires_at IS NULL OR a.expires_at > now())
      ORDER BY a.created_at DESC LIMIT 1;
    IF src.id IS NULL THEN RAISE EXCEPTION 'Aucun accès actif à partager'; END IF;
    IF (_identity AND NOT src.can_identity) OR (_info AND NOT src.can_info) OR (_goals AND NOT src.can_goals)
       OR (_activities AND NOT src.can_activities) OR (_observations AND NOT src.can_observations) THEN
      RAISE EXCEPTION 'Vous ne pouvez pas partager plus que vos propres droits';
    END IF;
    IF src.expires_at IS NOT NULL AND (_expires_at IS NULL OR _expires_at > src.expires_at) THEN
      _expires_at := src.expires_at;
    END IF;
  END IF;
  INSERT INTO public.dog_professional_access (dog_id, professional_id, can_identity, can_info, can_goals,
    can_activities, can_observations, granted_by, expires_at, context, source_access_id)
  VALUES (_dog_id, _professional_id, coalesce(_identity,false), coalesce(_info,false), coalesce(_goals,false),
    coalesce(_activities,false), coalesce(_observations,false), me, _expires_at, trim(_context), src.id)
  RETURNING id INTO new_id;
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_values)
  VALUES (me, 'DOG_ACCESS_SHARED', 'dog', _dog_id, jsonb_build_object('access_id', new_id, 'to', _professional_id,
    'context', _context, 'expires_at', _expires_at, 'via_referent', NOT is_owner));
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.revoke_dog_access(_access_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE me uuid := auth.uid(); a public.dog_professional_access%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.dog_professional_access WHERE id = _access_id;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Accès introuvable'; END IF;
  IF NOT (a.granted_by = me OR public.can_manage_dog(me, a.dog_id) OR public.is_bureau(me)) THEN
    RAISE EXCEPTION 'Révocation non autorisée';
  END IF;
  WITH RECURSIVE tree AS (
    SELECT id FROM public.dog_professional_access WHERE id = _access_id
    UNION ALL SELECT c.id FROM public.dog_professional_access c JOIN tree t ON c.source_access_id = t.id)
  UPDATE public.dog_professional_access SET revoked = true, revoked_at = now(), revoked_by = me
  WHERE id IN (SELECT id FROM tree) AND NOT revoked;
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_values)
  VALUES (me, 'DOG_ACCESS_REVOKED', 'dog', a.dog_id, jsonb_build_object('access_id', _access_id));
END $$;
REVOKE EXECUTE ON FUNCTION public.share_dog_access(uuid,uuid,boolean,boolean,boolean,boolean,boolean,text,timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_dog_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_dog_access(uuid,uuid,boolean,boolean,boolean,boolean,boolean,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_dog_access(uuid) TO authenticated;

-- le donneur (référent) voit les accès qu'il a accordés
DROP POLICY IF EXISTS dpa_select ON public.dog_professional_access;
CREATE POLICY dpa_select ON public.dog_professional_access FOR SELECT TO authenticated
  USING (professional_id = auth.uid() OR granted_by = auth.uid() OR public.can_manage_dog(auth.uid(), dog_id));

-- les observations SENSIBLES restent réservées au propriétaire et aux pros autorisés (inchangé), Bureau via permission (can_manage_dog)
