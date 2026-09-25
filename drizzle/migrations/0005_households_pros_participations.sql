SET check_function_bodies = off;
-- ===== FOYERS =====
CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'ADULT' CHECK (role IN ('ADMIN','ADULT')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, user_id)
);
CREATE TABLE public.household_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  birth_year integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.households, public.household_members, public.household_children TO authenticated;
GRANT ALL ON public.households, public.household_members, public.household_children TO service_role;

CREATE OR REPLACE FUNCTION public.is_household_member(_user_id uuid, _household_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.household_members m WHERE m.household_id = _household_id AND m.user_id = _user_id)
$$;
CREATE OR REPLACE FUNCTION public.is_household_admin(_user_id uuid, _household_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.households h WHERE h.id = _household_id AND h.created_by = _user_id)
      OR EXISTS (SELECT 1 FROM public.household_members m WHERE m.household_id = _household_id AND m.user_id = _user_id AND m.role = 'ADMIN')
$$;

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_children ENABLE ROW LEVEL SECURITY;

CREATE POLICY households_select ON public.households FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_household_member(auth.uid(), id) OR public.is_bureau(auth.uid()));
CREATE POLICY households_insert ON public.households FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY households_update ON public.households FOR UPDATE TO authenticated
  USING (public.is_household_admin(auth.uid(), id) OR public.is_bureau(auth.uid()));
CREATE POLICY households_delete ON public.households FOR DELETE TO authenticated
  USING (public.is_household_admin(auth.uid(), id) OR public.is_bureau(auth.uid()));

CREATE POLICY hm_select ON public.household_members FOR SELECT TO authenticated
  USING (public.is_household_member(auth.uid(), household_id) OR public.is_bureau(auth.uid()));
CREATE POLICY hm_manage ON public.household_members FOR ALL TO authenticated
  USING (public.is_household_admin(auth.uid(), household_id) OR public.is_bureau(auth.uid()))
  WITH CHECK (public.is_household_admin(auth.uid(), household_id) OR public.is_bureau(auth.uid()));
CREATE POLICY hm_leave ON public.household_members FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY hc_select ON public.household_children FOR SELECT TO authenticated
  USING (public.is_household_member(auth.uid(), household_id) OR public.is_bureau(auth.uid()));
CREATE POLICY hc_manage ON public.household_children FOR ALL TO authenticated
  USING (public.is_household_member(auth.uid(), household_id) OR public.is_bureau(auth.uid()))
  WITH CHECK (public.is_household_member(auth.uid(), household_id) OR public.is_bureau(auth.uid()));

CREATE OR REPLACE FUNCTION public.household_add_creator()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.household_members (household_id, user_id, role) VALUES (NEW.id, NEW.created_by, 'ADMIN')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_household_creator AFTER INSERT ON public.households FOR EACH ROW EXECUTE FUNCTION public.household_add_creator();
CREATE TRIGGER trg_households_updated BEFORE UPDATE ON public.households FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== CHIENS =====
ALTER TABLE public.dogs ADD COLUMN household_id uuid REFERENCES public.households(id) ON DELETE SET NULL;
CREATE POLICY dogs_household ON public.dogs FOR ALL TO authenticated
  USING (household_id IS NOT NULL AND public.is_household_member(auth.uid(), household_id))
  WITH CHECK (household_id IS NOT NULL AND public.is_household_member(auth.uid(), household_id));

CREATE OR REPLACE FUNCTION public.can_manage_dog(_user_id uuid, _dog_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.dogs d WHERE d.id = _dog_id AND (
    d.owner_id = _user_id OR public.is_bureau(_user_id)
    OR (d.household_id IS NOT NULL AND public.is_household_member(_user_id, d.household_id))))
$$;

CREATE TABLE public.dog_professional_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  can_identity boolean NOT NULL DEFAULT true,
  can_info boolean NOT NULL DEFAULT false,
  can_goals boolean NOT NULL DEFAULT false,
  can_activities boolean NOT NULL DEFAULT false,
  can_observations boolean NOT NULL DEFAULT false,
  granted_by uuid DEFAULT auth.uid(),
  expires_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dog_id, professional_id)
);
CREATE TABLE public.dog_referents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dog_id, professional_id)
);
CREATE TABLE public.dog_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'EN_COURS' CHECK (status IN ('EN_COURS','ATTEINT','ABANDONNE')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dog_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dog_professional_access, public.dog_referents, public.dog_goals, public.dog_observations TO authenticated;
GRANT ALL ON public.dog_professional_access, public.dog_referents, public.dog_goals, public.dog_observations TO service_role;

CREATE OR REPLACE FUNCTION public.pro_dog_perm(_user_id uuid, _dog_id uuid, _section text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.dog_professional_access a
    WHERE a.dog_id = _dog_id AND a.professional_id = _user_id AND NOT a.revoked
      AND (a.expires_at IS NULL OR a.expires_at > now())
      AND CASE _section
        WHEN 'any' THEN true
        WHEN 'identity' THEN a.can_identity
        WHEN 'info' THEN a.can_info
        WHEN 'goals' THEN a.can_goals
        WHEN 'activities' THEN a.can_activities
        WHEN 'observations' THEN a.can_observations
        ELSE false END)
$$;

ALTER TABLE public.dog_professional_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dog_referents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dog_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dog_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY dpa_select ON public.dog_professional_access FOR SELECT TO authenticated
  USING (professional_id = auth.uid() OR public.can_manage_dog(auth.uid(), dog_id));
CREATE POLICY dpa_manage ON public.dog_professional_access FOR ALL TO authenticated
  USING (public.can_manage_dog(auth.uid(), dog_id)) WITH CHECK (public.can_manage_dog(auth.uid(), dog_id));

CREATE POLICY dr_select ON public.dog_referents FOR SELECT TO authenticated
  USING (professional_id = auth.uid() OR public.can_manage_dog(auth.uid(), dog_id));
CREATE POLICY dr_manage ON public.dog_referents FOR ALL TO authenticated
  USING (public.can_manage_dog(auth.uid(), dog_id)) WITH CHECK (public.can_manage_dog(auth.uid(), dog_id));

CREATE POLICY dg_select ON public.dog_goals FOR SELECT TO authenticated
  USING (public.can_manage_dog(auth.uid(), dog_id) OR public.pro_dog_perm(auth.uid(), dog_id, 'goals'));
CREATE POLICY dg_insert ON public.dog_goals FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_dog(auth.uid(), dog_id) OR public.pro_dog_perm(auth.uid(), dog_id, 'goals'));
CREATE POLICY dg_update ON public.dog_goals FOR UPDATE TO authenticated
  USING (public.can_manage_dog(auth.uid(), dog_id) OR (created_by = auth.uid() AND public.pro_dog_perm(auth.uid(), dog_id, 'goals')));
CREATE POLICY dg_delete ON public.dog_goals FOR DELETE TO authenticated
  USING (public.can_manage_dog(auth.uid(), dog_id) OR created_by = auth.uid());

CREATE POLICY do_select ON public.dog_observations FOR SELECT TO authenticated
  USING (public.can_manage_dog(auth.uid(), dog_id) OR public.pro_dog_perm(auth.uid(), dog_id, 'observations'));
CREATE POLICY do_insert ON public.dog_observations FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND (public.can_manage_dog(auth.uid(), dog_id) OR public.pro_dog_perm(auth.uid(), dog_id, 'observations')));
CREATE POLICY do_delete ON public.dog_observations FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_bureau(auth.uid()));

-- ===== PROFESSIONNELS : PUBLIC / INTERNE =====
CREATE TABLE public.professional_public_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  display_name text NOT NULL,
  logo_url text,
  specialties text[] NOT NULL DEFAULT '{}',
  sector text,
  description text,
  website_url text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_email text,
  public_phone text,
  public_city text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_REVIEW','ACTIVE','SUSPENDED')),
  review_comment text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.professional_internal_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  contract_url text,
  partnership_percentage numeric NOT NULL DEFAULT 0,
  partnership_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  internal_notes text,
  admin_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.professional_collaborations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  happened_on date,
  is_public boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_public_profile, public.professional_collaborations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_internal_details TO authenticated;
GRANT ALL ON public.professional_public_profile, public.professional_internal_details, public.professional_collaborations TO service_role;

ALTER TABLE public.professional_public_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_internal_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_collaborations ENABLE ROW LEVEL SECURITY;

CREATE POLICY ppp_select ON public.professional_public_profile FOR SELECT TO authenticated
  USING (status = 'ACTIVE' OR profile_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY ppp_insert ON public.professional_public_profile FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY ppp_update ON public.professional_public_profile FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() OR public.is_bureau(auth.uid()))
  WITH CHECK (profile_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY ppp_delete ON public.professional_public_profile FOR DELETE TO authenticated
  USING (public.is_bureau(auth.uid()));

CREATE OR REPLACE FUNCTION public.guard_pro_profile_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_bureau(auth.uid()) THEN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.reviewed_by := auth.uid(); NEW.reviewed_at := now();
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('DRAFT','PENDING_REVIEW') THEN NEW.status := 'DRAFT'; END IF;
  ELSE
    IF OLD.status = 'SUSPENDED' AND NEW.status <> 'SUSPENDED' THEN
      RAISE EXCEPTION 'Fiche suspendue : contactez le Bureau';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('DRAFT','PENDING_REVIEW') THEN
      RAISE EXCEPTION 'Seul le Bureau peut publier ou suspendre une fiche';
    END IF;
    NEW.reviewed_by := OLD.reviewed_by; NEW.reviewed_at := OLD.reviewed_at;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_ppp_status BEFORE INSERT OR UPDATE ON public.professional_public_profile FOR EACH ROW EXECUTE FUNCTION public.guard_pro_profile_status();
CREATE TRIGGER trg_ppp_updated BEFORE UPDATE ON public.professional_public_profile FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY pid_select ON public.professional_internal_details FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY pid_manage ON public.professional_internal_details FOR ALL TO authenticated
  USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));
CREATE TRIGGER trg_pid_updated BEFORE UPDATE ON public.professional_internal_details FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY pc_select ON public.professional_collaborations FOR SELECT TO authenticated
  USING (is_public OR professional_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY pc_manage ON public.professional_collaborations FOR ALL TO authenticated
  USING (professional_id = auth.uid() OR public.is_bureau(auth.uid()))
  WITH CHECK (professional_id = auth.uid() OR public.is_bureau(auth.uid()));

INSERT INTO public.professional_public_profile (profile_id, slug, display_name, sector, description, website_url, social_links, status)
SELECT d.profile_id,
  trim(both '-' from regexp_replace(lower(COALESCE(d.company_name, 'pro')), '[^a-z0-9]+', '-', 'g')) || '-' || substr(d.profile_id::text, 1, 4),
  d.company_name, d.professional_category, d.description, d.website_url, d.social_links, 'DRAFT'
FROM public.pro_details d ON CONFLICT DO NOTHING;
INSERT INTO public.professional_internal_details (profile_id, contract_url, partnership_percentage)
SELECT d.profile_id, d.contract_url, d.partnership_percentage FROM public.pro_details d ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS pro_details_select ON public.pro_details;
CREATE POLICY pro_details_select ON public.pro_details FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_bureau(auth.uid()));
COMMENT ON COLUMN public.pro_details.partnership_percentage IS 'DEPRECATED: replaced by professional_internal_details';
COMMENT ON COLUMN public.pro_details.contract_url IS 'DEPRECATED: replaced by professional_internal_details';
COMMENT ON VIEW public.public_professionals IS 'DEPRECATED: replaced by professional_public_profile';

-- ===== ACTIVITÉS / ÉVÉNEMENTS / AVANTAGES =====
ALTER TABLE public.activities
  ADD COLUMN professional_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN referent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN dog_policy text NOT NULL DEFAULT 'OPTIONAL' CHECK (dog_policy IN ('NONE','OPTIONAL','REQUIRED','MULTIPLE')),
  ADD COLUMN max_dogs integer CHECK (max_dogs IS NULL OR max_dogs > 0),
  ADD COLUMN waitlist_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN for_you_if text,
  ADD COLUMN to_bring text,
  ADD COLUMN before_coming text,
  ADD COLUMN with_your_dog text;
ALTER TABLE public.events
  ADD COLUMN capacity integer,
  ADD COLUMN price_public numeric NOT NULL DEFAULT 0,
  ADD COLUMN price_member numeric NOT NULL DEFAULT 0,
  ADD COLUMN professional_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN referent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN dog_policy text NOT NULL DEFAULT 'OPTIONAL' CHECK (dog_policy IN ('NONE','OPTIONAL','REQUIRED','MULTIPLE')),
  ADD COLUMN max_dogs integer CHECK (max_dogs IS NULL OR max_dogs > 0),
  ADD COLUMN waitlist_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN for_you_if text,
  ADD COLUMN to_bring text,
  ADD COLUMN before_coming text,
  ADD COLUMN with_your_dog text;
ALTER TABLE public.advantages
  ADD COLUMN is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN professional_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ===== PARTICIPATIONS =====
ALTER TABLE public.participations
  ADD COLUMN household_id uuid REFERENCES public.households(id) ON DELETE SET NULL,
  ADD COLUMN registered_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN validated_at timestamptz,
  ADD COLUMN validated_by uuid,
  ADD COLUMN notes text;
ALTER TABLE public.participations ADD CONSTRAINT participations_one_target CHECK ((activity_id IS NULL) <> (event_id IS NULL));
CREATE UNIQUE INDEX participations_user_activity_uq ON public.participations (user_id, activity_id) WHERE activity_id IS NOT NULL;
CREATE UNIQUE INDEX participations_user_event_uq ON public.participations (user_id, event_id) WHERE event_id IS NOT NULL;

CREATE TABLE public.participation_dogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participation_id uuid NOT NULL REFERENCES public.participations(id) ON DELETE CASCADE,
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participation_id, dog_id)
);
CREATE TABLE public.participation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participation_id uuid NOT NULL REFERENCES public.participations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  household_child_id uuid REFERENCES public.household_children(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'ADULT' CHECK (role IN ('ADULT','CHILD')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((user_id IS NULL) <> (household_child_id IS NULL))
);
CREATE UNIQUE INDEX pm_user_uq ON public.participation_members (participation_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX pm_child_uq ON public.participation_members (participation_id, household_child_id) WHERE household_child_id IS NOT NULL;
GRANT SELECT, DELETE ON public.participation_dogs, public.participation_members TO authenticated;
GRANT ALL ON public.participation_dogs, public.participation_members TO service_role;

CREATE OR REPLACE FUNCTION public.can_view_participation(_user_id uuid, _pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.participations p WHERE p.id = _pid AND (
    p.user_id = _user_id OR public.is_bureau(_user_id)
    OR (p.household_id IS NOT NULL AND public.is_household_member(_user_id, p.household_id))))
$$;
ALTER TABLE public.participation_dogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participation_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY pd_select ON public.participation_dogs FOR SELECT TO authenticated USING (public.can_view_participation(auth.uid(), participation_id));
CREATE POLICY pd_delete ON public.participation_dogs FOR DELETE TO authenticated USING (public.can_view_participation(auth.uid(), participation_id));
CREATE POLICY pmem_select ON public.participation_members FOR SELECT TO authenticated USING (public.can_view_participation(auth.uid(), participation_id));
CREATE POLICY pmem_delete ON public.participation_members FOR DELETE TO authenticated USING (public.can_view_participation(auth.uid(), participation_id));
CREATE POLICY participations_household ON public.participations FOR SELECT TO authenticated
  USING (household_id IS NOT NULL AND public.is_household_member(auth.uid(), household_id));

CREATE OR REPLACE FUNCTION public.occupied_spots(_activity_id uuid, _event_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(GREATEST(1, (SELECT count(*) FROM public.participation_members m WHERE m.participation_id = p.id))), 0)::int
  FROM public.participations p
  WHERE ((_activity_id IS NOT NULL AND p.activity_id = _activity_id) OR (_event_id IS NOT NULL AND p.event_id = _event_id))
    AND upper(p.registration_status) NOT IN ('WAITLIST','CANCELLED','ANNULE','REFUSE')
$$;
CREATE OR REPLACE FUNCTION public.spots_info(_activity_id uuid, _event_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE cap int; wl boolean; used int;
BEGIN
  IF _activity_id IS NOT NULL THEN SELECT capacity, waitlist_enabled INTO cap, wl FROM public.activities WHERE id = _activity_id;
  ELSE SELECT capacity, waitlist_enabled INTO cap, wl FROM public.events WHERE id = _event_id; END IF;
  used := public.occupied_spots(_activity_id, _event_id);
  RETURN jsonb_build_object('capacity', cap, 'taken', used,
    'remaining', CASE WHEN cap IS NULL THEN NULL ELSE GREATEST(cap - used, 0) END,
    'full', cap IS NOT NULL AND used >= cap, 'waitlist', COALESCE(wl, false));
END $$;

CREATE OR REPLACE FUNCTION public.register_participation(
  _activity_id uuid, _event_id uuid, _household_id uuid,
  _user_ids uuid[], _child_ids uuid[], _dog_ids uuid[], _notes text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  cap int; wl boolean; pol text; maxd int;
  used int; people int; ndogs int; st text; pid uuid; u uuid; c uuid; d uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF (_activity_id IS NULL) = (_event_id IS NULL) THEN RAISE EXCEPTION 'Choisissez une activité OU un événement'; END IF;
  IF _household_id IS NOT NULL AND NOT public.is_household_member(me, _household_id) THEN
    RAISE EXCEPTION 'Ce foyer ne vous appartient pas';
  END IF;

  IF _activity_id IS NOT NULL THEN
    SELECT capacity, waitlist_enabled, dog_policy, max_dogs INTO cap, wl, pol, maxd FROM public.activities WHERE id = _activity_id FOR UPDATE;
  ELSE
    SELECT capacity, waitlist_enabled, dog_policy, max_dogs INTO cap, wl, pol, maxd FROM public.events WHERE id = _event_id FOR UPDATE;
  END IF;
  IF pol IS NULL THEN RAISE EXCEPTION 'Activité ou événement introuvable'; END IF;

  _user_ids := COALESCE(_user_ids, '{}'); _child_ids := COALESCE(_child_ids, '{}'); _dog_ids := COALESCE(_dog_ids, '{}');
  IF cardinality(_user_ids) = 0 AND cardinality(_child_ids) = 0 THEN _user_ids := ARRAY[me]; END IF;

  FOREACH u IN ARRAY _user_ids LOOP
    IF u <> me AND (_household_id IS NULL OR NOT public.is_household_member(u, _household_id)) THEN
      RAISE EXCEPTION 'Participant hors du foyer';
    END IF;
    IF EXISTS (SELECT 1 FROM public.participation_members m JOIN public.participations p ON p.id = m.participation_id
      WHERE m.user_id = u AND ((_activity_id IS NOT NULL AND p.activity_id = _activity_id) OR (_event_id IS NOT NULL AND p.event_id = _event_id))
        AND upper(p.registration_status) NOT IN ('CANCELLED','ANNULE','REFUSE')) THEN
      RAISE EXCEPTION 'Une personne sélectionnée est déjà inscrite';
    END IF;
  END LOOP;
  FOREACH c IN ARRAY _child_ids LOOP
    IF NOT EXISTS (SELECT 1 FROM public.household_children hc WHERE hc.id = c AND hc.household_id = _household_id) THEN
      RAISE EXCEPTION 'Enfant hors du foyer';
    END IF;
  END LOOP;

  ndogs := cardinality(_dog_ids);
  IF pol = 'NONE' AND ndogs > 0 THEN RAISE EXCEPTION 'Cette activité se fait sans chien'; END IF;
  IF pol = 'REQUIRED' AND ndogs = 0 THEN RAISE EXCEPTION 'Cette activité nécessite un chien'; END IF;
  IF pol IN ('OPTIONAL','REQUIRED') AND ndogs > 1 AND maxd IS NULL THEN RAISE EXCEPTION 'Un seul chien par inscription'; END IF;
  IF maxd IS NOT NULL AND ndogs > maxd THEN RAISE EXCEPTION 'Maximum % chien(s) par inscription', maxd; END IF;
  FOREACH d IN ARRAY _dog_ids LOOP
    IF NOT public.can_manage_dog(me, d) THEN RAISE EXCEPTION 'Chien non autorisé'; END IF;
  END LOOP;

  people := cardinality(_user_ids) + cardinality(_child_ids);
  used := public.occupied_spots(_activity_id, _event_id);
  IF cap IS NULL OR used + people <= cap THEN st := 'PENDING';
  ELSIF wl THEN st := 'WAITLIST';
  ELSE RAISE EXCEPTION 'Complet : plus de place disponible';
  END IF;

  INSERT INTO public.participations (user_id, household_id, activity_id, event_id, role, registration_status, notes)
  VALUES (me, _household_id, _activity_id, _event_id, 'PARTICIPANT', st, NULLIF(trim(_notes), ''))
  RETURNING id INTO pid;
  FOREACH u IN ARRAY _user_ids LOOP INSERT INTO public.participation_members (participation_id, user_id, role) VALUES (pid, u, 'ADULT'); END LOOP;
  FOREACH c IN ARRAY _child_ids LOOP INSERT INTO public.participation_members (participation_id, household_child_id, role) VALUES (pid, c, 'CHILD'); END LOOP;
  FOREACH d IN ARRAY _dog_ids LOOP INSERT INTO public.participation_dogs (participation_id, dog_id) VALUES (pid, d); END LOOP;

  RETURN jsonb_build_object('participation_id', pid, 'status', st);
END $$;

CREATE OR REPLACE FUNCTION public.get_pro_dogs()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'is_referent', EXISTS (SELECT 1 FROM public.dog_referents r WHERE r.dog_id = d.id AND r.professional_id = auth.uid()),
    'expires_at', a.expires_at,
    'perms', jsonb_build_object('identity', a.can_identity, 'info', a.can_info, 'goals', a.can_goals, 'activities', a.can_activities, 'observations', a.can_observations),
    'identity', CASE WHEN a.can_identity THEN jsonb_build_object('name', d.name, 'breed', d.breed, 'sex', d.sex, 'birth_date', d.birth_date, 'photo_url', d.photo_url) END,
    'info', CASE WHEN a.can_info THEN jsonb_build_object('character', d.character, 'needs', d.needs, 'useful_information', d.useful_information) END,
    'goals', CASE WHEN a.can_goals THEN (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', g.id, 'title', g.title, 'status', g.status) ORDER BY g.created_at DESC), '[]'::jsonb) FROM public.dog_goals g WHERE g.dog_id = d.id) END,
    'activities', CASE WHEN a.can_activities THEN (SELECT COALESCE(jsonb_agg(jsonb_build_object('title', COALESCE(ac.title, ev.title), 'date', COALESCE(ac.date, ev.start_date))), '[]'::jsonb)
        FROM public.participation_dogs pd JOIN public.participations p ON p.id = pd.participation_id
        LEFT JOIN public.activities ac ON ac.id = p.activity_id LEFT JOIN public.events ev ON ev.id = p.event_id
        WHERE pd.dog_id = d.id) END,
    'observations', CASE WHEN a.can_observations THEN (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', o.id, 'body', o.body, 'created_at', o.created_at, 'mine', o.author_id = auth.uid()) ORDER BY o.created_at DESC), '[]'::jsonb) FROM public.dog_observations o WHERE o.dog_id = d.id) END
  )), '[]'::jsonb)
  FROM public.dog_professional_access a JOIN public.dogs d ON d.id = a.dog_id
  WHERE a.professional_id = auth.uid() AND NOT a.revoked AND (a.expires_at IS NULL OR a.expires_at > now())
$$;

CREATE OR REPLACE FUNCTION public.get_public_pro_page(_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'slug', pp.slug, 'display_name', pp.display_name, 'logo_url', pp.logo_url,
    'specialties', pp.specialties, 'sector', pp.sector, 'description', pp.description,
    'website_url', pp.website_url, 'social_links', pp.social_links,
    'public_email', pp.public_email, 'public_phone', pp.public_phone, 'public_city', pp.public_city,
    'activities', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'type', a.type, 'date', a.date, 'location', a.location, 'price_public', a.price_public, 'price_member', a.price_member) ORDER BY a.date), '[]'::jsonb)
       FROM public.activities a WHERE a.is_public AND (a.professional_id = pp.profile_id OR pp.profile_id = ANY (a.professional_ids))
         AND upper(a.status) NOT IN ('DRAFT','ARCHIVED','CANCELLED')),
    'advantages', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', v.id, 'title', v.title, 'description', v.description, 'conditions', v.conditions, 'valid_until', v.valid_until)), '[]'::jsonb)
       FROM public.advantages v WHERE v.is_public AND v.professional_id = pp.profile_id AND upper(v.status) = 'ACTIVE'
         AND (v.valid_until IS NULL OR v.valid_until >= current_date)),
    'collaborations', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'description', c.description, 'happened_on', c.happened_on) ORDER BY c.happened_on DESC NULLS LAST), '[]'::jsonb)
       FROM public.professional_collaborations c WHERE c.is_public AND c.professional_id = pp.profile_id),
    'dogs_count', (SELECT count(DISTINCT x.dog_id) FROM (
        SELECT dog_id FROM public.dog_referents WHERE professional_id = pp.profile_id
        UNION SELECT dog_id FROM public.dog_professional_access WHERE professional_id = pp.profile_id AND NOT revoked AND (expires_at IS NULL OR expires_at > now())) x)
  )
  FROM public.professional_public_profile pp
  WHERE pp.slug = _slug AND pp.status = 'ACTIVE'
$$;
CREATE OR REPLACE FUNCTION public.list_public_pros()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('slug', slug, 'display_name', display_name, 'logo_url', logo_url, 'specialties', specialties, 'sector', sector, 'public_city', public_city) ORDER BY display_name), '[]'::jsonb)
  FROM public.professional_public_profile WHERE status = 'ACTIVE'
$$;
CREATE OR REPLACE FUNCTION public.pro_slug_for(_profile_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT slug FROM public.professional_public_profile WHERE profile_id = _profile_id AND status = 'ACTIVE'
$$;
GRANT EXECUTE ON FUNCTION public.get_public_pro_page(text), public.list_public_pros(), public.pro_slug_for(uuid), public.spots_info(uuid, uuid) TO anon, authenticated;
