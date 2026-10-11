CREATE FUNCTION public.get_public_home() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT jsonb_build_object(
 'activities', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'date',a.date,'location',a.location,'image_url',a.image_url) ORDER BY a.date) FROM public.activities a WHERE a.is_public AND upper(a.status) NOT IN ('DRAFT','ARCHIVED','CANCELLED') AND a.date >= now() AND a.date < date_trunc('month',now() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris' + interval '1 month'), '[]'::jsonb),
 'website', (SELECT description FROM public.config_options WHERE family='EXTERNAL_LINK' AND code='ASSOCIATION_WEBSITE' AND is_active LIMIT 1));
$$;
REVOKE ALL ON FUNCTION public.get_public_home() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_home() TO anon, authenticated, service_role;