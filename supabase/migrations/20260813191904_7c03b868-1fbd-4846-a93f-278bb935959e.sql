CREATE TABLE public.mindmap_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  edges jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mindmap_config TO authenticated;
GRANT ALL ON public.mindmap_config TO service_role;

ALTER TABLE public.mindmap_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY mindmap_config_select ON public.mindmap_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY mindmap_config_insert ON public.mindmap_config
  FOR INSERT TO authenticated WITH CHECK (public.is_bureau(auth.uid()));
CREATE POLICY mindmap_config_update ON public.mindmap_config
  FOR UPDATE TO authenticated USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));
CREATE POLICY mindmap_config_delete ON public.mindmap_config
  FOR DELETE TO authenticated USING (public.is_bureau(auth.uid()));

CREATE TRIGGER trg_mindmap_config_updated
  BEFORE UPDATE ON public.mindmap_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.projects ADD COLUMN mindmap_node_id text;
UPDATE public.projects SET mindmap_node_id = id::text WHERE mindmap_node_id IS NULL;
CREATE UNIQUE INDEX projects_mindmap_node_id_key ON public.projects (mindmap_node_id);