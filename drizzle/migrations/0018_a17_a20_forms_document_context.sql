ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS context_type text, ADD COLUMN IF NOT EXISTS context_id uuid;
ALTER TABLE public.documents ADD CONSTRAINT documents_context_type_chk CHECK (context_type IS NULL OR context_type IN ('ASSOCIATION','PERSON','HOUSEHOLD','DOG','PROFESSIONAL','PROJECT','ACTIVITY','EVENT','RESERVATION','TASK'));
CREATE INDEX IF NOT EXISTS documents_context_idx ON public.documents(context_type, context_id);

CREATE TABLE public.forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  purpose text NOT NULL,
  data_usage text NOT NULL,
  contact text,
  audience text NOT NULL DEFAULT 'INTERNE' CHECK (audience IN ('PUBLIC','INTERNE')),
  kind text NOT NULL DEFAULT 'COLLECTE' CHECK (kind IN ('INSCRIPTION','DEMANDE','RESERVATION','MATERIEL','COLLECTE','PARTICIPATION','QUESTIONNAIRE')),
  context_type text CHECK (context_type IS NULL OR context_type IN ('ASSOCIATION','ACTIVITY','EVENT','PROJECT','RESERVATION','PERSON')),
  context_id uuid,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  consent_required boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','CLOSED')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.forms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forms TO authenticated;
GRANT ALL ON public.forms TO service_role;
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY forms_public_read ON public.forms FOR SELECT TO anon USING (status = 'PUBLISHED' AND audience = 'PUBLIC');
CREATE POLICY forms_member_read ON public.forms FOR SELECT TO authenticated USING (status = 'PUBLISHED' OR created_by = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY forms_insert ON public.forms FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND (public.is_bureau(auth.uid()) OR public.is_professional(auth.uid()) OR (context_type = 'PROJECT' AND public.is_project_coordinator(auth.uid(), context_id))));
CREATE POLICY forms_update ON public.forms FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY forms_delete ON public.forms FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_bureau(auth.uid()));
CREATE TRIGGER forms_updated BEFORE UPDATE ON public.forms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  respondent_user_id uuid,
  respondent_name text,
  respondent_email text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent_given boolean NOT NULL DEFAULT false,
  candidate_person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  match_status text NOT NULL DEFAULT 'NONE' CHECK (match_status IN ('NONE','TO_REVIEW','CONFIRMED','REJECTED')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.form_responses TO authenticated;
GRANT ALL ON public.form_responses TO service_role;
ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY fr_read ON public.form_responses FOR SELECT TO authenticated USING (
  respondent_user_id = auth.uid() OR public.is_bureau(auth.uid())
  OR EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.created_by = auth.uid()));
CREATE POLICY fr_review ON public.form_responses FOR UPDATE TO authenticated USING (
  public.is_bureau(auth.uid()) OR EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.created_by = auth.uid()));
CREATE POLICY fr_delete ON public.form_responses FOR DELETE TO authenticated USING (public.is_bureau(auth.uid()));

-- Soumission unique et contrôlée (pas d'INSERT direct) : pas de création de personne, rapprochement à valider
CREATE OR REPLACE FUNCTION public.submit_form_response(_form_id uuid, _answers jsonb, _name text, _email text, _consent boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.forms; rid uuid; cand uuid; uid uuid := auth.uid(); st text := 'NONE';
BEGIN
  SELECT * INTO f FROM public.forms WHERE id = _form_id AND status = 'PUBLISHED';
  IF f.id IS NULL THEN RAISE EXCEPTION 'Formulaire indisponible'; END IF;
  IF f.audience = 'INTERNE' AND uid IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF f.consent_required AND NOT coalesce(_consent,false) THEN RAISE EXCEPTION 'Consentement requis'; END IF;
  IF length(coalesce(_answers::text,'')) > 20000 THEN RAISE EXCEPTION 'Réponse trop longue'; END IF;
  IF uid IS NULL AND (coalesce(_email,'') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN RAISE EXCEPTION 'E-mail invalide'; END IF;
  IF uid IS NOT NULL THEN
    cand := public.current_person_id(uid);
  ELSIF _email IS NOT NULL THEN
    SELECT id INTO cand FROM public.people WHERE lower(email) = lower(trim(_email)) LIMIT 1;
    IF cand IS NOT NULL THEN st := 'TO_REVIEW'; END IF;  -- l'e-mail n'est pas une preuve : validation humaine
  END IF;
  INSERT INTO public.form_responses(form_id, respondent_user_id, respondent_name, respondent_email, answers, consent_given, candidate_person_id, match_status)
  VALUES (_form_id, uid, left(_name,120), left(lower(trim(_email)),200), coalesce(_answers,'{}'::jsonb), coalesce(_consent,false), cand, CASE WHEN uid IS NOT NULL THEN 'CONFIRMED' ELSE st END)
  RETURNING id INTO rid;
  IF f.created_by IS NOT NULL THEN
    PERFORM public.notify_once(f.created_by, 'form_response', 'Formulaire reçu', 'Nouvelle réponse : '||f.title, 'form', f.id, '/forms');
  END IF;
  RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.submit_form_response(uuid,jsonb,text,text,boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_form_response(uuid,jsonb,text,text,boolean) TO anon, authenticated, service_role;