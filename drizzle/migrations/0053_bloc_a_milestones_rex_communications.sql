ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS rex_successes text, ADD COLUMN IF NOT EXISTS rex_improvements text, ADD COLUMN IF NOT EXISTS rex_advice text;

CREATE TABLE public.project_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) >= 2),
  due_date date,
  done_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_milestones_project_idx ON public.project_milestones(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_milestones TO authenticated;
GRANT ALL ON public.project_milestones TO service_role;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY pm_select ON public.project_milestones FOR SELECT TO authenticated
  USING (public.can_view_project(auth.uid(), project_id));
CREATE POLICY pm_insert ON public.project_milestones FOR INSERT TO authenticated
  WITH CHECK (public.is_bureau(auth.uid()) OR public.is_project_coordinator(auth.uid(), project_id));
CREATE POLICY pm_update ON public.project_milestones FOR UPDATE TO authenticated
  USING (public.is_bureau(auth.uid()) OR public.is_project_coordinator(auth.uid(), project_id))
  WITH CHECK (public.is_bureau(auth.uid()) OR public.is_project_coordinator(auth.uid(), project_id));
CREATE POLICY pm_delete ON public.project_milestones FOR DELETE TO authenticated
  USING (public.is_bureau(auth.uid()) OR public.is_project_coordinator(auth.uid(), project_id));

CREATE TABLE public.bureau_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(trim(title)) >= 2),
  body text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','IN_REVIEW','READY','ARCHIVED')),
  channel text NOT NULL DEFAULT 'INTERNAL_WALL' CHECK (channel IN ('INTERNAL_WALL','EMAIL_INFO','TERRAIN_DISPLAY','SOCIAL_POST','PRESS_MAIRIE')),
  target_audience text NOT NULL DEFAULT 'ALL_MEMBERS' CHECK (target_audience IN ('ALL_MEMBERS','PROS','VOLUNTEERS','BUREAU','PUBLIC')),
  target_date date,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  internal_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bureau_communications TO authenticated;
GRANT ALL ON public.bureau_communications TO service_role;
ALTER TABLE public.bureau_communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY bc_all ON public.bureau_communications FOR ALL TO authenticated
  USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));
