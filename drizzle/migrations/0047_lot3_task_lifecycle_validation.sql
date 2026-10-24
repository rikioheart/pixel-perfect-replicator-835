-- Lot 3 : cycle de vie des tâches. Valider, rouvrir ou archiver = coordinateur du projet ou Bureau (créateur pour une tâche hors projet confiée à quelqu'un d'autre).

CREATE OR REPLACE FUNCTION public.task_validator(_user uuid, _project_id uuid, _created_by uuid, _assigned uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user IS NOT NULL AND (
    public.is_bureau(_user)
    OR (_project_id IS NOT NULL AND public.is_project_coordinator(_user, _project_id))
    OR (_project_id IS NULL AND _created_by = _user AND _assigned IS DISTINCT FROM _user)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_validate_task(_user uuid, _task_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = _task_id
    AND public.task_validator(_user, t.project_id, t.created_by, t.assigned_user_id))
$$;

REVOKE ALL ON FUNCTION public.task_validator(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_validate_task(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.task_validator(uuid, uuid, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_validate_task(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_task_lifecycle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); validator boolean;
BEGIN
  IF me IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    validator := public.task_validator(me, NEW.project_id, NEW.created_by, NEW.assigned_user_id);
    IF NOT validator AND NEW.status IN ('COMPLETED','ARCHIVED') THEN
      RAISE EXCEPTION 'Une nouvelle tâche ne peut pas être créée déjà terminée : elle sera validée par le coordinateur du projet ou le Bureau.';
    END IF;
    IF NOT validator THEN NEW.validated_by := NULL; NEW.validated_at := NULL; END IF;
    RETURN NEW;
  END IF;

  validator := public.task_validator(me, OLD.project_id, OLD.created_by, OLD.assigned_user_id);
  IF NOT validator THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF OLD.status IN ('COMPLETED','ARCHIVED') THEN
        RAISE EXCEPTION 'Seul le coordinateur du projet ou le Bureau peut rouvrir une tâche terminée.';
      END IF;
      IF NEW.status IN ('COMPLETED','ARCHIVED') THEN
        RAISE EXCEPTION 'Seul le coordinateur du projet ou le Bureau peut valider cette tâche. Utilisez « Soumettre pour validation ».';
      END IF;
      IF NEW.status = 'CANCELLED' AND OLD.created_by IS DISTINCT FROM me THEN
        RAISE EXCEPTION 'Seul le créateur, le coordinateur du projet ou le Bureau peut annuler cette tâche.';
      END IF;
      IF NEW.status = 'PENDING_VALIDATION' THEN NEW.submitted_at := now(); END IF;
      IF NEW.status = 'IN_PROGRESS' AND OLD.started_at IS NULL THEN NEW.started_at := now(); END IF;
    END IF;
    NEW.validated_by := OLD.validated_by;
    NEW.validated_at := OLD.validated_at;
    NEW.completed_at := OLD.completed_at;
    NEW.rejection_reason := OLD.rejection_reason;
  ELSE
    IF NEW.status = 'COMPLETED' AND OLD.status IS DISTINCT FROM 'COMPLETED' THEN
      NEW.completed_at := coalesce(NEW.completed_at, now());
      NEW.validated_at := coalesce(NEW.validated_at, now());
      NEW.validated_by := me;
    ELSIF OLD.status = 'COMPLETED' AND NEW.status NOT IN ('COMPLETED','ARCHIVED') THEN
      NEW.completed_at := NULL;
      NEW.validated_at := NULL;
      NEW.validated_by := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.guard_task_lifecycle() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS a_guard_task_lifecycle ON public.tasks;
CREATE TRIGGER a_guard_task_lifecycle BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.guard_task_lifecycle();

-- Le coordinateur voit les preuves, décisions et historique des tâches de son projet ; il peut enregistrer une décision.
DROP POLICY IF EXISTS task_submissions_select ON public.task_submissions;
CREATE POLICY task_submissions_select ON public.task_submissions FOR SELECT TO authenticated USING (
  is_bureau(auth.uid()) OR submitted_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_submissions.task_id
    AND (t.assigned_user_id = auth.uid() OR t.created_by = auth.uid()
      OR (t.project_id IS NOT NULL AND public.is_project_coordinator(auth.uid(), t.project_id)))));

DROP POLICY IF EXISTS task_validation_select ON public.task_validation;
CREATE POLICY task_validation_select ON public.task_validation FOR SELECT TO authenticated USING (
  is_bureau(auth.uid())
  OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_validation.task_id
    AND (t.assigned_user_id = auth.uid() OR t.created_by = auth.uid()
      OR (t.project_id IS NOT NULL AND public.is_project_coordinator(auth.uid(), t.project_id)))));

DROP POLICY IF EXISTS task_validation_insert ON public.task_validation;
CREATE POLICY task_validation_insert ON public.task_validation FOR INSERT TO authenticated WITH CHECK (
  validated_by = auth.uid() AND public.can_validate_task(auth.uid(), task_id));

DROP POLICY IF EXISTS task_history_select ON public.task_history;
CREATE POLICY task_history_select ON public.task_history FOR SELECT TO authenticated USING (
  is_bureau(auth.uid())
  OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_history.task_id
    AND (t.assigned_user_id = auth.uid() OR t.created_by = auth.uid()
      OR (t.project_id IS NOT NULL AND public.is_project_coordinator(auth.uid(), t.project_id)))));

-- Notifications : le coordinateur du projet est prévenu au même titre que le Bureau.
CREATE OR REPLACE FUNCTION public.notify_task_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid := auth.uid(); actor_name text; c uuid;
BEGIN
  IF NEW.assigned_user_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id) THEN
    PERFORM public.notify_member(NEW.assigned_user_id, actor, 'TASK_ASSIGNED', 'Une tâche vous est confiée',
      NEW.title, 'task', NEW.id, '/tasks');
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF actor IS NOT NULL AND NOT public.is_bureau(actor) THEN
      PERFORM public.notify_bureau_members(actor, 'TASK_CREATED', 'Nouvelle tâche proposée', NEW.title, 'task', NEW.id, '/tasks');
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'PENDING_VALIDATION' AND coalesce(OLD.status, '') <> 'PENDING_VALIDATION' THEN
    SELECT coalesce(p.display_name, nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''), 'Un membre')
      INTO actor_name FROM public.profiles p WHERE p.id = coalesce(actor, NEW.assigned_user_id);
    PERFORM public.notify_bureau_members(actor, 'TASK_PENDING_VALIDATION', 'Tâche à valider',
      coalesce(actor_name, 'Un membre') || ' a soumis la tâche « ' || NEW.title || ' » pour validation.', 'task', NEW.id, '/admin/validation');
    IF NEW.project_id IS NOT NULL THEN
      FOR c IN SELECT DISTINCT pm.user_id FROM public.project_members pm
        WHERE pm.project_id = NEW.project_id AND upper(coalesce(pm.project_role,'')) IN ('OWNER','COORDINATOR') LOOP
        PERFORM public.notify_member(c, actor, 'TASK_PENDING_VALIDATION', 'Tâche à valider',
          coalesce(actor_name, 'Un membre') || ' a soumis la tâche « ' || NEW.title || ' » pour validation.',
          'task', NEW.id, '/projects/' || NEW.project_id::text, interval '20 hours');
      END LOOP;
    END IF;
  END IF;

  IF coalesce(OLD.status, '') = 'PENDING_VALIDATION' AND NEW.status IN ('COMPLETED', 'TODO', 'IN_PROGRESS') AND NEW.assigned_user_id IS NOT NULL THEN
    PERFORM public.notify_member(NEW.assigned_user_id, actor,
      CASE WHEN NEW.status = 'COMPLETED' THEN 'TASK_APPROVED' ELSE 'TASK_REJECTED' END,
      CASE WHEN NEW.status = 'COMPLETED' THEN 'Tâche validée' ELSE 'Tâche à compléter' END,
      CASE WHEN NEW.status = 'COMPLETED' THEN 'La tâche « ' || NEW.title || ' » a été validée. Merci !'
        ELSE 'La tâche « ' || NEW.title || ' » vous est renvoyée : ' || coalesce(NEW.rejection_reason, 'complément demandé') END,
      'task', NEW.id, '/tasks', interval '1 minute');
  END IF;
  RETURN NEW;
END $$;

-- Propositions d'aide : le coordinateur du projet les voit, y répond et les accepte (l'affectation aux tâches reste manuelle).
DROP POLICY IF EXISTS contrib_select ON public.contributions;
CREATE POLICY contrib_select ON public.contributions FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR is_bureau(auth.uid())
  OR (project_id IS NOT NULL AND public.is_project_coordinator(auth.uid(), project_id))
  OR (project_id IS NOT NULL AND status <> ALL (ARRAY['PROPOSED','CANCELLED']) AND can_view_project(auth.uid(), project_id)));

DROP POLICY IF EXISTS contrib_update ON public.contributions;
CREATE POLICY contrib_update ON public.contributions FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR is_bureau(auth.uid()) OR (project_id IS NOT NULL AND public.is_project_coordinator(auth.uid(), project_id)))
  WITH CHECK (user_id = auth.uid() OR is_bureau(auth.uid()) OR (project_id IS NOT NULL AND public.is_project_coordinator(auth.uid(), project_id)));

CREATE OR REPLACE FUNCTION public.contribution_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE moderator boolean := public.is_bureau(auth.uid())
  OR (OLD.project_id IS NOT NULL AND public.is_project_coordinator(auth.uid(), OLD.project_id));
BEGIN
  IF NOT moderator THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
      NEW.status = 'CANCELLED' OR (NEW.status IN ('IN_PROGRESS','COMPLETED','BLOCKED') AND OLD.status IN ('ACCEPTED','IN_PROGRESS','BLOCKED'))
    ) THEN RAISE EXCEPTION 'Seul le Bureau ou le coordinateur du projet peut changer ce statut'; END IF;
    NEW.bureau_reply := OLD.bureau_reply;
  ELSIF NOT public.is_bureau(auth.uid()) THEN
    -- un coordinateur ne déplace pas une proposition vers un autre projet ni ne la réattribue
    NEW.project_id := OLD.project_id;
    NEW.user_id := OLD.user_id;
  END IF;
  IF NEW.status = 'COMPLETED' AND OLD.status <> 'COMPLETED' THEN NEW.completed_at := now(); END IF;
  IF NEW.status = 'ACCEPTED' AND OLD.status <> 'ACCEPTED' AND NEW.project_id IS NOT NULL THEN
    INSERT INTO public.project_members (project_id, user_id, project_role, participation_status)
    VALUES (NEW.project_id, NEW.user_id, CASE WHEN NEW.contribution_type = 'REFERENT' THEN 'REFERENT' ELSE 'CONTRIBUTEUR' END, 'ACTIVE')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notify_contribution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_bureau_members(NEW.user_id, 'HELP_OFFER', 'Nouvelle proposition d''aide', NEW.title, 'contribution', NEW.id, '/admin/contributions');
    IF NEW.project_id IS NOT NULL THEN
      FOR c IN SELECT DISTINCT pm.user_id FROM public.project_members pm
        WHERE pm.project_id = NEW.project_id AND upper(coalesce(pm.project_role,'')) IN ('OWNER','COORDINATOR') LOOP
        PERFORM public.notify_member(c, NEW.user_id, 'HELP_OFFER', 'Nouvelle proposition d''aide', NEW.title,
          'contribution', NEW.id, '/projects/' || NEW.project_id::text, interval '20 hours');
      END LOOP;
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_member(NEW.user_id, auth.uid(), 'CONTRIBUTION_UPDATE', 'Votre proposition d''aide a avancé',
      coalesce(NEW.bureau_reply, NEW.title), 'contribution', NEW.id, '/parcours', interval '1 minute');
  END IF;
  RETURN NEW;
END $$;
