ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS statutory_category text NOT NULL DEFAULT 'ACTIF';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_statutory_category_chk
  CHECK (statutory_category IN ('FONDATEUR','ACTIF','BIENFAITEUR','APPRENANT','SOUTIEN'));
COMMENT ON COLUMN public.profiles.statutory_category IS 'Catégorie statutaire (article 5). Indépendante du type technique membership_type et des fonctions (Bureau, représentant, bénévole), qui se cumulent.';

CREATE OR REPLACE FUNCTION public.guard_profile_membership()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_bureau(auth.uid()) THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.membership_status := 'PENDING';
    NEW.statutory_category := 'ACTIF';
    IF NEW.membership_type NOT IN ('PARTICULIER','PROFESSIONNEL') THEN NEW.membership_type := 'PARTICULIER'; END IF;
  ELSE
    IF NEW.membership_type IS DISTINCT FROM OLD.membership_type
       OR NEW.membership_status IS DISTINCT FROM OLD.membership_status
       OR NEW.statutory_category IS DISTINCT FROM OLD.statutory_category THEN
      RAISE EXCEPTION 'Seul le Bureau peut modifier le type, le statut ou la catégorie d''adhésion';
    END IF;
  END IF;
  RETURN NEW;
END $function$;

ALTER TABLE public.professional_public_profile ADD COLUMN IF NOT EXISTS public_listing boolean NOT NULL DEFAULT false;
UPDATE public.professional_public_profile SET public_listing = true WHERE status = 'ACTIVE';
COMMENT ON COLUMN public.professional_public_profile.public_listing IS 'Choix du professionnel d''apparaître sur la page publique (article 14). Possible uniquement quand le référencement est validé (status ACTIVE).';

CREATE OR REPLACE FUNCTION public.guard_pro_profile_status()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_bureau(auth.uid()) THEN
    IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.reviewed_by := auth.uid(); NEW.reviewed_at := now();
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('DRAFT','PENDING_REVIEW') THEN NEW.status := 'DRAFT'; END IF;
    NEW.public_listing := false;
  ELSE
    IF OLD.status = 'SUSPENDED' AND NEW.status <> 'SUSPENDED' THEN
      RAISE EXCEPTION 'Fiche suspendue : contactez le Bureau';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('DRAFT','PENDING_REVIEW') THEN
      RAISE EXCEPTION 'Seul le Bureau peut publier ou suspendre une fiche';
    END IF;
    IF NEW.public_listing AND NEW.status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'Le référencement public n''est possible qu''après validation par le Bureau';
    END IF;
    NEW.reviewed_by := OLD.reviewed_by; NEW.reviewed_at := OLD.reviewed_at;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.list_public_pros()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('slug', slug, 'display_name', display_name, 'logo_url', logo_url, 'specialties', specialties, 'sector', sector, 'public_city', public_city) ORDER BY display_name), '[]'::jsonb)
  FROM public.professional_public_profile WHERE status = 'ACTIVE' AND public_listing
$function$;

CREATE OR REPLACE FUNCTION public.get_public_pro_page(_slug text)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'slug', pp.slug, 'display_name', pp.display_name, 'logo_url', pp.logo_url,
    'specialties', pp.specialties, 'sector', pp.sector, 'description', pp.description,
    'website_url', pp.website_url, 'social_links', pp.social_links,
    'public_email', pp.public_email, 'public_phone', pp.public_phone, 'public_city', pp.public_city,
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