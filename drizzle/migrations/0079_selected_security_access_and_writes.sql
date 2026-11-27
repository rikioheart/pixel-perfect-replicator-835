CREATE OR REPLACE FUNCTION public.guard_public_share_target() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.entity_type IS DISTINCT FROM OLD.entity_type OR NEW.entity_id IS DISTINCT FROM OLD.entity_id OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.token IS DISTINCT FROM OLD.token THEN
 RAISE EXCEPTION 'La source du lien ne peut pas être changée. Créez un nouveau partage.'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_public_share_target() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_public_share_target() TO service_role;
CREATE TRIGGER guard_public_share_target BEFORE UPDATE ON public.public_shares FOR EACH ROW EXECUTE FUNCTION public.guard_public_share_target();

CREATE OR REPLACE FUNCTION public.guard_dog_responsibility() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND OLD.owner_id IS DISTINCT FROM auth.uid() AND (NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.household_id IS DISTINCT FROM OLD.household_id) THEN
 RAISE EXCEPTION 'Seul le responsable du chien peut changer sa responsabilité ou son foyer.'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_dog_responsibility() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_dog_responsibility() TO service_role;
CREATE TRIGGER guard_dog_responsibility BEFORE UPDATE ON public.dogs FOR EACH ROW EXECUTE FUNCTION public.guard_dog_responsibility();

CREATE OR REPLACE FUNCTION public.guard_advantage_claim() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE offer public.advantages%ROWTYPE; total bigint;
BEGIN
 IF auth.uid() IS NOT NULL AND NEW.user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Réservez uniquement pour vous-même.'; END IF;
 IF NOT public.is_active_member(NEW.user_id) THEN RAISE EXCEPTION 'Une adhésion active est nécessaire.'; END IF;
 IF current_setting('transaction_isolation') = 'repeatable read' THEN RAISE EXCEPTION 'Utilisez une transaction standard.'; END IF;
 SELECT * INTO offer FROM public.advantages WHERE id=NEW.advantage_id FOR UPDATE;
 IF NOT FOUND OR offer.status <> 'PUBLISHED' OR (offer.valid_from IS NOT NULL AND offer.valid_from > CURRENT_DATE) OR (offer.valid_until IS NOT NULL AND offer.valid_until < CURRENT_DATE) THEN RAISE EXCEPTION 'Cet avantage n’est pas disponible actuellement.'; END IF;
 SELECT count(*) INTO total FROM public.advantage_claims WHERE advantage_id=NEW.advantage_id;
 IF offer.quantity IS NOT NULL AND total >= offer.quantity THEN RAISE EXCEPTION 'Cet avantage a déjà été entièrement réservé.'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_advantage_claim() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_advantage_claim() TO service_role;
CREATE TRIGGER guard_advantage_claim BEFORE INSERT ON public.advantage_claims FOR EACH ROW EXECUTE FUNCTION public.guard_advantage_claim();
CREATE INDEX IF NOT EXISTS advantage_claims_advantage_idx ON public.advantage_claims(advantage_id);
ALTER POLICY claims_insert ON public.advantage_claims WITH CHECK (user_id=(select auth.uid()) AND (select public.is_active_member((select auth.uid()))));

CREATE OR REPLACE FUNCTION public.guard_blog_publication() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me uuid := auth.uid(); asset text;
BEGIN
 IF me IS NULL THEN RETURN NEW; END IF;
 IF NOT public.is_bureau(me) THEN
  IF TG_OP='INSERT' AND (NEW.status='PUBLISHED' OR NEW.published_at IS NOT NULL) THEN RAISE EXCEPTION 'La publication est validée par le Bureau.'; END IF;
  IF TG_OP='UPDATE' AND (OLD.status='PUBLISHED' OR NEW.status='PUBLISHED' OR NEW.published_at IS DISTINCT FROM OLD.published_at OR NEW.author_id IS DISTINCT FROM OLD.author_id) THEN RAISE EXCEPTION 'La publication est validée par le Bureau.'; END IF;
 END IF;
 FOREACH asset IN ARRAY ARRAY[NEW.cover_url,NEW.attachment_path] LOOP
  IF asset IS NOT NULL AND asset<>'' AND asset !~ '^https?://' AND NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id='blog-media' AND o.name=asset AND o.owner_id=NEW.author_id::text) THEN RAISE EXCEPTION 'Le fichier doit appartenir à l’auteur de cet article.'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_blog_publication() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_blog_publication() TO service_role;
CREATE TRIGGER guard_blog_publication BEFORE INSERT OR UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.guard_blog_publication();
CREATE OR REPLACE FUNCTION public.list_public_blog_posts() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',b.id,'title',b.title,'slug',b.slug,'excerpt',b.excerpt,'content',b.content,
 'cover',CASE WHEN b.cover_url ~ '^https://' OR EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id='blog-media' AND o.name=b.cover_url AND o.owner_id=b.author_id::text) THEN b.cover_url END,
 'attachment',CASE WHEN b.attachment_path ~ '^https://' OR EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id='blog-media' AND o.name=b.attachment_path AND o.owner_id=b.author_id::text) THEN b.attachment_path END,
 'attachment_name',b.attachment_name,'date',coalesce(b.published_at,b.created_at)) ORDER BY coalesce(b.published_at,b.created_at) DESC),'[]'::jsonb) FROM public.blog_posts b WHERE b.status='PUBLISHED';
$$;
REVOKE ALL ON FUNCTION public.list_public_blog_posts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_blog_posts() TO anon,authenticated,service_role;
ALTER POLICY blog_media_read ON storage.objects TO authenticated USING (bucket_id='blog-media' AND (owner_id=(select auth.uid())::text OR (select public.is_bureau((select auth.uid()))) OR EXISTS (SELECT 1 FROM public.blog_posts b WHERE b.status='PUBLISHED' AND b.author_id::text=storage.objects.owner_id AND (b.cover_url=storage.objects.name OR b.attachment_path=storage.objects.name))));

CREATE OR REPLACE FUNCTION public.guard_accounting() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me uuid := auth.uid();
BEGIN
 IF me IS NULL THEN RETURN coalesce(NEW,OLD); END IF;
 IF TG_OP='INSERT' AND NEW.professional_id=me THEN RAISE EXCEPTION 'Une autre personne du Bureau doit enregistrer votre reversement.'; END IF;
 IF TG_OP='UPDATE' AND (OLD.professional_id=me OR NEW.professional_id=me) AND (NEW.professional_id IS DISTINCT FROM OLD.professional_id OR NEW.professional_share IS DISTINCT FROM OLD.professional_share OR NEW.gross_revenue IS DISTINCT FROM OLD.gross_revenue OR NEW.association_share IS DISTINCT FROM OLD.association_share OR NEW.professional_paid_at IS DISTINCT FROM OLD.professional_paid_at) THEN RAISE EXCEPTION 'Une autre personne du Bureau doit modifier votre reversement.'; END IF;
 INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,old_values,new_values) VALUES(me,'accounting.'||lower(TG_OP),'accounting',coalesce(NEW.id,OLD.id),CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END);
 RETURN coalesce(NEW,OLD);
END $$;
ALTER POLICY au_select_members ON public.association_updates USING (is_public OR (select public.is_active_member((select auth.uid()))) OR (select public.is_bureau((select auth.uid()))));
ALTER POLICY project_categories_read ON public.project_categories USING ((select public.is_active_member((select auth.uid()))) OR (select public.is_bureau((select auth.uid()))));
ALTER POLICY procat_read ON public.professional_categories USING (is_active);