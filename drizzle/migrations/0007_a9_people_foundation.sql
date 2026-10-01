-- 1. PEOPLE : personne associative (avec ou sans compte)
CREATE TABLE public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text,
  last_name text,
  display_name text,
  email text,
  phone text,
  city text,
  department text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
CREATE INDEX people_email_idx ON public.people (lower(email));
CREATE TRIGGER trg_people_updated BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. PROFILES.person_id
ALTER TABLE public.profiles ADD COLUMN person_id uuid REFERENCES public.people(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX profiles_person_id_uniq ON public.profiles(person_id) WHERE person_id IS NOT NULL;
COMMENT ON COLUMN public.profiles.membership_type IS 'DEPRECATED progressivement : l''historique d''adhésion vit dans memberships';
COMMENT ON COLUMN public.profiles.membership_status IS 'DEPRECATED progressivement : l''historique d''adhésion vit dans memberships';
COMMENT ON COLUMN public.profiles.membership_date IS 'DEPRECATED progressivement : l''historique d''adhésion vit dans memberships';

CREATE OR REPLACE FUNCTION public.current_person_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT person_id FROM public.profiles WHERE id = _user_id
$$;

CREATE POLICY people_select ON public.people FOR SELECT TO authenticated
  USING (public.is_bureau(auth.uid()) OR id = public.current_person_id(auth.uid()));
CREATE POLICY people_update_self ON public.people FOR UPDATE TO authenticated
  USING (id = public.current_person_id(auth.uid())) WITH CHECK (id = public.current_person_id(auth.uid()));
CREATE POLICY people_bureau_all ON public.people FOR ALL TO authenticated
  USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));

-- Backfill : une personne par profil existant
DO $$
DECLARE r record; pid uuid;
BEGIN
  FOR r IN SELECT * FROM public.profiles WHERE person_id IS NULL LOOP
    INSERT INTO public.people (first_name, last_name, display_name, email, phone, city, department)
    VALUES (r.first_name, r.last_name, r.display_name, r.email, r.phone, r.city, r.department)
    RETURNING id INTO pid;
    UPDATE public.profiles SET person_id = pid WHERE id = r.id;
  END LOOP;
END $$;

-- Rattachement automatique sans doublon : réutilise une personne non liée ayant le même e-mail
CREATE OR REPLACE FUNCTION public.profile_link_person()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid;
BEGIN
  IF NEW.person_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.email IS NOT NULL THEN
    SELECT p.id INTO pid FROM public.people p
    WHERE lower(p.email) = lower(NEW.email)
      AND NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.person_id = p.id)
    ORDER BY p.created_at LIMIT 1;
  END IF;
  IF pid IS NULL THEN
    INSERT INTO public.people (first_name, last_name, display_name, email, phone, city, department, created_by)
    VALUES (NEW.first_name, NEW.last_name, NEW.display_name, NEW.email, NEW.phone, NEW.city, NEW.department, NEW.id)
    RETURNING id INTO pid;
  END IF;
  NEW.person_id := pid;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_profiles_link_person BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.profile_link_person();

-- Empêche un membre de se rattacher lui-même à une autre personne
CREATE OR REPLACE FUNCTION public.guard_profile_person()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.person_id IS DISTINCT FROM OLD.person_id AND auth.uid() IS NOT NULL AND NOT public.is_bureau(auth.uid()) THEN
    RAISE EXCEPTION 'Seul le Bureau peut modifier le rattachement à une personne';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_profiles_guard_person BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_person();

-- 3. MEMBERSHIPS
ALTER TABLE public.memberships
  ADD COLUMN person_id uuid REFERENCES public.people(id) ON DELETE RESTRICT,
  ADD COLUMN source text NOT NULL DEFAULT 'MANUEL',
  ADD COLUMN external_id text;
ALTER TABLE public.memberships ADD CONSTRAINT memberships_source_chk CHECK (source IN ('HELLOASSO','PHYSIQUE','MANUEL','AUTRE'));
CREATE UNIQUE INDEX memberships_source_external_uniq ON public.memberships(source, external_id) WHERE external_id IS NOT NULL;
UPDATE public.memberships m SET person_id = pr.person_id FROM public.profiles pr WHERE pr.id = m.user_id AND m.person_id IS NULL;

-- 4/5. FOYERS et contexte enfants
ALTER TABLE public.household_members ADD COLUMN person_id uuid REFERENCES public.people(id) ON DELETE CASCADE;
UPDATE public.household_members hm SET person_id = pr.person_id FROM public.profiles pr WHERE pr.id = hm.user_id;
ALTER TABLE public.households
  ADD COLUMN children_presence text NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN children_count integer;
ALTER TABLE public.households ADD CONSTRAINT households_children_presence_chk CHECK (children_presence IN ('UNKNOWN','YES','NO'));
ALTER TABLE public.households ADD CONSTRAINT households_children_count_chk CHECK (children_count IS NULL OR children_count >= 0);
UPDATE public.households h SET children_presence = 'YES',
  children_count = (SELECT count(*) FROM public.household_children c WHERE c.household_id = h.id)
WHERE EXISTS (SELECT 1 FROM public.household_children c WHERE c.household_id = h.id);
COMMENT ON TABLE public.household_children IS 'LEGACY en cours d''évaluation : contexte enfants porté par households.children_presence/children_count. Ne pas supprimer sans migration.';

-- 8/9. PROJETS et PARTICIPATIONS vers people
ALTER TABLE public.project_members ADD COLUMN person_id uuid REFERENCES public.people(id) ON DELETE CASCADE;
UPDATE public.project_members pm SET person_id = pr.person_id FROM public.profiles pr WHERE pr.id = pm.user_id;
ALTER TABLE public.participation_members ADD COLUMN person_id uuid REFERENCES public.people(id) ON DELETE SET NULL;
UPDATE public.participation_members m SET person_id = pr.person_id FROM public.profiles pr WHERE pr.id = m.user_id;

-- Synchronisation automatique de person_id depuis user_id (compatibilité)
CREATE OR REPLACE FUNCTION public.fill_person_from_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.person_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.person_id := public.current_person_id(NEW.user_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_memberships_person BEFORE INSERT OR UPDATE ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.fill_person_from_user();
CREATE TRIGGER trg_household_members_person BEFORE INSERT OR UPDATE ON public.household_members FOR EACH ROW EXECUTE FUNCTION public.fill_person_from_user();
CREATE TRIGGER trg_project_members_person BEFORE INSERT OR UPDATE ON public.project_members FOR EACH ROW EXECUTE FUNCTION public.fill_person_from_user();
CREATE TRIGGER trg_participation_members_person BEFORE INSERT OR UPDATE ON public.participation_members FOR EACH ROW EXECUTE FUNCTION public.fill_person_from_user();

-- 10. TERRAIN : enrichissement de l'existant
ALTER TABLE public.terrain_reservations
  ADD COLUMN usage_type text NOT NULL DEFAULT 'AUTRE',
  ADD COLUMN activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL,
  ADD COLUMN event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN equipment_requested text,
  ADD COLUMN requested_by uuid,
  ADD COLUMN reviewed_by uuid,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN decision_note text;
ALTER TABLE public.terrain_reservations ADD CONSTRAINT terrain_usage_chk CHECK (usage_type IN ('SUIVI_INDIVIDUEL','COLLECTIF','SPORT','EDUCATION','FORMATION','EVENEMENT','PROJET','TACHE','AUTRE'));
UPDATE public.terrain_reservations SET requested_by = professional_id WHERE requested_by IS NULL;

CREATE OR REPLACE FUNCTION public.guard_terrain_reservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.requested_by IS NULL THEN NEW.requested_by := auth.uid(); END IF;
    IF auth.uid() IS NOT NULL AND NOT public.is_bureau(auth.uid()) THEN
      NEW.status := 'PENDING'; NEW.reviewed_by := NULL; NEW.reviewed_at := NULL;
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_bureau(auth.uid()) THEN
      IF upper(NEW.status) NOT IN ('CANCELLED','ANNULE') THEN
        RAISE EXCEPTION 'Seul le Bureau valide ou refuse une réservation';
      END IF;
    ELSE
      NEW.reviewed_by := auth.uid(); NEW.reviewed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_terrain_resv_guard BEFORE INSERT OR UPDATE ON public.terrain_reservations FOR EACH ROW EXECUTE FUNCTION public.guard_terrain_reservation();

CREATE OR REPLACE FUNCTION public.can_manage_terrain_reservation(_user_id uuid, _rid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.terrain_reservations r WHERE r.id = _rid
    AND (public.is_bureau(_user_id) OR r.professional_id = _user_id OR r.requested_by = _user_id))
$$;

CREATE TABLE public.terrain_reservation_professionals (
  reservation_id uuid NOT NULL REFERENCES public.terrain_reservations(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reservation_id, professional_id)
);
CREATE TABLE public.terrain_reservation_people (
  reservation_id uuid NOT NULL REFERENCES public.terrain_reservations(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reservation_id, person_id)
);
CREATE TABLE public.terrain_reservation_dogs (
  reservation_id uuid NOT NULL REFERENCES public.terrain_reservations(id) ON DELETE CASCADE,
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reservation_id, dog_id)
);
GRANT SELECT, INSERT, DELETE ON public.terrain_reservation_professionals, public.terrain_reservation_people, public.terrain_reservation_dogs TO authenticated;
GRANT ALL ON public.terrain_reservation_professionals, public.terrain_reservation_people, public.terrain_reservation_dogs TO service_role;
ALTER TABLE public.terrain_reservation_professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terrain_reservation_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terrain_reservation_dogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY trp_select ON public.terrain_reservation_professionals FOR SELECT TO authenticated
  USING (public.can_manage_terrain_reservation(auth.uid(), reservation_id) OR professional_id = auth.uid());
CREATE POLICY trp_write ON public.terrain_reservation_professionals FOR ALL TO authenticated
  USING (public.can_manage_terrain_reservation(auth.uid(), reservation_id))
  WITH CHECK (public.can_manage_terrain_reservation(auth.uid(), reservation_id) AND (public.is_bureau(auth.uid()) OR public.is_professional(professional_id)));

CREATE POLICY trpe_select ON public.terrain_reservation_people FOR SELECT TO authenticated
  USING (public.can_manage_terrain_reservation(auth.uid(), reservation_id) OR person_id = public.current_person_id(auth.uid()));
CREATE POLICY trpe_write ON public.terrain_reservation_people FOR ALL TO authenticated
  USING (public.can_manage_terrain_reservation(auth.uid(), reservation_id))
  WITH CHECK (public.can_manage_terrain_reservation(auth.uid(), reservation_id));

CREATE POLICY trd_select ON public.terrain_reservation_dogs FOR SELECT TO authenticated
  USING (public.can_manage_terrain_reservation(auth.uid(), reservation_id) OR public.can_manage_dog(auth.uid(), dog_id));
CREATE POLICY trd_write ON public.terrain_reservation_dogs FOR ALL TO authenticated
  USING (public.can_manage_terrain_reservation(auth.uid(), reservation_id))
  WITH CHECK (public.can_manage_terrain_reservation(auth.uid(), reservation_id)
    AND (public.is_bureau(auth.uid()) OR public.can_manage_dog(auth.uid(), dog_id) OR public.pro_dog_perm(auth.uid(), dog_id, 'any')));

INSERT INTO public.terrain_reservation_professionals (reservation_id, professional_id)
SELECT id, professional_id FROM public.terrain_reservations WHERE professional_id IS NOT NULL ON CONFLICT DO NOTHING;

-- 12. LEGACY
COMMENT ON TABLE public.mindmap_config IS 'LEGACY / FREEZE : ne plus faire évoluer.';
COMMENT ON TABLE public.member_imports IS 'CONSERVÉ — dormant (aucun import enregistré à ce jour).';