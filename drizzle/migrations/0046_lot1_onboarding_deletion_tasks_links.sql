
-- 1. Liens projet parent / événement
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS activities_project_idx ON public.activities(project_id);
CREATE INDEX IF NOT EXISTS events_project_idx ON public.events(project_id);

-- 2. Choix du parcours et désinscription
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_choice_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
UPDATE public.profiles SET account_choice_at = coalesce(created_at, now()) WHERE membership_status <> 'PENDING' AND account_choice_at IS NULL;
ALTER TABLE public.pro_details ADD COLUMN IF NOT EXISTS siret text;

-- Garde : autorise uniquement le choix initial via choose_account_type
CREATE OR REPLACE FUNCTION public.guard_profile_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); via_decision boolean := coalesce(current_setting('lvdc.membership_decision', true), '') = 'on';
  via_choice boolean := coalesce(current_setting('lvdc.account_choice', true), '') = 'on';
BEGIN
  IF me IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF public.is_bureau(me) AND NEW.id <> me THEN RETURN NEW; END IF;
    NEW.membership_status := 'PENDING';
    NEW.statutory_category := 'ACTIF';
    IF NEW.membership_type NOT IN ('PARTICULIER','PROFESSIONNEL') THEN NEW.membership_type := 'PARTICULIER'; END IF;
    RETURN NEW;
  END IF;
  IF via_choice AND NEW.id = me AND OLD.membership_status = 'PENDING' AND OLD.account_choice_at IS NULL
     AND NEW.membership_status = OLD.membership_status AND NEW.statutory_category IS NOT DISTINCT FROM OLD.statutory_category
     AND NEW.membership_type IN ('PARTICULIER','PROFESSIONNEL') THEN
    RETURN NEW;
  END IF;
  IF NEW.membership_type IS DISTINCT FROM OLD.membership_type
     OR NEW.membership_status IS DISTINCT FROM OLD.membership_status
     OR NEW.statutory_category IS DISTINCT FROM OLD.statutory_category THEN
    IF NOT public.is_bureau(me) THEN
      RAISE EXCEPTION 'Seul le Bureau peut modifier le type, le statut ou la catégorie d''adhésion';
    END IF;
    IF NEW.id = me THEN
      RAISE EXCEPTION 'Vous ne pouvez pas modifier votre propre adhésion';
    END IF;
    IF NEW.membership_status IS DISTINCT FROM OLD.membership_status THEN
      IF NOT public.bureau_has_permission(me, 'members.validate') THEN
        RAISE EXCEPTION 'Droit de validation des adhésions requis';
      END IF;
      IF OLD.membership_status = 'PENDING' AND NOT via_decision THEN
        RAISE EXCEPTION 'Une demande d''adhésion se traite depuis la file « Adhésions à valider »';
      END IF;
    END IF;
    IF NOT via_decision THEN
      INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, old_values, new_values)
      VALUES (me, 'membership.update', 'profile', NEW.id,
        jsonb_build_object('membership_type', OLD.membership_type, 'membership_status', OLD.membership_status, 'statutory_category', OLD.statutory_category),
        jsonb_build_object('membership_type', NEW.membership_type, 'membership_status', NEW.membership_status, 'statutory_category', NEW.statutory_category));
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.choose_account_type(_type text, _company text DEFAULT NULL, _siret text DEFAULT NULL, _activity text DEFAULT NULL, _description text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); p record; b record; who text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF _type NOT IN ('PARTICULIER','PROFESSIONNEL') THEN RAISE EXCEPTION 'Parcours inconnu'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = me FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profil introuvable'; END IF;
  IF p.account_choice_at IS NOT NULL OR p.membership_status <> 'PENDING' THEN
    RETURN jsonb_build_object('status','ALREADY_SET','membership_type',p.membership_type);
  END IF;
  IF _type = 'PROFESSIONNEL' THEN
    IF coalesce(trim(_company),'') = '' OR coalesce(trim(_activity),'') = '' THEN
      RAISE EXCEPTION 'Nom de la structure et activité requis';
    END IF;
    IF coalesce(_siret,'') <> '' AND regexp_replace(_siret,'\s','','g') !~ '^\d{14}$' THEN
      RAISE EXCEPTION 'Le SIRET doit comporter 14 chiffres';
    END IF;
  END IF;
  PERFORM set_config('lvdc.account_choice','on',true);
  UPDATE public.profiles SET membership_type = _type, account_choice_at = now() WHERE id = me;
  PERFORM set_config('lvdc.account_choice','off',true);
  IF _type = 'PROFESSIONNEL' THEN
    INSERT INTO public.pro_details(profile_id, company_name, professional_category, siret, description)
    SELECT me, trim(_company), trim(_activity), nullif(regexp_replace(coalesce(_siret,''),'\s','','g'),''), nullif(trim(coalesce(_description,'')),'')
    WHERE NOT EXISTS (SELECT 1 FROM public.pro_details WHERE profile_id = me);
    UPDATE public.pro_details SET company_name = trim(_company), professional_category = trim(_activity),
      siret = nullif(regexp_replace(coalesce(_siret,''),'\s','','g'),''), description = coalesce(nullif(trim(coalesce(_description,'')),''), description)
    WHERE profile_id = me;
  END IF;
  who := coalesce(nullif(p.display_name,''), nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''), 'Une nouvelle personne');
  PERFORM public.notify_bureau_members(me, 'MEMBER_PENDING', 'Parcours choisi : ' || lower(_type),
    who || CASE WHEN _type='PROFESSIONNEL' THEN ' demande une adhésion professionnelle (' || trim(_company) || ').' ELSE ' rejoint l''association comme particulier.' END,
    'profile', me, '/admin');
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, new_values)
  VALUES (me, 'account.choice', 'profile', me, jsonb_build_object('membership_type', _type));
  RETURN jsonb_build_object('status','OK','membership_type',_type);
END $$;
REVOKE EXECUTE ON FUNCTION public.choose_account_type(text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.choose_account_type(text,text,text,text,text) TO authenticated;

-- Désinscription : contrôle des dépendances puis anonymisation
CREATE OR REPLACE FUNCTION public.account_deletion_blockers(_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'projects', coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'title',title)) FROM public.projects
       WHERE owner_id = _user_id AND archived_at IS NULL AND status NOT IN ('COMPLETED','CANCELLED','ARCHIVED')), '[]'::jsonb),
    'reimbursements', (SELECT count(*) FROM public.reimbursements r
       WHERE (r.person_id = _user_id OR r.person_id = public.current_person_id(_user_id)) AND r.status IN ('PENDING','APPROVED'))
  )
$$;
REVOKE EXECUTE ON FUNCTION public.account_deletion_blockers(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_account_deletion_check()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  RETURN public.account_deletion_blockers(auth.uid());
END $$;
REVOKE EXECUTE ON FUNCTION public.my_account_deletion_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_account_deletion_check() TO authenticated;

CREATE OR REPLACE FUNCTION public.request_account_deletion(_confirm text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); bl jsonb; pid uuid; who text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF upper(trim(coalesce(_confirm,''))) <> 'SUPPRIMER' THEN RAISE EXCEPTION 'Confirmation invalide'; END IF;
  bl := public.account_deletion_blockers(me);
  SELECT coalesce(nullif(display_name,''), 'Un membre'), person_id INTO who, pid FROM public.profiles WHERE id = me;
  IF jsonb_array_length(bl->'projects') > 0 OR (bl->>'reimbursements')::int > 0 THEN
    PERFORM public.notify_bureau_members(me, 'ACCOUNT_DELETION_BLOCKED', 'Demande de suppression de compte',
      who || ' souhaite supprimer son compte : responsabilités ou remboursements à réassigner ou solder avant clôture.', 'profile', me, '/admin');
    INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, new_values)
    VALUES (me, 'account.deletion_blocked', 'profile', me, bl);
    RETURN jsonb_build_object('status','BLOCKED','blockers',bl);
  END IF;
  UPDATE public.profiles SET first_name = NULL, last_name = NULL, display_name = 'Adhérent désinscrit',
    email = NULL, phone = NULL, bio = NULL, city = NULL, department = NULL, avatar_path = NULL,
    public_visibility = false, deleted_at = now() WHERE id = me;
  IF pid IS NOT NULL THEN
    UPDATE public.people SET first_name = NULL, last_name = NULL, display_name = 'Adhérent désinscrit',
      email = NULL, phone = NULL, city = NULL, department = NULL, notes = NULL WHERE id = pid;
  END IF;
  DELETE FROM public.project_members WHERE user_id = me;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, new_values)
  VALUES (me, 'account.deleted', 'profile', me, jsonb_build_object('anonymized', true));
  PERFORM public.notify_bureau_members(me, 'ACCOUNT_DELETED', 'Compte supprimé',
    'Un compte a été clôturé et anonymisé à la demande de son titulaire. Les traces financières et comptes rendus sont conservés.', 'profile', me, '/admin');
  RETURN jsonb_build_object('status','DELETED');
END $$;
REVOKE EXECUTE ON FUNCTION public.request_account_deletion(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(text) TO authenticated;

-- 3. Tâches : un membre actif peut créer une tâche hors projet ou sur un projet visible
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated WITH CHECK (
  public.is_bureau(auth.uid())
  OR (project_id IS NOT NULL AND public.is_project_member(auth.uid(), project_id))
  OR (public.is_active_member(auth.uid()) AND created_by = auth.uid()
      AND (project_id IS NULL OR public.can_view_project(auth.uid(), project_id)))
);
