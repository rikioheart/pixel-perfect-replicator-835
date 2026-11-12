-- Lot 4 : profil plus humain et confidentialité par champ (additif, valeurs privées par défaut).

-- 1. Nouveaux champs facultatifs et visibilités (MEMBERS = annuaire des membres, PRIVATE = vous et le Bureau).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio_visibility text NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN IF NOT EXISTS location_visibility text NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN IF NOT EXISTS skills_visibility text NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN IF NOT EXISTS availability_visibility text NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN IF NOT EXISTS availability text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS collaboration_modes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contribution_types text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bio_visibility_check CHECK (bio_visibility IN ('MEMBERS','PRIVATE')),
  ADD CONSTRAINT profiles_location_visibility_check CHECK (location_visibility IN ('MEMBERS','PRIVATE')),
  ADD CONSTRAINT profiles_skills_visibility_check CHECK (skills_visibility IN ('MEMBERS','PRIVATE')),
  ADD CONSTRAINT profiles_availability_visibility_check CHECK (availability_visibility IN ('MEMBERS','PRIVATE')),
  ADD CONSTRAINT profiles_availability_check CHECK (availability <@ ARRAY['SEMAINE','SOIR','WEEKEND','PONCTUEL']::text[]),
  ADD CONSTRAINT profiles_collaboration_modes_check CHECK (collaboration_modes <@ ARRAY['PRESENTIEL','DISTANCE','ASYNCHRONE','COLLECTIF']::text[]),
  ADD CONSTRAINT profiles_contribution_types_check CHECK (contribution_types <@ ARRAY['TEMPS','PONCTUEL','COMPETENCE','MISE_EN_RELATION','IDEE','TERRAIN','REFERENT']::text[]),
  ADD CONSTRAINT profiles_bio_length_check CHECK (bio IS NULL OR char_length(bio) <= 600),
  ADD CONSTRAINT profiles_skills_count_check CHECK (cardinality(skills) <= 30),
  ADD CONSTRAINT profiles_avatar_path_owner_check CHECK (avatar_path IS NULL OR avatar_path LIKE id::text || '/%');

COMMENT ON COLUMN public.profiles.bio_visibility IS 'Présentation : MEMBERS (annuaire des membres) ou PRIVATE (vous et le Bureau).';
COMMENT ON COLUMN public.profiles.location_visibility IS 'Ville et département : MEMBERS ou PRIVATE.';
COMMENT ON COLUMN public.profiles.skills_visibility IS 'Compétences et centres d''intérêt (skills) : MEMBERS ou PRIVATE.';
COMMENT ON COLUMN public.profiles.availability_visibility IS 'Disponibilités, façons de collaborer et contributions souhaitées : MEMBERS ou PRIVATE.';

-- Reprise : les personnes déjà visibles voyaient leur présentation et leur ville affichées ; on conserve ce choix.
UPDATE public.profiles SET bio_visibility = 'MEMBERS', location_visibility = 'MEMBERS' WHERE public_visibility;

-- 2. Moindre privilège : ces colonnes ne se lisent plus en direct, seulement via les fonctions ci-dessous.
REVOKE SELECT (bio, city, department, skills, bio_visibility, location_visibility, skills_visibility,
  availability_visibility, availability, collaboration_modes, contribution_types) ON public.profiles FROM authenticated, anon;
REVOKE ALL ON public.profiles FROM anon;

-- 3. Détail complet : soi-même ou Bureau (même règle que profile_contacts).
CREATE OR REPLACE FUNCTION public.profile_details(_ids uuid[])
RETURNS TABLE(id uuid, bio text, city text, department text, skills text[], availability text[], collaboration_modes text[],
  contribution_types text[], bio_visibility text, location_visibility text, skills_visibility text, availability_visibility text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.id, p.bio, p.city, p.department, p.skills, p.availability, p.collaboration_modes, p.contribution_types,
    p.bio_visibility, p.location_visibility, p.skills_visibility, p.availability_visibility
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND p.id = ANY(_ids) AND (p.id = auth.uid() OR public.is_bureau(auth.uid()))
$$;
REVOKE EXECUTE ON FUNCTION public.profile_details(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_details(uuid[]) TO authenticated;

-- 4. Projection unique de l'annuaire. _as_member = true donne la vue d'un membre, même au Bureau
--    (utilisée par « Voir mon profil tel que les autres le voient »).
CREATE OR REPLACE FUNCTION public.directory_profiles(_ids uuid[] DEFAULT NULL, _as_member boolean DEFAULT false)
RETURNS TABLE(id uuid, display_name text, first_name text, last_name text, avatar_path text, membership_type text,
  membership_status text, public_visibility boolean, city text, department text, bio text, skills text[],
  availability text[], collaboration_modes text[], contribution_types text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _me uuid := auth.uid(); _full boolean;
BEGIN
  IF _me IS NULL THEN RETURN; END IF;
  _full := public.is_bureau(_me) AND NOT coalesce(_as_member, false);
  RETURN QUERY
  SELECT p.id, p.display_name, p.first_name, p.last_name, p.avatar_path, p.membership_type, p.membership_status, p.public_visibility,
    CASE WHEN _full OR p.location_visibility = 'MEMBERS' THEN p.city END,
    CASE WHEN _full OR p.location_visibility = 'MEMBERS' THEN p.department END,
    CASE WHEN _full OR p.bio_visibility = 'MEMBERS' THEN p.bio END,
    CASE WHEN _full OR p.skills_visibility = 'MEMBERS' THEN p.skills ELSE '{}'::text[] END,
    CASE WHEN _full OR p.availability_visibility = 'MEMBERS' THEN p.availability ELSE '{}'::text[] END,
    CASE WHEN _full OR p.availability_visibility = 'MEMBERS' THEN p.collaboration_modes ELSE '{}'::text[] END,
    CASE WHEN _full OR p.availability_visibility = 'MEMBERS' THEN p.contribution_types ELSE '{}'::text[] END
  FROM public.profiles p
  WHERE p.deleted_at IS NULL AND p.membership_status = 'ACTIVE'
    AND (p.public_visibility OR _full)
    AND (_ids IS NULL OR p.id = ANY(_ids))
  ORDER BY p.display_name NULLS LAST, p.first_name;
END $$;
REVOKE EXECUTE ON FUNCTION public.directory_profiles(uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.directory_profiles(uuid[], boolean) TO authenticated;

-- 5. Photos de profil : bucket privé « avatars », dossier = identifiant du propriétaire.
--    Lecture : soi-même, Bureau, ou membre visible dans l'annuaire (adhésion active).
CREATE OR REPLACE FUNCTION public.can_view_avatar(_owner text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    _owner = auth.uid()::text OR public.is_bureau(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id::text = _owner AND p.public_visibility
      AND p.membership_status = 'ACTIVE' AND p.deleted_at IS NULL))
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_avatar(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_avatar(text) TO authenticated;

CREATE POLICY avatars_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND public.can_view_avatar((storage.foldername(name))[1]));
CREATE POLICY avatars_insert_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY avatars_update_own ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY avatars_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 6. La vue public_professionals (inutilisée par l'application) exposait présentation et ville aux visiteurs anonymes.
REVOKE ALL ON public.public_professionals FROM anon, authenticated;
COMMENT ON VIEW public.public_professionals IS 'DEPRECATED: non utilisée ; la vitrine passe par list_public_pros/get_public_pro_page.';

-- 7. Fiche contextuelle et recherche : la ville n'apparaît que si elle est visible.
CREATE OR REPLACE FUNCTION public.entity_peek(_type text, _id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); r jsonb;
BEGIN
  IF _me IS NULL THEN RETURN NULL; END IF;
  IF _type = 'dog' THEN
    IF NOT (public.can_manage_dog(_me,_id) OR public.can_view_dog_operational(_me,_id) OR public.is_bureau(_me)) THEN RETURN NULL; END IF;
    SELECT jsonb_build_object('title', d.name, 'subtitle', d.breed,
      'indicators', coalesce((SELECT jsonb_agg(jsonb_build_object('family',i.family,'label',i.label,'category',i.category)) FROM public.dog_indicators i WHERE i.dog_id=d.id),'[]'),
      'can_open', public.can_manage_dog(_me,_id) OR public.pro_dog_perm(_me,_id,'any') OR public.is_bureau(_me),
      'link', CASE WHEN public.is_bureau(_me) THEN '/admin/chiens' WHEN public.is_professional(_me) THEN '/espace-pro/chiens' ELSE '/foyer' END)
    INTO r FROM public.dogs d WHERE d.id=_id;
  ELSIF _type = 'project' THEN
    IF NOT public.can_view_project(_me,_id) THEN RETURN NULL; END IF;
    SELECT jsonb_build_object('title', p.title, 'subtitle', p.status, 'can_open', true, 'link', '/projects/'||p.id) INTO r FROM public.projects p WHERE p.id=_id;
  ELSIF _type = 'activity' THEN
    SELECT jsonb_build_object('title', a.title, 'subtitle', to_char(a.date,'DD/MM/YYYY')||coalesce(' · '||a.location,''), 'category', a.category, 'can_open', true, 'link', '/activities/'||a.id)
      INTO r FROM public.activities a WHERE a.id=_id AND public.can_view_activity(_me,a.id);
  ELSIF _type = 'event' THEN
    SELECT jsonb_build_object('title', e.title, 'subtitle', to_char(e.start_date,'DD/MM/YYYY')||coalesce(' · '||e.location,''), 'status', e.status, 'can_open', true, 'link', '/events/'||e.id)
      INTO r FROM public.events e WHERE e.id=_id AND (e.visibility <> 'BUREAU' OR public.is_bureau(_me));
  ELSIF _type = 'reservation' THEN
    IF NOT public.can_view_terrain_reservation(_me,_id) THEN RETURN NULL; END IF;
    SELECT jsonb_build_object('title', coalesce(tr.name,'Terrain'), 'subtitle', to_char(t.date,'DD/MM/YYYY')||' '||left(t.start_time::text,5)||'–'||left(t.end_time::text,5),
      'status', t.status, 'category', t.work_category, 'equipment', t.equipment_requested, 'can_open', true, 'link', '/terrain')
      INTO r FROM public.terrain_reservations t LEFT JOIN public.terrain_resources tr ON tr.id=t.resource_id WHERE t.id=_id;
  ELSIF _type = 'task' THEN
    SELECT jsonb_build_object('title', t.title, 'subtitle', t.status, 'can_open', true, 'link', '/tasks') INTO r FROM public.tasks t
      WHERE t.id=_id AND (public.is_bureau(_me) OR t.assigned_user_id=_me OR t.created_by=_me OR (t.project_id IS NOT NULL AND public.can_view_project(_me,t.project_id)));
  ELSIF _type = 'person' THEN
    SELECT jsonb_build_object('title', coalesce(p.display_name, trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,''))), 'subtitle', CASE WHEN p.id=_me OR public.is_bureau(_me) OR p.location_visibility='MEMBERS' THEN p.city END,
      'can_open', public.is_bureau(_me), 'link', CASE WHEN public.is_bureau(_me) THEN '/members/'||p.id ELSE '/directory' END) INTO r FROM public.profiles p WHERE p.id=_id AND (p.public_visibility OR p.id=_me OR public.is_bureau(_me));
  ELSIF _type = 'professional' THEN
    SELECT jsonb_build_object('title', p.display_name, 'subtitle', coalesce(p.sector, array_to_string(p.specialties, ', ')),
      'can_open', p.status='ACTIVE' OR p.profile_id=_me OR public.is_bureau(_me), 'link', CASE WHEN p.status='ACTIVE' THEN '/professionnels/'||p.slug ELSE '/espace-pro/carte' END) INTO r FROM public.professional_public_profile p
      WHERE p.profile_id=_id AND (p.status='ACTIVE' OR p.profile_id=_me OR public.is_bureau(_me));
  ELSIF _type = 'document' THEN
    SELECT jsonb_build_object('title', d.title, 'subtitle', d.category, 'can_open', true, 'link', '/documents') INTO r
    FROM public.documents d WHERE d.id=_id AND (((upper(coalesce(d.visibility,'')) <> 'BUREAU') AND d.sensitivity <> 'SENSIBLE') OR public.is_bureau(_me) OR (d.sensitivity='SENSIBLE' AND public.has_permission(_me,'data.read_sensitive')) OR d.uploaded_by=_me);
  ELSIF _type = 'participation' THEN
    IF NOT public.can_view_participation(_me,_id) THEN RETURN NULL; END IF;
    SELECT jsonb_build_object('title', coalesce(a.title,e.title,'Participation'), 'subtitle', p.registration_status, 'can_open', true, 'link', '/participations') INTO r
    FROM public.participations p LEFT JOIN public.activities a ON a.id=p.activity_id LEFT JOIN public.events e ON e.id=p.event_id WHERE p.id=_id;
  ELSIF _type = 'resource' THEN
    SELECT jsonb_build_object('title', tr.name, 'subtitle', tr.location, 'can_open', true, 'link', '/terrain') INTO r FROM public.terrain_resources tr WHERE tr.id=_id;
  END IF;
  RETURN r;
END;
$function$;

CREATE OR REPLACE FUNCTION public.global_search(_term text, _kind text DEFAULT NULL::text, _since date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, kind text, title text, subtitle text, link text, occurred_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); q text := '%'||left(trim(coalesce(_term,'')),100)||'%'; _bureau boolean := public.is_bureau(auth.uid());
BEGIN
  IF _me IS NULL OR length(trim(coalesce(_term,''))) < 2 THEN RETURN; END IF;
  RETURN QUERY
  SELECT * FROM (
    SELECT p.id AS h_id, 'person'::text AS h_kind,
      coalesce(p.display_name, trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,''))) AS h_title,
      coalesce(CASE WHEN p.id=_me OR _bureau OR p.location_visibility='MEMBERS' THEN p.city END, p.membership_type) AS h_sub,
      CASE WHEN _bureau THEN '/members/'||p.id ELSE '/directory' END AS h_link, p.created_at AS h_at
    FROM public.profiles p WHERE (p.public_visibility OR p.id=_me OR _bureau)
      AND concat_ws(' ',p.display_name,p.first_name,p.last_name,
        CASE WHEN p.id=_me OR _bureau OR p.location_visibility='MEMBERS' THEN p.city END) ILIKE q
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
    SELECT a.id,'activity',a.title,coalesce(a.location,a.category),'/activities/'||a.id,a.created_at FROM public.activities a WHERE public.can_view_activity(_me,a.id) AND concat_ws(' ',a.title,a.description,a.location,a.category) ILIKE q
    UNION ALL
    SELECT e.id,'event',e.title,coalesce(e.location,e.status),'/events/'||e.id,e.created_at FROM public.events e WHERE (e.visibility <> 'BUREAU' OR public.is_bureau(_me)) AND concat_ws(' ',e.title,e.description,e.location) ILIKE q
    UNION ALL
    SELECT d.id,'document',d.title,
      concat_ws(' · ', coalesce(d.category,'Document'), CASE d.sensitivity WHEN 'PUBLIC' THEN 'Public' WHEN 'INTERNE' THEN 'Interne' ELSE 'Sensible' END, nullif(d.service,'')),
      '/documents',d.created_at
    FROM public.documents d WHERE (((upper(coalesce(d.visibility,'')) <> 'BUREAU') AND d.sensitivity <> 'SENSIBLE') OR public.is_bureau(_me) OR (d.sensitivity='SENSIBLE' AND public.has_permission(_me,'data.read_sensitive')) OR d.uploaded_by=_me)
      AND concat_ws(' ',d.title,d.category,d.service,d.proof_type,d.context_type) ILIKE q
    UNION ALL
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