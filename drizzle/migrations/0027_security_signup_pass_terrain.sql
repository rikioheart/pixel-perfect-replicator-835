-- 1. Remboursements : pas d'auto-validation, transitions contrôlées
CREATE OR REPLACE FUNCTION public.guard_reimbursement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_bureau(me) OR NEW.person_id = me THEN
      NEW.status := 'PENDING'; NEW.processed_by := NULL;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.processed_by IS DISTINCT FROM OLD.processed_by THEN
    IF NOT public.is_bureau(me) THEN
      RAISE EXCEPTION 'Seul le Bureau peut traiter une demande de remboursement';
    END IF;
    IF OLD.person_id = me THEN
      RAISE EXCEPTION 'Vous ne pouvez pas traiter votre propre demande de remboursement';
    END IF;
    IF NEW.status NOT IN ('PENDING','APPROVED','REJECTED','PAID') THEN
      RAISE EXCEPTION 'Statut de remboursement invalide';
    END IF;
    IF OLD.status = 'PAID' THEN RAISE EXCEPTION 'Une demande payée ne peut plus changer de statut'; END IF;
    IF NEW.status = 'PAID' AND OLD.status <> 'APPROVED' THEN RAISE EXCEPTION 'Une demande doit être approuvée avant d''être payée'; END IF;
    NEW.processed_by := me;
  ELSIF OLD.person_id = me AND OLD.status <> 'PENDING' AND NOT public.is_bureau(me) THEN
    RAISE EXCEPTION 'Une demande déjà traitée ne peut plus être modifiée';
  END IF;
  IF NEW.person_id IS DISTINCT FROM OLD.person_id AND NOT public.is_bureau(me) THEN
    RAISE EXCEPTION 'Le demandeur ne peut pas être changé';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_reimb_guard ON public.reimbursements;
CREATE TRIGGER trg_reimb_guard BEFORE INSERT OR UPDATE ON public.reimbursements FOR EACH ROW EXECUTE FUNCTION public.guard_reimbursement();
DROP POLICY IF EXISTS reimb_update ON public.reimbursements;
CREATE POLICY reimb_update ON public.reimbursements FOR UPDATE TO authenticated
  USING (public.is_bureau(auth.uid()) OR (person_id = auth.uid() AND status = 'PENDING'))
  WITH CHECK (public.is_bureau(auth.uid()) OR (person_id = auth.uid() AND status = 'PENDING'));
DROP POLICY IF EXISTS reimb_delete ON public.reimbursements;
CREATE POLICY reimb_delete ON public.reimbursements FOR DELETE TO authenticated
  USING ((public.is_bureau(auth.uid()) AND public.has_permission(auth.uid(),'finance.update')) OR (person_id = auth.uid() AND status = 'PENDING'));

-- 2. Adhésions : jamais d'auto-activation
DROP POLICY IF EXISTS memberships_insert_self ON public.memberships;
CREATE POLICY memberships_insert_self ON public.memberships FOR INSERT TO authenticated
  WITH CHECK (public.is_bureau(auth.uid()) OR (user_id = auth.uid() AND status = 'PENDING' AND validated_by IS NULL));

-- 3. Premier Bureau : plus de revendication par un utilisateur ordinaire
REVOKE EXECUTE ON FUNCTION public.claim_bureau_bootstrap() FROM PUBLIC, anon, authenticated;

-- 4. Profils : e-mail et téléphone non lisibles par l'API, sauf soi-même ou le Bureau via fonction
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, first_name, last_name, display_name, avatar_path, city, department, membership_type,
  membership_status, membership_date, involvement_level, bio, public_visibility, created_at, updated_at,
  access_level, person_id, hide_sensitive_dogs, statutory_category) ON public.profiles TO authenticated;
CREATE OR REPLACE FUNCTION public.profile_contacts(_ids uuid[])
RETURNS TABLE(id uuid, email text, phone text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.email, p.phone FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND p.id = ANY(_ids)
    AND (p.id = auth.uid() OR public.is_bureau(auth.uid()))
$$;
REVOKE EXECUTE ON FUNCTION public.profile_contacts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_contacts(uuid[]) TO authenticated;

-- 5. Rattachement personne : uniquement si l'e-mail du compte est confirmé
CREATE OR REPLACE FUNCTION public.profile_link_person()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid; confirmed boolean;
BEGIN
  IF NEW.person_id IS NOT NULL AND (auth.uid() IS NULL OR public.is_bureau(auth.uid())) THEN RETURN NEW; END IF;
  NEW.person_id := NULL;
  SELECT u.email_confirmed_at IS NOT NULL AND lower(u.email) = lower(coalesce(NEW.email,'')) INTO confirmed
    FROM auth.users u WHERE u.id = NEW.id;
  IF coalesce(confirmed,false) THEN
    SELECT p.id INTO pid FROM public.people p
    WHERE lower(p.email) = lower(NEW.email)
      AND NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.person_id = p.id)
    ORDER BY p.created_at LIMIT 1;
  END IF;
  IF pid IS NULL THEN
    INSERT INTO public.people (first_name, last_name, display_name, email, phone, city, department, created_by)
    VALUES (NEW.first_name, NEW.last_name, NEW.display_name, NEW.email, NEW.phone, NEW.city, NEW.department, NEW.id)
    RETURNING id INTO pid;
  END IF;
  NEW.person_id := pid;
  RETURN NEW;
END $$;

-- 6. Création du profil à l'inscription (même si l'e-mail doit être confirmé)
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb); f text; l text; t text;
BEGIN
  f := nullif(trim(coalesce(meta->>'first_name', meta->>'given_name', '')), '');
  l := nullif(trim(coalesce(meta->>'last_name', meta->>'family_name', '')), '');
  t := CASE WHEN meta->>'membership_type' = 'PROFESSIONNEL' THEN 'PROFESSIONNEL' ELSE 'PARTICULIER' END;
  INSERT INTO public.profiles (id, first_name, last_name, display_name, email, membership_type, membership_status, statutory_category)
  VALUES (NEW.id, f, l, nullif(trim(concat_ws(' ', f, l)), ''), NEW.email, t, 'PENDING', 'ACTIF')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;

-- 7. File d'adhésions : notification unique du Bureau
CREATE OR REPLACE FUNCTION public.notify_pending_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b record; who text;
BEGIN
  IF NEW.membership_status <> 'PENDING' THEN RETURN NEW; END IF;
  who := coalesce(nullif(NEW.display_name,''), 'Une nouvelle personne');
  FOR b IN SELECT DISTINCT ur.user_id FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE r.code = 'ADMIN_BUREAU' LOOP
    PERFORM public.notify_once(b.user_id, 'MEMBER_PENDING', 'Nouvelle adhésion à valider',
      who || ' demande à rejoindre l''espace membre (' || lower(NEW.membership_type) || ').', 'profile', NEW.id, '/admin');
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_profiles_notify_pending ON public.profiles;
CREATE TRIGGER trg_profiles_notify_pending AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.notify_pending_member();
REVOKE EXECUTE ON FUNCTION public.notify_pending_member(), public.guard_reimbursement() FROM PUBLIC, anon, authenticated;

-- 8. Cartes de fidélité : plus de lecture globale par les pros, résolution ciblée du QR
DROP POLICY IF EXISTS loyalty_cards_select ON public.loyalty_cards;
CREATE POLICY loyalty_cards_select ON public.loyalty_cards FOR SELECT TO authenticated
  USING (member_id = auth.uid() OR public.is_bureau(auth.uid()));

CREATE OR REPLACE FUNCTION public.resolve_member_from_qr(_scanned_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); code text; n int; rec record;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF NOT (public.is_professional(me) OR public.is_bureau(me)) THEN RAISE EXCEPTION 'Réservé aux professionnels validés et au Bureau'; END IF;
  code := lower(regexp_replace(coalesce(_scanned_code,''), '[^0-9a-fA-F]', '', 'g'));
  IF length(code) < 8 THEN RETURN jsonb_build_object('found', false, 'reason', 'INVALID'); END IF;
  IF length(code) = 32 THEN
    SELECT count(*) INTO n FROM public.loyalty_cards c WHERE replace(c.qr_code,'-','') = code;
  ELSE
    code := left(code, 8);
    SELECT count(*) INTO n FROM public.loyalty_cards c WHERE left(replace(c.qr_code,'-',''),8) = code;
  END IF;
  IF n = 0 THEN RETURN jsonb_build_object('found', false, 'reason', 'NOT_FOUND'); END IF;
  IF n > 1 THEN RETURN jsonb_build_object('found', false, 'reason', 'AMBIGUOUS'); END IF;
  SELECT c.member_id, c.total_stamps, p.membership_type, p.membership_status,
         coalesce(nullif(p.display_name,''), trim(concat(p.first_name,' ',left(coalesce(p.last_name,''),1)))) AS name
    INTO rec
    FROM public.loyalty_cards c JOIN public.profiles p ON p.id = c.member_id
    WHERE (length(code) = 32 AND replace(c.qr_code,'-','') = code) OR (length(code) = 8 AND left(replace(c.qr_code,'-',''),8) = code)
    LIMIT 1;
  IF rec.member_id IS NULL THEN RETURN jsonb_build_object('found', false, 'reason', 'NOT_FOUND'); END IF;
  RETURN jsonb_build_object('found', true, 'member_id', rec.member_id, 'display_name', rec.name,
    'membership_type', rec.membership_type, 'membership_status', rec.membership_status, 'total_stamps', rec.total_stamps);
END $$;
REVOKE EXECUTE ON FUNCTION public.resolve_member_from_qr(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_member_from_qr(text) TO authenticated;