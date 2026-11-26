ALTER TABLE public.profiles ADD COLUMN representative_contact_consent boolean NOT NULL DEFAULT false;
GRANT SELECT(representative_contact_consent), UPDATE(representative_contact_consent) ON public.profiles TO authenticated;
ALTER TABLE public.pro_details ADD COLUMN pro_status text NOT NULL DEFAULT 'PENDING' CHECK (pro_status IN ('PENDING','VALIDATED','SUSPENDED','REFUSED'));
ALTER TABLE public.pro_details ADD COLUMN pro_review_note text;
UPDATE public.pro_details d SET pro_status='VALIDATED' FROM public.profiles p WHERE p.id=d.profile_id AND p.membership_type='PROFESSIONNEL' AND p.membership_status='ACTIVE';

CREATE OR REPLACE FUNCTION public.is_professional(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p JOIN public.pro_details d ON d.profile_id=p.id WHERE p.id=_user_id AND p.deleted_at IS NULL AND p.membership_status='ACTIVE' AND d.pro_status='VALIDATED')
$$;
REVOKE ALL ON FUNCTION public.is_professional(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_professional(uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.guard_pro_details()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me uuid:=auth.uid();
BEGIN
 IF me IS NULL THEN RETURN NEW; END IF;
 IF public.is_bureau(me) THEN
   IF NEW.profile_id=me AND ((TG_OP='INSERT' AND NEW.pro_status<>'PENDING') OR (TG_OP='UPDATE' AND NEW.pro_status IS DISTINCT FROM OLD.pro_status)) THEN RAISE EXCEPTION 'Un autre membre du Bureau doit valider votre qualité professionnelle' USING ERRCODE='42501'; END IF;
   RETURN NEW;
 END IF;
 IF TG_OP='INSERT' THEN
   IF NEW.profile_id IS DISTINCT FROM me OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=me AND deleted_at IS NULL AND (membership_status='ACTIVE' OR membership_type='PROFESSIONNEL')) THEN RAISE EXCEPTION 'Une adhésion active est nécessaire pour demander la qualité professionnelle' USING ERRCODE='42501'; END IF;
   IF NEW.pro_status<>'PENDING' OR NEW.pro_review_note IS NOT NULL OR coalesce(NEW.can_grant_stamps,false) OR coalesce(NEW.partnership_percentage,0)<>0 OR NEW.contract_url IS NOT NULL THEN RAISE EXCEPTION 'La validation et les réglages de partenariat sont réservés au Bureau' USING ERRCODE='42501'; END IF;
 ELSE
   IF NEW.profile_id IS DISTINCT FROM OLD.profile_id OR NEW.profile_id IS DISTINCT FROM me OR NEW.pro_status IS DISTINCT FROM OLD.pro_status OR NEW.pro_review_note IS DISTINCT FROM OLD.pro_review_note OR NEW.can_grant_stamps IS DISTINCT FROM OLD.can_grant_stamps OR NEW.partnership_percentage IS DISTINCT FROM OLD.partnership_percentage OR NEW.contract_url IS DISTINCT FROM OLD.contract_url THEN RAISE EXCEPTION 'Ce réglage est réservé au Bureau' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.decide_professional_quality(_profile_id uuid,_status text,_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE role_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_bureau(auth.uid()) THEN RAISE EXCEPTION 'Décision réservée au Bureau' USING ERRCODE='42501'; END IF;
 IF _profile_id=auth.uid() THEN RAISE EXCEPTION 'Un autre membre du Bureau doit prendre cette décision' USING ERRCODE='42501'; END IF;
 IF _status NOT IN ('VALIDATED','SUSPENDED','REFUSED') THEN RAISE EXCEPTION 'Décision inconnue'; END IF;
 IF _status<>'VALIDATED' AND length(trim(coalesce(_note,'')))<5 THEN RAISE EXCEPTION 'Ajoutez un motif à votre décision'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=_profile_id AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Profil introuvable'; END IF;
 IF _status='VALIDATED' AND NOT public.is_active_member(_profile_id) THEN RAISE EXCEPTION 'Validez d’abord l’adhésion'; END IF;
 UPDATE public.pro_details SET pro_status=_status,pro_review_note=nullif(trim(_note),'') WHERE profile_id=_profile_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Demande professionnelle introuvable'; END IF;
 IF _status='VALIDATED' THEN
   SELECT r.id INTO role_id FROM public.roles r WHERE r.code='MEMBRE_BIENFAITEUR';
   IF role_id IS NULL THEN RAISE EXCEPTION 'Rôle bienfaiteur introuvable'; END IF;
   INSERT INTO public.user_roles(user_id,role_id) VALUES(_profile_id,role_id) ON CONFLICT DO NOTHING;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.decide_professional_quality(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.decide_professional_quality(uuid,text,text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.audit_professional_quality()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.pro_status IS DISTINCT FROM OLD.pro_status THEN
   INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,old_values,new_values)
   VALUES(auth.uid(),'PRO_QUALITY_'||NEW.pro_status,'professional_quality',NEW.profile_id,
     CASE WHEN TG_OP='INSERT' THEN NULL ELSE jsonb_build_object('status',OLD.pro_status) END,
     jsonb_build_object('status',NEW.pro_status,'note',NEW.pro_review_note));
   IF NEW.pro_status='PENDING' THEN
     PERFORM public.notify_bureau_members(auth.uid(),'PRO_QUALITY_PENDING','Une qualité professionnelle à valider','Une personne souhaite rejoindre les professionnels de l’association.','professional_quality',NEW.profile_id,'/admin/pros');
   ELSE
     PERFORM public.notify_member(NEW.profile_id,auth.uid(),'PRO_QUALITY_DECISION',CASE WHEN NEW.pro_status='VALIDATED' THEN 'Votre qualité professionnelle est validée' ELSE 'Votre demande professionnelle a été examinée' END,coalesce(NEW.pro_review_note,'Vous pouvez retrouver votre espace professionnel.'),'professional_quality',NEW.profile_id,'/profile',interval '0 seconds');
   END IF;
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.audit_professional_quality() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.audit_professional_quality() TO service_role;
CREATE TRIGGER audit_professional_quality AFTER INSERT OR UPDATE ON public.pro_details FOR EACH ROW EXECUTE FUNCTION public.audit_professional_quality();

CREATE OR REPLACE FUNCTION public.can_view_representative_contacts(_viewer uuid,_member uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=_member AND p.deleted_at IS NULL AND p.membership_status='ACTIVE' AND p.representative_contact_consent AND public.is_active_member(_viewer)
 AND ((p.membership_type='PARTICULIER' OR public.has_role(p.id,'PARTICULIER')) AND (public.has_role(_viewer,'REPRESENTANT_PARTICULIERS') OR EXISTS(SELECT 1 FROM public.member_functions f WHERE f.user_id=_viewer AND f.function_type='REPRESENTANT_PARTICULIER' AND f.scope_type='ASSOCIATION' AND f.active AND f.start_date<=CURRENT_DATE AND (f.end_date IS NULL OR f.end_date>=CURRENT_DATE)))
 OR public.is_professional(p.id) AND EXISTS(SELECT 1 FROM public.member_functions f WHERE f.user_id=_viewer AND f.function_type='REPRESENTANT_PRO' AND f.scope_type='ASSOCIATION' AND f.active AND f.start_date<=CURRENT_DATE AND (f.end_date IS NULL OR f.end_date>=CURRENT_DATE))))
$$;
REVOKE ALL ON FUNCTION public.can_view_representative_contacts(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_view_representative_contacts(uuid,uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.profile_contacts(_ids uuid[])
RETURNS TABLE(id uuid,email text,phone text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p.id,p.email,p.phone FROM public.profiles p WHERE auth.uid() IS NOT NULL AND p.id=ANY(_ids)
 AND (p.id=auth.uid() OR public.is_bureau(auth.uid()) OR public.can_view_representative_contacts(auth.uid(),p.id))
$$;
CREATE OR REPLACE FUNCTION public.audit_representative_consent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,old_values,new_values)
 VALUES(auth.uid(),'REPRESENTATIVE_CONTACT_CONSENT','profile',NEW.id,jsonb_build_object('consent',OLD.representative_contact_consent),jsonb_build_object('consent',NEW.representative_contact_consent));
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.audit_representative_consent() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.audit_representative_consent() TO service_role;
CREATE TRIGGER audit_representative_consent AFTER UPDATE OF representative_contact_consent ON public.profiles FOR EACH ROW WHEN (OLD.representative_contact_consent IS DISTINCT FROM NEW.representative_contact_consent) EXECUTE FUNCTION public.audit_representative_consent();

CREATE OR REPLACE FUNCTION public.directory_profiles(_ids uuid[] DEFAULT NULL,_as_member boolean DEFAULT false)
RETURNS TABLE(id uuid,display_name text,first_name text,last_name text,avatar_path text,membership_type text,membership_status text,public_visibility boolean,city text,department text,bio text,skills text[],availability text[],collaboration_modes text[],contribution_types text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _me uuid:=auth.uid();_full boolean;
BEGIN
 IF _me IS NULL THEN RETURN; END IF;
 _full:=public.is_bureau(_me) AND NOT coalesce(_as_member,false);
 RETURN QUERY SELECT p.id,p.display_name,p.first_name,p.last_name,p.avatar_path,p.membership_type,p.membership_status,p.public_visibility,
 CASE WHEN _full OR p.location_visibility='MEMBERS' THEN p.city END,CASE WHEN _full OR p.location_visibility='MEMBERS' THEN p.department END,CASE WHEN _full OR p.bio_visibility='MEMBERS' THEN p.bio END,
 CASE WHEN _full OR p.skills_visibility='MEMBERS' THEN p.skills ELSE '{}'::text[] END,CASE WHEN _full OR p.availability_visibility='MEMBERS' THEN p.availability ELSE '{}'::text[] END,
 CASE WHEN _full OR p.availability_visibility='MEMBERS' THEN p.collaboration_modes ELSE '{}'::text[] END,CASE WHEN _full OR p.availability_visibility='MEMBERS' THEN p.contribution_types ELSE '{}'::text[] END
 FROM public.profiles p WHERE p.deleted_at IS NULL AND p.membership_status='ACTIVE' AND (p.public_visibility OR _full OR (NOT coalesce(_as_member,false) AND public.can_view_representative_contacts(_me,p.id))) AND (_ids IS NULL OR p.id=ANY(_ids)) ORDER BY p.display_name NULLS LAST,p.first_name;
END $$;
CREATE OR REPLACE FUNCTION public.directory_pro_details()
RETURNS TABLE(profile_id uuid,company_name text,professional_category text,website_url text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT d.profile_id,d.company_name,d.professional_category,d.website_url FROM public.pro_details d JOIN public.profiles p ON p.id=d.profile_id WHERE auth.uid() IS NOT NULL AND public.is_professional(p.id) AND (public.is_bureau(auth.uid()) OR p.id=auth.uid() OR (public.is_active_member(auth.uid()) AND p.public_visibility) OR public.can_view_representative_contacts(auth.uid(),p.id))
$$;
REVOKE ALL ON FUNCTION public.directory_pro_details() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.directory_pro_details() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.picker_people()
RETURNS TABLE(id uuid,name text,company text,qualities text[]) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p.id,coalesce(nullif(trim(p.display_name),''),nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),'Membre'),CASE WHEN public.is_professional(p.id) THEN d.company_name END,
 array_remove(ARRAY[CASE WHEN public.has_role(p.id,'ADMIN_BUREAU') THEN 'BUREAU' END,CASE WHEN public.is_professional(p.id) THEN 'PRO' END,CASE WHEN p.membership_type='PARTICULIER' OR public.has_role(p.id,'PARTICULIER') THEN 'PARTICULIER' END,CASE WHEN p.membership_type='BENEVOLE' OR EXISTS(SELECT 1 FROM public.member_functions f WHERE f.user_id=p.id AND f.active AND f.function_type='VOLUNTEER') THEN 'BENEVOLE' END,CASE WHEN public.has_role(p.id,'REPRESENTANT_PARTICULIERS') OR EXISTS(SELECT 1 FROM public.member_functions f WHERE f.user_id=p.id AND f.active AND f.function_type IN('REPRESENTANT_PRO','REPRESENTANT_PARTICULIER')) THEN 'REPRESENTANT' END,CASE WHEN p.membership_type='PARTENAIRE' THEN 'PARTENAIRE' END],NULL)
 FROM public.profiles p LEFT JOIN public.pro_details d ON d.profile_id=p.id WHERE auth.uid() IS NOT NULL AND p.deleted_at IS NULL AND p.membership_status='ACTIVE' AND (public.is_bureau(auth.uid()) OR (public.is_active_member(auth.uid()) AND (p.public_visibility OR p.id=auth.uid()))) ORDER BY 2
$$;
COMMENT ON COLUMN public.profiles.membership_type IS 'Adhésion, indépendante de la qualité professionnelle validée dans pro_details.pro_status';