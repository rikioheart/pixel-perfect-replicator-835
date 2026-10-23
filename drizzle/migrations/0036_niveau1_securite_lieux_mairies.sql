DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND p.proname NOT IN ('list_public_pros','get_public_pro_page','get_public_home','list_public_activities','list_public_blog_posts','submit_form_response')
  LOOP EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, public', r.sig); END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.is_active_member(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND membership_status = 'ACTIVE') $$;
REVOKE EXECUTE ON FUNCTION public.is_active_member(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_active_member(uuid) TO authenticated;

ALTER TABLE public.forms DROP CONSTRAINT IF EXISTS forms_audience_check;
ALTER TABLE public.forms ADD CONSTRAINT forms_audience_check CHECK (audience = ANY (ARRAY['PUBLIC','INTERNE','TOUS']));

DROP POLICY IF EXISTS forms_member_read ON public.forms;
CREATE POLICY forms_member_read ON public.forms FOR SELECT TO authenticated USING (
  created_by = auth.uid() OR public.is_bureau(auth.uid())
  OR (status = 'PUBLISHED' AND (audience IN ('PUBLIC','TOUS') OR (audience = 'INTERNE' AND public.is_active_member(auth.uid())))));

CREATE OR REPLACE FUNCTION public.submit_form_response(_form_id uuid, _answers jsonb, _name text, _email text, _consent boolean)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE f public.forms; rid uuid; cand uuid; uid uuid := auth.uid(); st text := 'NONE';
BEGIN
  SELECT * INTO f FROM public.forms WHERE id = _form_id AND status = 'PUBLISHED';
  IF f.id IS NULL THEN RAISE EXCEPTION 'Formulaire indisponible'; END IF;
  IF f.audience IN ('INTERNE','TOUS') AND uid IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
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

ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.professional_public_profile ADD COLUMN IF NOT EXISTS public_address text;
ALTER TABLE public.professional_public_profile ADD COLUMN IF NOT EXISTS google_business_url text;

CREATE OR REPLACE FUNCTION public.get_public_pro_page(_slug text)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'slug', pp.slug, 'display_name', pp.display_name, 'logo_url', pp.logo_url,
    'specialties', pp.specialties, 'sector', pp.sector, 'description', pp.description,
    'website_url', pp.website_url, 'social_links', pp.social_links,
    'public_email', pp.public_email, 'public_phone', pp.public_phone, 'public_city', pp.public_city,
    'public_address', pp.public_address,
    'google_business_url', CASE WHEN pp.google_business_url ~* '^https://' THEN pp.google_business_url END,
    'activities', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'type', a.type, 'date', a.date, 'location', a.location, 'price_public', a.price_public, 'price_member', a.price_member) ORDER BY a.date), '[]'::jsonb)
       FROM public.activities a WHERE a.is_public AND (a.professional_id = pp.profile_id OR pp.profile_id = ANY (a.professional_ids))
         AND upper(a.status) NOT IN ('DRAFT','ARCHIVED','CANCELLED')),
    'advantages', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', v.id, 'title', v.title, 'description', v.description, 'conditions', v.conditions, 'valid_until', v.valid_until)), '[]'::jsonb)
       FROM public.advantages v WHERE v.is_public AND v.professional_id = pp.profile_id AND upper(v.status) = 'ACTIVE'
         AND (v.valid_until IS NULL OR v.valid_until >= current_date)),
    'collaborations', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'description', c.description, 'happened_on', c.happened_on) ORDER BY c.happened_on DESC NULLS LAST), '[]'::jsonb)
       FROM public.professional_collaborations c WHERE c.is_public AND c.professional_id = pp.profile_id),
    'dogs_count', (SELECT count(DISTINCT x.dog_id) FROM (
        SELECT dog_id FROM public.dog_referents WHERE professional_id = pp.profile_id
        UNION SELECT dog_id FROM public.dog_professional_access WHERE professional_id = pp.profile_id AND NOT revoked AND (expires_at IS NULL OR expires_at > now())) x)
  )
  FROM public.professional_public_profile pp
  WHERE pp.slug = _slug AND pp.status = 'ACTIVE' AND pp.public_listing
$function$;

CREATE TABLE public.entity_mairies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mairie_id uuid NOT NULL REFERENCES public.mairies(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('project','activity','event')),
  entity_id uuid NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mairie_id, entity_type, entity_id)
);
GRANT SELECT, INSERT, DELETE ON public.entity_mairies TO authenticated;
GRANT ALL ON public.entity_mairies TO service_role;
ALTER TABLE public.entity_mairies ENABLE ROW LEVEL SECURITY;
CREATE POLICY em_read ON public.entity_mairies FOR SELECT TO authenticated USING (
  public.is_bureau(auth.uid()) OR public.can_view_comment_target(auth.uid(), entity_type, entity_id));
CREATE POLICY em_write ON public.entity_mairies FOR INSERT TO authenticated WITH CHECK (public.is_bureau(auth.uid()));
CREATE POLICY em_delete ON public.entity_mairies FOR DELETE TO authenticated USING (public.is_bureau(auth.uid()));

CREATE OR REPLACE FUNCTION public.linked_mairies(_type text, _id uuid)
RETURNS TABLE(link_id uuid, mairie_id uuid, name text, city text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, m.id, m.organization, m.city FROM public.entity_mairies l JOIN public.mairies m ON m.id = l.mairie_id
  WHERE l.entity_type = _type AND l.entity_id = _id
    AND (public.is_bureau(auth.uid()) OR public.can_view_comment_target(auth.uid(), _type, _id))
  ORDER BY m.organization $$;
REVOKE EXECUTE ON FUNCTION public.linked_mairies(text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.linked_mairies(text, uuid) TO authenticated;