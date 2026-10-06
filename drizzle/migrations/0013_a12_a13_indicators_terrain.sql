SET check_function_bodies = off;

-- Correctif A11 : colonne d'audit = actor_id
CREATE OR REPLACE FUNCTION public.create_delegation(_delegate uuid, _code text, _scope_type text, _scope_id uuid, _reason text, _ends_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF coalesce(trim(_reason),'') = '' THEN RAISE EXCEPTION 'Motif obligatoire'; END IF;
  IF _ends_at IS NULL OR _ends_at <= now() OR _ends_at > now() + interval '365 days' THEN
    RAISE EXCEPTION 'Date de fin obligatoire, dans les 365 jours'; END IF;
  IF NOT (public.has_permission(_me, _code)
     OR (_scope_type = 'PROJECT' AND public.is_project_coordinator(_me, _scope_id) AND split_part(_code,'.',1) IN ('projects','tasks','terrain','documents'))) THEN
    RAISE EXCEPTION 'Vous ne pouvez déléguer qu''une permission que vous possédez sur ce périmètre'; END IF;
  INSERT INTO public.delegations(delegator_id, delegate_id, permission_code, scope_type, scope_id, reason, ends_at)
  VALUES (_me, _delegate, _code, _scope_type, _scope_id, trim(_reason), _ends_at) RETURNING id INTO _id;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, new_values)
  VALUES (_me, 'DELEGATION_CREATE', 'delegation', _id, jsonb_build_object('delegate', _delegate, 'code', _code, 'scope', _scope_type, 'scope_id', _scope_id, 'ends_at', _ends_at));
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.revoke_delegation(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid();
BEGIN
  UPDATE public.delegations SET revoked_at = now(), revoked_by = _me
   WHERE id = _id AND revoked_at IS NULL AND (delegator_id = _me OR public.is_bureau(_me));
  IF NOT FOUND THEN RAISE EXCEPTION 'Délégation introuvable ou non autorisée'; END IF;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id) VALUES (_me, 'DELEGATION_REVOKE', 'delegation', _id);
END $$;

-- A12 : indicateurs du chien (aides opérationnelles, jamais une note)
CREATE TABLE public.dog_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dog_id uuid NOT NULL REFERENCES public.dogs(id) ON DELETE CASCADE,
  family text NOT NULL CHECK (family IN ('VERT','JAUNE','BLEU','NOIR')),
  category text NOT NULL CHECK (category IN ('INTERACTION_CHIEN','INTERACTION_HUMAIN','ESPACE','APPROCHE','ENVIRONNEMENT','BESOIN_SPECIFIQUE')),
  label text NOT NULL CHECK (length(trim(label)) >= 3),
  note text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dog_indicators TO authenticated;
GRANT ALL ON public.dog_indicators TO service_role;
ALTER TABLE public.dog_indicators ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_edit_dog_indicators(_user_id uuid, _dog_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_manage_dog(_user_id, _dog_id)
    OR EXISTS (SELECT 1 FROM public.dog_referents r JOIN public.dogs d ON d.id = r.dog_id
       WHERE r.dog_id = _dog_id AND r.professional_id = _user_id AND coalesce(d.referent_can_share_followup,false)
         AND public.is_professional(_user_id))
$$;

CREATE POLICY dog_ind_select ON public.dog_indicators FOR SELECT TO authenticated
  USING (public.can_manage_dog(auth.uid(), dog_id) OR public.can_view_dog_operational(auth.uid(), dog_id) OR public.is_bureau(auth.uid()));
CREATE POLICY dog_ind_insert ON public.dog_indicators FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_dog_indicators(auth.uid(), dog_id));
CREATE POLICY dog_ind_update ON public.dog_indicators FOR UPDATE TO authenticated
  USING (public.can_edit_dog_indicators(auth.uid(), dog_id)) WITH CHECK (public.can_edit_dog_indicators(auth.uid(), dog_id));
CREATE POLICY dog_ind_delete ON public.dog_indicators FOR DELETE TO authenticated
  USING (public.can_edit_dog_indicators(auth.uid(), dog_id));
CREATE TRIGGER dog_ind_updated BEFORE UPDATE ON public.dog_indicators FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- A13 : tâches et activités reliées
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS terrain_reservation_id uuid REFERENCES public.terrain_reservations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team_label text;
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'COLLECTIVE',
  ADD COLUMN IF NOT EXISTS equipment text,
  ADD COLUMN IF NOT EXISTS terrain_reservation_id uuid REFERENCES public.terrain_reservations(id) ON DELETE SET NULL;
ALTER TABLE public.activities ADD CONSTRAINT activities_category_chk
  CHECK (category IN ('COLLECTIVE','EDUCATIVE','SPORTIVE','FORMATION','EVENEMENT','PROMENADE','ENTRAIDE','AUTRE'));

-- A13 : réservation terrain
ALTER TABLE public.terrain_reservations
  ADD COLUMN IF NOT EXISTS work_category text NOT NULL DEFAULT 'AUTRE',
  ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'GRATUIT',
  ADD COLUMN IF NOT EXISTS rental_terms text,
  ADD COLUMN IF NOT EXISTS equipment_granted text;
ALTER TABLE public.terrain_reservations ADD CONSTRAINT terrain_work_category_chk
  CHECK (work_category IN ('EDUCATION','SPORT','COLLECTIF','FORMATION','ACCOMPAGNEMENT','EVENEMENT','PROJET_ASSOCIATIF','AUTRE'));
ALTER TABLE public.terrain_reservations ADD CONSTRAINT terrain_access_mode_chk CHECK (access_mode IN ('GRATUIT','LOCATION'));
ALTER TABLE public.terrain_reservations ADD CONSTRAINT terrain_status_chk
  CHECK (status IN ('DRAFT','PENDING','CHANGES_REQUESTED','APPROVED','REFUSED','CANCELLED')) NOT VALID;
ALTER TABLE public.terrain_reservation_dogs
  ADD COLUMN IF NOT EXISTS referent_professional_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.can_request_terrain(_user_id uuid, _project_id uuid, _activity_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_bureau(_user_id) OR public.is_professional(_user_id)
    OR (_project_id IS NOT NULL AND public.is_project_coordinator(_user_id, _project_id))
    OR (_activity_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.activities a WHERE a.id = _activity_id
        AND (a.created_by = _user_id OR a.referent_id = _user_id OR a.professional_id = _user_id)))
$$;

CREATE OR REPLACE FUNCTION public.can_manage_terrain_reservation(_user_id uuid, _rid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.terrain_reservations r WHERE r.id = _rid
    AND (public.is_bureau(_user_id) OR r.professional_id = _user_id OR r.requested_by = _user_id
      OR (r.project_id IS NOT NULL AND public.is_project_coordinator(_user_id, r.project_id))))
$$;

CREATE OR REPLACE FUNCTION public.check_terrain_reservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.end_time <= NEW.start_time THEN
    RAISE EXCEPTION 'L''heure de fin doit être postérieure à l''heure de début';
  END IF;
  IF NEW.status IN ('PENDING','APPROVED') AND EXISTS (
    SELECT 1 FROM public.terrain_reservations r WHERE r.id <> NEW.id AND r.resource_id = NEW.resource_id
      AND r.date = NEW.date AND r.start_time < NEW.end_time AND r.end_time > NEW.start_time
      AND r.status IN ('PENDING','APPROVED')) THEN
    RAISE EXCEPTION 'Ce créneau est déjà réservé';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_terrain_reservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _bureau boolean;
BEGIN
  IF _me IS NULL THEN RETURN NEW; END IF; -- service_role
  _bureau := public.is_bureau(_me);
  IF TG_OP = 'INSERT' THEN
    NEW.requested_by := _me;
    IF NEW.professional_id IS NULL THEN NEW.professional_id := _me; END IF;
    IF NOT _bureau THEN
      IF NOT public.can_request_terrain(_me, NEW.project_id, NEW.activity_id) THEN
        RAISE EXCEPTION 'Vous n''êtes pas autorisé à demander le terrain'; END IF;
      IF NEW.status IS NULL OR NEW.status NOT IN ('DRAFT','PENDING') THEN NEW.status := 'PENDING'; END IF;
      NEW.reviewed_by := NULL; NEW.reviewed_at := NULL; NEW.rental_terms := NULL; NEW.equipment_granted := NULL; NEW.decision_note := NULL;
    ELSIF NEW.status IS NULL THEN NEW.status := 'PENDING';
    END IF;
    RETURN NEW;
  END IF;
  -- UPDATE
  IF _bureau THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('APPROVED','REFUSED','CHANGES_REQUESTED','CANCELLED') THEN
      NEW.reviewed_by := _me; NEW.reviewed_at := now();
    END IF;
    RETURN NEW;
  END IF;
  -- Demandeur : décisions Bureau intouchables
  NEW.reviewed_by := OLD.reviewed_by; NEW.reviewed_at := OLD.reviewed_at; NEW.decision_note := OLD.decision_note;
  NEW.rental_terms := OLD.rental_terms; NEW.equipment_granted := OLD.equipment_granted; NEW.requested_by := OLD.requested_by;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'CANCELLED' AND OLD.status IN ('DRAFT','PENDING','CHANGES_REQUESTED','APPROVED') THEN RETURN NEW; END IF;
    IF NEW.status = 'PENDING' AND OLD.status IN ('DRAFT','CHANGES_REQUESTED') THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Seul le Bureau valide, refuse ou demande une modification';
  END IF;
  IF OLD.status NOT IN ('DRAFT','CHANGES_REQUESTED') THEN
    RAISE EXCEPTION 'Demande verrouillée : modifiable seulement en brouillon ou après une demande de modification';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_terrain_reservation ON public.terrain_reservations;
DROP TRIGGER IF EXISTS trg_guard_terrain_reservation ON public.terrain_reservations;
DROP TRIGGER IF EXISTS check_terrain_reservation ON public.terrain_reservations;
DROP TRIGGER IF EXISTS trg_check_terrain_reservation ON public.terrain_reservations;
CREATE TRIGGER a_guard_terrain_reservation BEFORE INSERT OR UPDATE ON public.terrain_reservations FOR EACH ROW EXECUTE FUNCTION public.guard_terrain_reservation();
CREATE TRIGGER b_check_terrain_reservation BEFORE INSERT OR UPDATE ON public.terrain_reservations FOR EACH ROW EXECUTE FUNCTION public.check_terrain_reservation();

DROP POLICY IF EXISTS terrain_resv_insert ON public.terrain_reservations;
CREATE POLICY terrain_resv_insert ON public.terrain_reservations FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND public.can_request_terrain(auth.uid(), project_id, activity_id));
DROP POLICY IF EXISTS terrain_resv_update ON public.terrain_reservations;
CREATE POLICY terrain_resv_update ON public.terrain_reservations FOR UPDATE TO authenticated
  USING (public.can_manage_terrain_reservation(auth.uid(), id)) WITH CHECK (public.can_manage_terrain_reservation(auth.uid(), id));
DROP POLICY IF EXISTS terrain_resv_delete ON public.terrain_reservations;
CREATE POLICY terrain_resv_delete ON public.terrain_reservations FOR DELETE TO authenticated
  USING (public.is_bureau(auth.uid()) OR (requested_by = auth.uid() AND status = 'DRAFT'));

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
        WHERE rd.dog_id = _dog_id AND t.status IN ('PENDING','APPROVED')
          AND (t.professional_id = _user_id OR t.requested_by = _user_id
            OR EXISTS (SELECT 1 FROM public.terrain_reservation_professionals rp WHERE rp.reservation_id = t.id AND rp.professional_id = _user_id))))
$$;

-- Fiche contextuelle : uniquement les champs autorisés
CREATE OR REPLACE FUNCTION public.entity_peek(_type text, _id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); r jsonb;
BEGIN
  IF _me IS NULL THEN RETURN NULL; END IF;
  IF _type = 'dog' THEN
    IF NOT (public.can_manage_dog(_me,_id) OR public.can_view_dog_operational(_me,_id) OR public.is_bureau(_me)) THEN RETURN NULL; END IF;
    SELECT jsonb_build_object('title', d.name, 'subtitle', d.breed,
      'indicators', coalesce((SELECT jsonb_agg(jsonb_build_object('family',i.family,'label',i.label,'category',i.category)) FROM public.dog_indicators i WHERE i.dog_id=d.id),'[]'),
      'can_open', public.can_manage_dog(_me,_id) OR public.pro_dog_perm(_me,_id,'any'), 'link', '/foyer')
    INTO r FROM public.dogs d WHERE d.id=_id;
  ELSIF _type = 'project' THEN
    IF NOT public.can_view_project(_me,_id) THEN RETURN NULL; END IF;
    SELECT jsonb_build_object('title', p.title, 'subtitle', p.status, 'can_open', true, 'link', '/projects/'||p.id) INTO r FROM public.projects p WHERE p.id=_id;
  ELSIF _type = 'activity' THEN
    SELECT jsonb_build_object('title', a.title, 'subtitle', to_char(a.date,'DD/MM/YYYY')||coalesce(' · '||a.location,''), 'category', a.category, 'can_open', true, 'link', '/activities/'||a.id)
      INTO r FROM public.activities a WHERE a.id=_id AND (a.is_public OR true);
  ELSIF _type = 'reservation' THEN
    IF NOT public.can_view_terrain_reservation(_me,_id) THEN RETURN NULL; END IF;
    SELECT jsonb_build_object('title', coalesce(tr.name,'Terrain'), 'subtitle', to_char(t.date,'DD/MM/YYYY')||' '||left(t.start_time::text,5)||'–'||left(t.end_time::text,5),
      'status', t.status, 'category', t.work_category, 'equipment', t.equipment_requested, 'can_open', true, 'link', '/terrain')
      INTO r FROM public.terrain_reservations t LEFT JOIN public.terrain_resources tr ON tr.id=t.resource_id WHERE t.id=_id;
  ELSIF _type = 'task' THEN
    SELECT jsonb_build_object('title', t.title, 'subtitle', t.status, 'can_open', true, 'link', '/tasks') INTO r FROM public.tasks t
      WHERE t.id=_id AND (public.is_bureau(_me) OR t.assigned_user_id=_me OR t.created_by=_me OR (t.project_id IS NOT NULL AND public.can_view_project(_me,t.project_id)));
  ELSIF _type = 'person' THEN
    SELECT jsonb_build_object('title', coalesce(p.display_name, trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,''))), 'subtitle', p.city,
      'can_open', public.is_bureau(_me), 'link', '/members/'||p.id) INTO r FROM public.profiles p WHERE p.id=_id AND (p.public_visibility OR p.id=_me OR public.is_bureau(_me));
  END IF;
  RETURN r;
END $$;
REVOKE EXECUTE ON FUNCTION public.entity_peek(text,uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.entity_peek(text,uuid) TO authenticated;