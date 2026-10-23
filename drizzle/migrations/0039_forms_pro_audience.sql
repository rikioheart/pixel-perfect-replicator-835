-- Formulaires : deux publics seulement. PUBLIC = tout le monde (visiteurs et tous les profils membres).
-- PRO = professionnels validés : adhésion PROFESSIONNEL active ET fiche professionnelle validée par le Bureau.
CREATE OR REPLACE FUNCTION public.is_validated_professional(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.is_professional(_user_id) AND EXISTS (
    SELECT 1 FROM public.professional_public_profile pr WHERE pr.profile_id = _user_id AND pr.status = 'ACTIVE')
$$;
REVOKE EXECUTE ON FUNCTION public.is_validated_professional(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_validated_professional(uuid) TO authenticated, service_role;

ALTER TABLE public.forms DROP CONSTRAINT IF EXISTS forms_audience_check;
UPDATE public.forms SET audience = 'PRO' WHERE audience NOT IN ('PUBLIC','PRO');
ALTER TABLE public.forms ALTER COLUMN audience SET DEFAULT 'PRO';
ALTER TABLE public.forms ADD CONSTRAINT forms_audience_check CHECK (audience = ANY (ARRAY['PUBLIC','PRO']));

DROP POLICY IF EXISTS forms_member_read ON public.forms;
CREATE POLICY forms_member_read ON public.forms FOR SELECT TO authenticated USING (
  created_by = auth.uid() OR public.is_bureau(auth.uid())
  OR (status = 'PUBLISHED' AND (audience = 'PUBLIC' OR (audience = 'PRO' AND public.is_validated_professional(auth.uid())))));

CREATE OR REPLACE FUNCTION public.submit_form_response(_form_id uuid, _answers jsonb, _name text, _email text, _consent boolean)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE f public.forms; rid uuid; cand uuid; uid uuid := auth.uid(); st text := 'NONE';
BEGIN
  SELECT * INTO f FROM public.forms WHERE id = _form_id AND status = 'PUBLISHED';
  IF f.id IS NULL THEN RAISE EXCEPTION 'Formulaire indisponible'; END IF;
  IF f.audience = 'PRO' AND uid IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF f.audience = 'PRO' AND NOT (public.is_validated_professional(uid) OR public.is_bureau(uid)) THEN
    RAISE EXCEPTION 'Formulaire réservé aux professionnels validés par le Bureau';
  END IF;
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

CREATE OR REPLACE FUNCTION public.global_search(_term text, _kind text DEFAULT NULL::text, _since date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, kind text, title text, subtitle text, link text, occurred_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); q text := '%'||left(trim(coalesce(_term,'')),100)||'%';
BEGIN
  IF _me IS NULL OR length(trim(coalesce(_term,''))) < 2 THEN RETURN; END IF;
  RETURN QUERY
  SELECT * FROM (
    SELECT p.id AS h_id, 'person'::text AS h_kind,
      coalesce(p.display_name, trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,''))) AS h_title, coalesce(p.city,p.membership_type) AS h_sub,
      CASE WHEN public.is_bureau(_me) THEN '/members/'||p.id ELSE '/directory' END AS h_link, p.created_at AS h_at
    FROM public.profiles p WHERE (p.public_visibility OR p.id=_me OR public.is_bureau(_me)) AND concat_ws(' ',p.display_name,p.first_name,p.last_name,p.city) ILIKE q
    UNION ALL
    SELECT d.id,'dog',d.name,coalesce(d.breed,'Chien'),CASE WHEN public.is_bureau(_me) THEN '/admin/chiens' WHEN public.is_professional(_me) THEN '/espace-pro/chiens' ELSE '/foyer' END,d.created_at
    FROM public.dogs d WHERE (public.can_manage_dog(_me,d.id) OR public.can_view_dog_operational(_me,d.id) OR public.is_bureau(_me)) AND concat_ws(' ',d.name,d.breed) ILIKE q
    UNION ALL
    SELECT pr.profile_id,'professional',pr.display_name,coalesce(pr.sector,array_to_string(pr.specialties,', ')),CASE WHEN pr.status='ACTIVE' THEN '/professionnels/'||pr.slug ELSE '/espace-pro/carte' END,pr.created_at
    FROM public.professional_public_profile pr WHERE (pr.status='ACTIVE' OR pr.profile_id=_me OR public.is_bureau(_me)) AND concat_ws(' ',pr.display_name,pr.sector,array_to_string(pr.specialties,' ')) ILIKE q
    UNION ALL
    SELECT p.id,'project',p.title,p.status,'/projects/'||p.id,p.created_at FROM public.projects p WHERE public.can_view_project(_me,p.id) AND concat_ws(' ',p.title,p.description) ILIKE q
    UNION ALL
    SELECT t.id,'task',t.title,t.status,'/tasks',t.created_at FROM public.tasks t WHERE (public.is_bureau(_me) OR t.assigned_user_id=_me OR t.created_by=_me OR (t.project_id IS NOT NULL AND public.can_view_project(_me,t.project_id))) AND concat_ws(' ',t.title,t.description) ILIKE q
    UNION ALL
    SELECT a.id,'activity',a.title,coalesce(a.location,a.category),'/activities/'||a.id,a.created_at FROM public.activities a WHERE concat_ws(' ',a.title,a.description,a.location,a.category) ILIKE q
    UNION ALL
    SELECT e.id,'event',e.title,coalesce(e.location,e.status),'/events/'||e.id,e.created_at FROM public.events e WHERE (e.visibility <> 'BUREAU' OR public.is_bureau(_me)) AND concat_ws(' ',e.title,e.description,e.location) ILIKE q
    UNION ALL
    SELECT d.id,'document',d.title,
      concat_ws(' · ', coalesce(d.category,'Document'), CASE d.sensitivity WHEN 'PUBLIC' THEN 'Public' WHEN 'INTERNE' THEN 'Interne' ELSE 'Sensible' END, nullif(d.service,'')),
      '/documents',d.created_at
    FROM public.documents d WHERE (((upper(coalesce(d.visibility,'')) <> 'BUREAU') AND d.sensitivity <> 'SENSIBLE') OR public.is_bureau(_me) OR (d.sensitivity='SENSIBLE' AND public.has_permission(_me,'data.read_sensitive')) OR d.uploaded_by=_me)
      AND concat_ws(' ',d.title,d.category,d.service,d.proof_type,d.context_type) ILIKE q
    UNION ALL
    -- Formulaires : titre, objectif, type et état ; jamais les champs ni réponses. Mêmes règles que forms_member_read.
    SELECT f.id,'form',f.title,
      concat_ws(' · ', CASE f.audience WHEN 'PUBLIC' THEN 'Public' ELSE 'Professionnels validés' END, CASE f.status WHEN 'PUBLISHED' THEN 'Ouvert' WHEN 'DRAFT' THEN 'Brouillon' ELSE 'Clos' END),
      CASE WHEN f.status='PUBLISHED' THEN '/formulaire/'||f.id ELSE '/forms' END, f.created_at
    FROM public.forms f WHERE (f.created_by=_me OR public.is_bureau(_me)
        OR (f.status='PUBLISHED' AND (f.audience='PUBLIC' OR (f.audience='PRO' AND public.is_validated_professional(_me)))))
      AND concat_ws(' ',f.title,f.purpose,f.kind) ILIKE q
    UNION ALL
    SELECT tr.id,'resource',tr.name,coalesce(tr.location,tr.status),'/terrain',tr.created_at FROM public.terrain_resources tr WHERE concat_ws(' ',tr.name,tr.location) ILIKE q
    UNION ALL
    SELECT p.id,'participation',coalesce(a.title,e.title,'Participation'),p.registration_status,'/participations',p.created_at FROM public.participations p LEFT JOIN public.activities a ON a.id=p.activity_id LEFT JOIN public.events e ON e.id=p.event_id WHERE public.can_view_participation(_me,p.id) AND concat_ws(' ',a.title,e.title,p.registration_status) ILIKE q
  ) s
  WHERE (_kind IS NULL OR _kind='' OR _kind='ALL' OR s.h_kind=_kind) AND (_since IS NULL OR s.h_at::date >= _since)
  ORDER BY s.h_at DESC NULLS LAST LIMIT 60;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.global_search(text, text, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.global_search(text, text, date) TO authenticated;