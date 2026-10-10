CREATE OR REPLACE FUNCTION public.entity_peek(_type text, _id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
      INTO r FROM public.activities a WHERE a.id=_id;
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
    SELECT jsonb_build_object('title', coalesce(p.display_name, trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,''))), 'subtitle', p.city,
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
$$;
REVOKE ALL ON FUNCTION public.entity_peek(text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.entity_peek(text,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.global_search(_term text, _kind text DEFAULT NULL, _since date DEFAULT NULL)
RETURNS TABLE(id uuid, kind text, title text, subtitle text, link text, occurred_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _me uuid := auth.uid(); q text := '%'||left(trim(coalesce(_term,'')),100)||'%';
BEGIN
  IF _me IS NULL OR length(trim(coalesce(_term,''))) < 2 THEN RETURN; END IF;
  RETURN QUERY
  SELECT * FROM (
    SELECT p.id, 'person'::text,
      coalesce(p.display_name, trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,''))), coalesce(p.city,p.membership_type),
      CASE WHEN public.is_bureau(_me) THEN '/members/'||p.id ELSE '/directory' END, p.created_at
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
    SELECT d.id,'document',d.title,coalesce(d.category,'Document'),'/documents',d.created_at FROM public.documents d WHERE (((upper(coalesce(d.visibility,'')) <> 'BUREAU') AND d.sensitivity <> 'SENSIBLE') OR public.is_bureau(_me) OR (d.sensitivity='SENSIBLE' AND public.has_permission(_me,'data.read_sensitive')) OR d.uploaded_by=_me) AND concat_ws(' ',d.title,d.category) ILIKE q
    UNION ALL
    SELECT tr.id,'resource',tr.name,coalesce(tr.location,tr.status),'/terrain',tr.created_at FROM public.terrain_resources tr WHERE concat_ws(' ',tr.name,tr.location) ILIKE q
    UNION ALL
    SELECT p.id,'participation',coalesce(a.title,e.title,'Participation'),p.registration_status,'/participations',p.created_at FROM public.participations p LEFT JOIN public.activities a ON a.id=p.activity_id LEFT JOIN public.events e ON e.id=p.event_id WHERE public.can_view_participation(_me,p.id) AND concat_ws(' ',a.title,e.title,p.registration_status) ILIKE q
  ) s
  WHERE (_kind IS NULL OR _kind='' OR _kind='ALL' OR s.kind=_kind) AND (_since IS NULL OR s.occurred_at::date >= _since)
  ORDER BY s.occurred_at DESC NULLS LAST LIMIT 60;
END;
$$;
REVOKE ALL ON FUNCTION public.global_search(text,text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.global_search(text,text,date) TO authenticated, service_role;