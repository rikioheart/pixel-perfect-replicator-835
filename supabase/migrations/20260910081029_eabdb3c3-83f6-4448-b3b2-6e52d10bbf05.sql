CREATE TABLE public.help_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  module text NOT NULL DEFAULT 'AUTRE',
  role_scopes text[] NOT NULL DEFAULT ARRAY['PARTICULIER']::text[],
  summary text,
  content text NOT NULL DEFAULT '',
  visibility text NOT NULL DEFAULT 'ALL',
  status text NOT NULL DEFAULT 'PUBLISHED',
  author_id uuid,
  reviewed_by uuid,
  review_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_guides TO authenticated;
GRANT ALL ON public.help_guides TO service_role;
ALTER TABLE public.help_guides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Guides publiés visibles des adhérents" ON public.help_guides FOR SELECT TO authenticated
  USING (
    public.is_bureau(auth.uid())
    OR author_id = auth.uid()
    OR (status = 'PUBLISHED' AND (visibility = 'ALL' OR (visibility = 'PRO_BUREAU' AND public.is_professional(auth.uid()))))
  );
CREATE POLICY "Chacun peut proposer un guide" ON public.help_guides FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());
CREATE POLICY "Bureau modifie les guides" ON public.help_guides FOR UPDATE TO authenticated
  USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));
CREATE POLICY "Bureau supprime les guides" ON public.help_guides FOR DELETE TO authenticated
  USING (public.is_bureau(auth.uid()));
CREATE TRIGGER trg_help_guides_updated BEFORE UPDATE ON public.help_guides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.job_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  role_title text NOT NULL,
  responsibilities text,
  daily_actions text,
  modules text[] NOT NULL DEFAULT ARRAY[]::text[],
  visibility text NOT NULL DEFAULT 'PRO_BUREAU',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_sheets TO authenticated;
GRANT ALL ON public.job_sheets TO service_role;
ALTER TABLE public.job_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fiches de poste visibles" ON public.job_sheets FOR SELECT TO authenticated
  USING (
    public.is_bureau(auth.uid())
    OR member_id = auth.uid()
    OR visibility = 'ALL'
    OR (visibility = 'PRO_BUREAU' AND public.is_professional(auth.uid()))
  );
CREATE POLICY "Bureau gère les fiches de poste" ON public.job_sheets FOR ALL TO authenticated
  USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));
CREATE TRIGGER trg_job_sheets_updated BEFORE UPDATE ON public.job_sheets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.help_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'NEEDS_HELP',
  message text NOT NULL,
  skills text[] NOT NULL DEFAULT ARRAY[]::text[],
  entity_type text,
  entity_id uuid,
  status text NOT NULL DEFAULT 'OPEN',
  response text,
  handled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_requests TO authenticated;
GRANT ALL ON public.help_requests TO service_role;
ALTER TABLE public.help_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mes demandes ou toutes pour le Bureau" ON public.help_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY "Chacun crée sa demande" ON public.help_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Bureau traite les demandes" ON public.help_requests FOR UPDATE TO authenticated
  USING (public.is_bureau(auth.uid()) OR user_id = auth.uid())
  WITH CHECK (public.is_bureau(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Bureau supprime les demandes" ON public.help_requests FOR DELETE TO authenticated
  USING (public.is_bureau(auth.uid()));
CREATE TRIGGER trg_help_requests_updated BEFORE UPDATE ON public.help_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_preferences (
  user_id uuid PRIMARY KEY,
  text_size text NOT NULL DEFAULT 'NORMAL',
  high_contrast boolean NOT NULL DEFAULT false,
  reduced_motion boolean NOT NULL DEFAULT false,
  default_view text NOT NULL DEFAULT 'LIST',
  notify_email boolean NOT NULL DEFAULT true,
  notify_in_app boolean NOT NULL DEFAULT true,
  notify_reminders boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chacun gère ses préférences" ON public.user_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_user_preferences_updated BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.member_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  created_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  imported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.member_imports TO authenticated;
GRANT ALL ON public.member_imports TO service_role;
ALTER TABLE public.member_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bureau consulte les imports" ON public.member_imports FOR SELECT TO authenticated
  USING (public.is_bureau(auth.uid()));
CREATE POLICY "Bureau enregistre les imports" ON public.member_imports FOR INSERT TO authenticated
  WITH CHECK (public.is_bureau(auth.uid()));