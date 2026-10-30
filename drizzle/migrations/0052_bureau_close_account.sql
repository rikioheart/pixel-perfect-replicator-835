CREATE OR REPLACE FUNCTION public.bureau_close_account(_profile_id uuid, _reason text, _confirm text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  me uuid := auth.uid();
  note text := nullif(left(trim(coalesce(_reason, '')), 500), '');
  pid uuid; prev_status text; gone timestamptz;
  n_projects int := 0; n_tasks int := 0; n_dogs int := 0; n_access int := 0; n_reimb int := 0;
  hh record; heir uuid;
BEGIN
  IF me IS NULL OR NOT public.bureau_has_permission(me, 'members.validate') THEN
    RAISE EXCEPTION 'Droit de gestion des adhésions requis' USING ERRCODE = '42501';
  END IF;
  IF _profile_id IS NULL OR _profile_id = me THEN
    RAISE EXCEPTION 'Vous ne pouvez pas clôturer votre propre compte depuis cet écran' USING ERRCODE = '42501';
  END IF;
  IF upper(trim(coalesce(_confirm, ''))) <> 'CLÔTURER' AND upper(trim(coalesce(_confirm, ''))) <> 'CLOTURER' THEN
    RAISE EXCEPTION 'Confirmation invalide' USING ERRCODE = '22023';
  END IF;
  IF note IS NULL OR length(note) < 5 THEN
    RAISE EXCEPTION 'Motif obligatoire (5 caractères minimum)' USING ERRCODE = '22023';
  END IF;
  IF public.is_bureau(_profile_id) THEN
    RAISE EXCEPTION 'Retirez d''abord le rôle Bureau de cette personne avant de clôturer son compte' USING ERRCODE = '42501';
  END IF;

  SELECT membership_status, person_id, deleted_at INTO prev_status, pid, gone
  FROM public.profiles WHERE id = _profile_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'NOT_FOUND'); END IF;
  IF gone IS NOT NULL THEN RETURN jsonb_build_object('status', 'ALREADY_CLOSED'); END IF;

  -- 1. Coupure des droits : statut radié, rôles, délégations, fonctions, pass.
  PERFORM set_config('lvdc.membership_decision', 'on', true);
  UPDATE public.profiles SET membership_status = 'EXCLUDED' WHERE id = _profile_id;
  PERFORM set_config('lvdc.membership_decision', '', true);
  DELETE FROM public.user_roles WHERE user_id = _profile_id;
  UPDATE public.delegations SET revoked_at = now(), revoked_by = me
    WHERE revoked_at IS NULL AND (delegate_id = _profile_id OR delegator_id = _profile_id);
  UPDATE public.member_functions SET active = false, end_date = coalesce(end_date, current_date)
    WHERE user_id = _profile_id AND active;
  DELETE FROM public.pass_access WHERE user_id = _profile_id;
  UPDATE public.professional_public_profile SET public_listing = false, status = 'SUSPENDED'
    WHERE profile_id = _profile_id AND status <> 'SUSPENDED';

  -- 2. Responsabilités confiées au Bureau, pour que l'association ne soit pas bloquée.
  UPDATE public.projects SET owner_id = me
    WHERE owner_id = _profile_id AND archived_at IS NULL AND status NOT IN ('COMPLETED','CANCELLED','ARCHIVED');
  GET DIAGNOSTICS n_projects = ROW_COUNT;
  UPDATE public.tasks SET assigned_user_id = NULL
    WHERE assigned_user_id = _profile_id AND status NOT IN ('COMPLETED','ARCHIVED','CANCELLED');
  GET DIAGNOSTICS n_tasks = ROW_COUNT;
  DELETE FROM public.task_assignees WHERE user_id = _profile_id;
  DELETE FROM public.project_members WHERE user_id = _profile_id;

  -- 3. Chiens archivés (jamais supprimés) et accès partagés révoqués.
  UPDATE public.dogs SET archived_at = now(), archived_reason = 'Départ du titulaire du compte'
    WHERE owner_id = _profile_id AND archived_at IS NULL;
  GET DIAGNOSTICS n_dogs = ROW_COUNT;
  UPDATE public.dog_professional_access SET revoked = true, revoked_at = now(), revoked_by = me
    WHERE NOT revoked AND (professional_id = _profile_id OR granted_by = _profile_id
      OR dog_id IN (SELECT id FROM public.dogs WHERE owner_id = _profile_id));
  GET DIAGNOSTICS n_access = ROW_COUNT;

  -- 4. Foyer : un autre adulte reprend la gestion ; sinon les proches sans compte sont anonymisés.
  FOR hh IN SELECT household_id, role FROM public.household_members WHERE user_id = _profile_id LOOP
    SELECT user_id INTO heir FROM public.household_members
      WHERE household_id = hh.household_id AND user_id <> _profile_id ORDER BY created_at LIMIT 1;
    IF heir IS NULL THEN
      UPDATE public.household_children SET first_name = 'Proche', last_name = NULL, birth_date = NULL, birth_year = NULL
        WHERE household_id = hh.household_id;
    ELSIF hh.role = 'ADMIN' AND NOT EXISTS (
      SELECT 1 FROM public.household_members WHERE household_id = hh.household_id AND user_id <> _profile_id AND role = 'ADMIN') THEN
      UPDATE public.household_members SET role = 'ADMIN' WHERE household_id = hh.household_id AND user_id = heir;
    END IF;
    heir := NULL;
  END LOOP;
  DELETE FROM public.household_members WHERE user_id = _profile_id;

  -- 5. Anonymisation ; traces financières et comptes rendus conservés.
  UPDATE public.profiles SET first_name = NULL, last_name = NULL, display_name = 'Ancien membre',
    email = NULL, phone = NULL, bio = NULL, city = NULL, department = NULL, avatar_path = NULL, skills = '{}',
    public_visibility = false, deleted_at = now() WHERE id = _profile_id;
  IF pid IS NOT NULL THEN
    UPDATE public.people SET first_name = NULL, last_name = NULL, display_name = 'Ancien membre',
      email = NULL, phone = NULL, city = NULL, department = NULL, notes = NULL WHERE id = pid;
  END IF;
  SELECT count(*) INTO n_reimb FROM public.reimbursements r
    WHERE (r.person_id = _profile_id OR r.person_id = pid) AND r.status IN ('PENDING','APPROVED');

  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, old_values, new_values, metadata)
  VALUES (me, 'account.closed_by_bureau', 'profile', _profile_id,
    jsonb_build_object('membership_status', prev_status),
    jsonb_build_object('membership_status', 'EXCLUDED', 'anonymized', true),
    jsonb_build_object('reason', note, 'projects_reassigned', n_projects, 'tasks_released', n_tasks,
      'dogs_archived', n_dogs, 'dog_access_revoked', n_access, 'open_reimbursements', n_reimb));
  PERFORM public.notify_bureau_members(me, 'ACCOUNT_CLOSED', 'Compte clôturé par le Bureau',
    'Un compte a été clôturé et anonymisé. Projets repris : ' || n_projects || ', tâches libérées : ' || n_tasks
    || ', remboursements à solder : ' || n_reimb || '.', 'profile', _profile_id, '/admin');

  RETURN jsonb_build_object('status', 'CLOSED', 'projects', n_projects, 'tasks', n_tasks,
    'dogs', n_dogs, 'dog_access', n_access, 'open_reimbursements', n_reimb);
END $function$;

REVOKE ALL ON FUNCTION public.bureau_close_account(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bureau_close_account(uuid, text, text) TO authenticated, service_role;