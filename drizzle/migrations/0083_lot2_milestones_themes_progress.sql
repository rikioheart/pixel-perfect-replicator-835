
ALTER TABLE public.project_milestones
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS deliverable text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'PLANNED',
  ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;
UPDATE public.project_milestones SET status='DONE' WHERE done_at IS NOT NULL AND status<>'DONE';
ALTER TABLE public.project_milestones ADD CONSTRAINT project_milestones_status_check CHECK (status IN ('PLANNED','IN_PROGRESS','DONE'));

CREATE OR REPLACE FUNCTION public.sync_milestone_done() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.done_at IS DISTINCT FROM OLD.done_at AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    NEW.status := CASE WHEN NEW.done_at IS NULL THEN 'PLANNED' ELSE 'DONE' END;
  END IF;
  IF NEW.status='DONE' AND NEW.done_at IS NULL THEN NEW.done_at := now(); END IF;
  IF NEW.status<>'DONE' THEN NEW.done_at := NULL; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_milestone_done ON public.project_milestones;
CREATE TRIGGER trg_milestone_done BEFORE INSERT OR UPDATE ON public.project_milestones FOR EACH ROW EXECUTE FUNCTION public.sync_milestone_done();

CREATE TABLE public.project_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 60),
  color text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_themes TO authenticated;
GRANT ALL ON public.project_themes TO service_role;
ALTER TABLE public.project_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY pt_select ON public.project_themes FOR SELECT TO authenticated USING (public.can_view_project((select auth.uid()), project_id));
CREATE POLICY pt_insert ON public.project_themes FOR INSERT TO authenticated WITH CHECK (public.is_bureau((select auth.uid())) OR public.is_project_coordinator((select auth.uid()), project_id));
CREATE POLICY pt_update ON public.project_themes FOR UPDATE TO authenticated USING (public.is_bureau((select auth.uid())) OR public.is_project_coordinator((select auth.uid()), project_id)) WITH CHECK (public.is_bureau((select auth.uid())) OR public.is_project_coordinator((select auth.uid()), project_id));
CREATE POLICY pt_delete ON public.project_themes FOR DELETE TO authenticated USING (public.is_bureau((select auth.uid())) OR public.is_project_coordinator((select auth.uid()), project_id));

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS milestone_id uuid REFERENCES public.project_milestones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS theme_id uuid REFERENCES public.project_themes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tasks_milestone_id_idx ON public.tasks(milestone_id);
CREATE INDEX IF NOT EXISTS tasks_theme_id_idx ON public.tasks(theme_id);
CREATE INDEX IF NOT EXISTS project_themes_project_id_idx ON public.project_themes(project_id);

CREATE OR REPLACE FUNCTION public.check_task_links() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.milestone_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.project_milestones m WHERE m.id=NEW.milestone_id AND m.project_id IS NOT DISTINCT FROM NEW.project_id) THEN
    RAISE EXCEPTION 'Cette étape appartient à un autre projet';
  END IF;
  IF NEW.theme_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.project_themes t WHERE t.id=NEW.theme_id AND t.project_id IS NOT DISTINCT FROM NEW.project_id) THEN
    RAISE EXCEPTION 'Cette catégorie appartient à un autre projet';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.check_task_links() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS b_check_task_links ON public.tasks;
CREATE TRIGGER b_check_task_links BEFORE INSERT OR UPDATE OF milestone_id, theme_id, project_id ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.check_task_links();

-- Progression unique : tâches terminées/validées sur tâches comptées (annulées, refusées, archivées exclues)
CREATE OR REPLACE FUNCTION public.recompute_project_progress(_pid uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE public.projects p SET progress_percent = COALESCE((
    SELECT round(100.0 * count(*) FILTER (WHERE t.status IN ('COMPLETED','VALIDATED')) / NULLIF(count(*),0))::int
    FROM public.tasks t WHERE t.project_id=_pid AND t.status NOT IN ('CANCELLED','REJECTED','ARCHIVED')), 0)
  WHERE p.id=_pid AND p.progress_percent IS DISTINCT FROM COALESCE((
    SELECT round(100.0 * count(*) FILTER (WHERE t.status IN ('COMPLETED','VALIDATED')) / NULLIF(count(*),0))::int
    FROM public.tasks t WHERE t.project_id=_pid AND t.status NOT IN ('CANCELLED','REJECTED','ARCHIVED')), 0)
$$;
REVOKE EXECUTE ON FUNCTION public.recompute_project_progress(uuid) FROM public, anon, authenticated;
CREATE OR REPLACE FUNCTION public.tasks_progress_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP<>'INSERT' AND OLD.project_id IS NOT NULL THEN PERFORM public.recompute_project_progress(OLD.project_id); END IF;
  IF TG_OP<>'DELETE' AND NEW.project_id IS NOT NULL THEN PERFORM public.recompute_project_progress(NEW.project_id); END IF;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.tasks_progress_trigger() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS z_tasks_progress ON public.tasks;
CREATE TRIGGER z_tasks_progress AFTER INSERT OR DELETE OR UPDATE OF status, project_id ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.tasks_progress_trigger();
DO $$ DECLARE r record; BEGIN FOR r IN SELECT id FROM public.projects LOOP PERFORM public.recompute_project_progress(r.id); END LOOP; END $$;
COMMENT ON COLUMN public.projects.progress_percent IS 'Calculé automatiquement depuis les tâches (trigger z_tasks_progress) ; ne plus saisir à la main';

-- Multi-assignation
CREATE OR REPLACE FUNCTION public.can_assign_task(_user_id uuid, _task_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid()) AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id=_task_id AND (
    public.is_bureau(_user_id)
    OR (t.project_id IS NOT NULL AND public.is_project_coordinator(_user_id, t.project_id))
    OR (t.project_id IS NULL AND t.created_by=_user_id)))
$$;
REVOKE EXECUTE ON FUNCTION public.can_assign_task(uuid,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_assign_task(uuid,uuid) TO authenticated, service_role;
DROP POLICY IF EXISTS task_assignees_manage ON public.task_assignees;
CREATE POLICY task_assignees_insert ON public.task_assignees FOR INSERT TO authenticated WITH CHECK (user_id=(select auth.uid()) OR public.can_assign_task((select auth.uid()), task_id));
CREATE POLICY task_assignees_update ON public.task_assignees FOR UPDATE TO authenticated USING (public.can_assign_task((select auth.uid()), task_id)) WITH CHECK (public.can_assign_task((select auth.uid()), task_id));
CREATE POLICY task_assignees_delete ON public.task_assignees FOR DELETE TO authenticated USING (user_id=(select auth.uid()) OR public.can_assign_task((select auth.uid()), task_id));
CREATE INDEX IF NOT EXISTS task_assignees_user_id_idx ON public.task_assignees(user_id);
