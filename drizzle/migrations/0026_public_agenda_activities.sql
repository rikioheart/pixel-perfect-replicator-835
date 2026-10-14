CREATE OR REPLACE FUNCTION public.list_public_activities()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'description',a.description,'date',a.date,'location',a.location,'image_url',a.image_url,'category',a.category,'price_public',a.price_public,'price_member',a.price_member,'capacity',a.capacity,'occupied',public.occupied_spots(a.id,NULL),'dog_policy',a.dog_policy,'for_you_if',a.for_you_if,'to_bring',a.to_bring) ORDER BY a.date),'[]'::jsonb)
 FROM public.activities a
 WHERE a.is_public AND upper(a.status) NOT IN ('DRAFT','ARCHIVED','CANCELLED') AND a.date >= now() AND a.date < now() + interval '12 months';
$$;
REVOKE ALL ON FUNCTION public.list_public_activities() FROM public;
GRANT EXECUTE ON FUNCTION public.list_public_activities() TO anon, authenticated;