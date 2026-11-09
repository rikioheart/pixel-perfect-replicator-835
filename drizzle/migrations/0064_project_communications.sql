ALTER TABLE public.bureau_communications
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visuals_url text,
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS validated_by uuid,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_update_id uuid REFERENCES public.association_updates(id) ON DELETE SET NULL;

ALTER TABLE public.bureau_communications
  ADD CONSTRAINT bureau_communications_visuals_https CHECK (visuals_url IS NULL OR visuals_url ~* '^https://[^[:space:]]+$');

CREATE INDEX IF NOT EXISTS bureau_communications_project_idx ON public.bureau_communications (project_id);
CREATE INDEX IF NOT EXISTS bureau_communications_task_idx ON public.bureau_communications (task_id);

-- Qui travaille sur une communication : le Bureau, ou l'équipe du projet rattaché.
CREATE OR REPLACE FUNCTION public.can_work_on_communication(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_bureau(_user_id)
    OR (_project_id IS NOT NULL AND (public.is_project_member(_user_id, _project_id) OR public.is_project_coordinator(_user_id, _project_id)))
$$;
REVOKE EXECUTE ON FUNCTION public.can_work_on_communication(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_work_on_communication(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS bc_all ON public.bureau_communications;
CREATE POLICY bc_select ON public.bureau_communications FOR SELECT TO authenticated
  USING (public.can_work_on_communication(auth.uid(), project_id));
CREATE POLICY bc_insert ON public.bureau_communications FOR INSERT TO authenticated
  WITH CHECK (public.can_work_on_communication(auth.uid(), project_id) AND (created_by = auth.uid() OR public.is_bureau(auth.uid())));
CREATE POLICY bc_update ON public.bureau_communications FOR UPDATE TO authenticated
  USING (public.can_work_on_communication(auth.uid(), project_id))
  WITH CHECK (public.can_work_on_communication(auth.uid(), project_id));
CREATE POLICY bc_delete ON public.bureau_communications FOR DELETE TO authenticated
  USING (public.is_bureau(auth.uid()) OR (created_by = auth.uid() AND status = 'DRAFT'));

-- Garde : l'équipe rédige et soumet ; seul le Bureau valide, archive et publie.
CREATE OR REPLACE FUNCTION public.guard_bureau_communication()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  me uuid := auth.uid();
  bureau boolean := public.is_bureau(auth.uid());
  task_project uuid;
BEGIN
  IF NEW.task_id IS NOT NULL THEN
    SELECT project_id INTO task_project FROM public.tasks WHERE id = NEW.task_id;
    IF task_project IS NOT NULL AND task_project IS DISTINCT FROM NEW.project_id THEN
      RAISE EXCEPTION 'La tâche choisie n''appartient pas à ce projet';
    END IF;
  END IF;

  IF me IS NOT NULL AND NOT bureau THEN
    IF TG_OP = 'UPDATE' AND OLD.status IN ('READY', 'ARCHIVED') THEN
      RAISE EXCEPTION 'Communication validée par le Bureau : seul le Bureau peut la modifier';
    END IF;
    IF NEW.status NOT IN ('DRAFT', 'IN_REVIEW') THEN
      RAISE EXCEPTION 'Seul le Bureau valide ou diffuse une communication';
    END IF;
    IF TG_OP = 'UPDATE' THEN
      NEW.validated_by := OLD.validated_by;
      NEW.validated_at := OLD.validated_at;
      NEW.published_update_id := OLD.published_update_id;
      NEW.created_by := OLD.created_by;
    ELSE
      NEW.validated_by := NULL;
      NEW.validated_at := NULL;
      NEW.published_update_id := NULL;
    END IF;
  END IF;

  IF NEW.status IN ('DRAFT', 'IN_REVIEW') THEN
    NEW.validated_by := NULL;
    NEW.validated_at := NULL;
  ELSIF NEW.status = 'READY' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'READY') THEN
    NEW.validated_by := me;
    NEW.validated_at := now();
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_bureau_communication() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS trg_guard_bureau_communication ON public.bureau_communications;
CREATE TRIGGER trg_guard_bureau_communication
  BEFORE INSERT OR UPDATE ON public.bureau_communications
  FOR EACH ROW EXECUTE FUNCTION public.guard_bureau_communication();

-- Notifications : soumission au Bureau, puis retour de décision à l'équipe.
CREATE OR REPLACE FUNCTION public.notify_bureau_communication()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  me uuid := auth.uid();
  author uuid := COALESCE(NEW.owner_id, NEW.created_by);
  link text := CASE WHEN NEW.project_id IS NOT NULL THEN '/projects/' || NEW.project_id ELSE '/admin/communication' END;
BEGIN
  IF NEW.status = 'IN_REVIEW' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'IN_REVIEW') THEN
    PERFORM public.notify_bureau_members(me, 'COMMUNICATION_REVIEW', 'Communication à valider', NEW.title, 'bureau_communication', NEW.id, '/admin/communication');
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'IN_REVIEW' AND NEW.status = 'READY' THEN
    PERFORM public.notify_member(author, me, 'COMMUNICATION_VALIDATED', 'Communication validée par le Bureau', NEW.title, 'bureau_communication', NEW.id, link, interval '10 minutes');
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'IN_REVIEW' AND NEW.status = 'DRAFT' THEN
    PERFORM public.notify_member(author, me, 'COMMUNICATION_RETURNED', 'Communication à retravailler', NEW.title, 'bureau_communication', NEW.id, link, interval '10 minutes');
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_bureau_communication() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS trg_notify_bureau_communication ON public.bureau_communications;
CREATE TRIGGER trg_notify_bureau_communication
  AFTER INSERT OR UPDATE OF status ON public.bureau_communications
  FOR EACH ROW EXECUTE FUNCTION public.notify_bureau_communication();

-- Diffusion dans « Actualités » : Bureau seul, communication validée, sans doublon.
CREATE OR REPLACE FUNCTION public.publish_communication(_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  me uuid := auth.uid();
  c public.bureau_communications%ROWTYPE;
  upd uuid;
BEGIN
  IF me IS NULL OR NOT public.is_bureau(me) THEN
    RAISE EXCEPTION 'Seul le Bureau publie dans les actualités';
  END IF;
  SELECT * INTO c FROM public.bureau_communications WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Communication introuvable'; END IF;
  IF c.published_update_id IS NOT NULL THEN RETURN c.published_update_id; END IF;
  IF c.status <> 'READY' THEN RAISE EXCEPTION 'La communication doit d''abord être validée par le Bureau'; END IF;

  INSERT INTO public.association_updates (kind, title, body, project_id, is_public, created_by)
  VALUES (CASE WHEN c.project_id IS NOT NULL THEN 'PROJET' ELSE 'ACTION' END, c.title, c.body, c.project_id, false, me)
  RETURNING id INTO upd;

  UPDATE public.bureau_communications SET published_update_id = upd, status = 'ARCHIVED' WHERE id = _id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, new_values)
  VALUES (me, 'COMMUNICATION_PUBLISHED', 'bureau_communication', _id, jsonb_build_object('update_id', upd, 'project', c.project_id));
  RETURN upd;
END $$;
REVOKE EXECUTE ON FUNCTION public.publish_communication(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.publish_communication(uuid) TO authenticated;