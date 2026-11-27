CREATE OR REPLACE FUNCTION public.guard_representative_consent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND auth.uid()<>NEW.id THEN RAISE EXCEPTION 'Seul l’adhérent peut donner ou retirer cet accord' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_representative_consent() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_representative_consent() TO service_role;
CREATE TRIGGER guard_representative_consent BEFORE UPDATE OF representative_contact_consent ON public.profiles FOR EACH ROW WHEN (OLD.representative_contact_consent IS DISTINCT FROM NEW.representative_contact_consent) EXECUTE FUNCTION public.guard_representative_consent();