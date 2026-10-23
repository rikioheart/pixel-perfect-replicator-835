UPDATE public.forms SET audience = 'PUBLIC' WHERE audience = 'TOUS';
ALTER TABLE public.forms DROP CONSTRAINT IF EXISTS forms_audience_check;
ALTER TABLE public.forms ADD CONSTRAINT forms_audience_check CHECK (audience = ANY (ARRAY['PUBLIC','INTERNE']));

DROP POLICY IF EXISTS forms_member_read ON public.forms;
CREATE POLICY forms_member_read ON public.forms FOR SELECT TO authenticated USING (
  created_by = auth.uid() OR public.is_bureau(auth.uid())
  OR (status = 'PUBLISHED' AND (audience = 'PUBLIC' OR (audience = 'INTERNE' AND public.is_active_member(auth.uid())))));

CREATE OR REPLACE FUNCTION public.submit_form_response(_form_id uuid, _answers jsonb, _name text, _email text, _consent boolean)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE f public.forms; rid uuid; cand uuid; uid uuid := auth.uid(); st text := 'NONE';
BEGIN
  SELECT * INTO f FROM public.forms WHERE id = _form_id AND status = 'PUBLISHED';
  IF f.id IS NULL THEN RAISE EXCEPTION 'Formulaire indisponible'; END IF;
  IF f.audience = 'INTERNE' AND uid IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF f.audience = 'INTERNE' AND NOT public.is_active_member(uid) THEN RAISE EXCEPTION 'Formulaire réservé aux adhésions validées'; END IF;
  IF f.consent_required AND NOT coalesce(_consent,false) THEN RAISE EXCEPTION 'Consentement requis'; END IF;
  IF length(coalesce(_answers::text,'')) > 20000 THEN RAISE EXCEPTION 'Réponse trop longue'; END IF;
  IF uid IS NULL AND (coalesce(_email,'') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN RAISE EXCEPTION 'E-mail invalide'; END IF;
  IF uid IS NOT NULL THEN
    cand := public.current_person_id(uid);
  ELSIF _email IS NOT NULL THEN
    SELECT id INTO cand FROM public.people WHERE lower(email) = lower(trim(_email)) LIMIT 1;
    IF cand IS NOT NULL THEN st := 'TO_REVIEW'; END IF;
  END IF;
  INSERT INTO public.form_responses(form_id, respondent_user_id, respondent_name, respondent_email, answers, consent_given, candidate_person_id, match_status)
  VALUES (_form_id, uid, left(_name,120), left(lower(trim(_email)),200), coalesce(_answers,'{}'::jsonb), coalesce(_consent,false), cand, CASE WHEN uid IS NOT NULL THEN 'CONFIRMED' ELSE st END)
  RETURNING id INTO rid;
  IF f.created_by IS NOT NULL THEN
    PERFORM public.notify_once(f.created_by, 'form_response', 'Formulaire reçu', 'Nouvelle réponse : '||f.title, 'form', f.id, '/forms');
  END IF;
  RETURN rid;
END $function$;