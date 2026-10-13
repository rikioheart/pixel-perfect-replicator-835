ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS attachment_path text;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS attachment_name text;
COMMENT ON COLUMN public.blog_posts.cover_url IS 'Chemin du visuel dans le stockage blog-media (privé, servi en lien signé pour les articles publiés)';

CREATE OR REPLACE FUNCTION public.list_public_blog_posts() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'title',title,'slug',slug,'excerpt',excerpt,'content',content,'cover',cover_url,'attachment',attachment_path,'attachment_name',attachment_name,'date',COALESCE(published_at,created_at)) ORDER BY COALESCE(published_at,created_at) DESC), '[]'::jsonb)
  FROM public.blog_posts WHERE status = 'PUBLISHED';
$$;
REVOKE ALL ON FUNCTION public.list_public_blog_posts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_blog_posts() TO anon, authenticated, service_role;

CREATE POLICY blog_media_bureau_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'blog-media' AND public.is_bureau(auth.uid()));
CREATE POLICY blog_media_bureau_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'blog-media' AND public.is_bureau(auth.uid()));
CREATE POLICY blog_media_bureau_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'blog-media' AND public.is_bureau(auth.uid()));
CREATE POLICY blog_media_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'blog-media');