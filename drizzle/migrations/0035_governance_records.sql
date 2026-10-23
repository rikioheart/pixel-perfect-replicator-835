CREATE TABLE public.governance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'BUREAU' CHECK (kind IN ('AG','BUREAU','REUNION','AUTRE')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 200),
  meeting_date date NOT NULL DEFAULT current_date,
  summary text,
  decisions text,
  follow_up text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.governance_records TO authenticated;
GRANT ALL ON public.governance_records TO service_role;
ALTER TABLE public.governance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bureau lit le registre" ON public.governance_records FOR SELECT TO authenticated USING (public.is_bureau(auth.uid()));
CREATE POLICY "Bureau ajoute au registre" ON public.governance_records FOR INSERT TO authenticated WITH CHECK (public.is_bureau(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Bureau modifie le registre" ON public.governance_records FOR UPDATE TO authenticated USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));
CREATE POLICY "Bureau supprime du registre" ON public.governance_records FOR DELETE TO authenticated USING (public.is_bureau(auth.uid()));
CREATE TRIGGER governance_records_updated BEFORE UPDATE ON public.governance_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();