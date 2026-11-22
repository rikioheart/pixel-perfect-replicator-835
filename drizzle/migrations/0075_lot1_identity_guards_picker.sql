-- 1. Fiche pro : réservée aux adhésions professionnelles ; réglages sensibles au Bureau.
CREATE OR REPLACE FUNCTION public.guard_pro_details()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL OR public.is_bureau(me) THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.profile_id IS DISTINCT FROM me OR NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = me AND membership_type = 'PROFESSIONNEL') THEN
      RAISE EXCEPTION 'La fiche professionnelle est réservée aux adhésions professionnelles.' USING ERRCODE = '42501';
    END IF;
    IF coalesce(NEW.can_grant_stamps, false) OR coalesce(NEW.partnership_percentage, 0) <> 0 OR NEW.contract_url IS NOT NULL THEN
      RAISE EXCEPTION 'Ce réglage est réservé au Bureau.' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NEW.profile_id IS DISTINCT FROM OLD.profile_id
      OR NEW.can_grant_stamps IS DISTINCT FROM OLD.can_grant_stamps
      OR NEW.partnership_percentage IS DISTINCT FROM OLD.partnership_percentage
      OR NEW.contract_url IS DISTINCT FROM OLD.contract_url THEN
      RAISE EXCEPTION 'Ce réglage est réservé au Bureau.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_pro_details() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_pro_details_guard ON public.pro_details;
CREATE TRIGGER trg_pro_details_guard BEFORE INSERT OR UPDATE ON public.pro_details
  FOR EACH ROW EXECUTE FUNCTION public.guard_pro_details();

-- 2. Rôles : pas d'auto-attribution, pas d'auto-retrait du rôle Bureau, dernier Bureau protégé.
CREATE OR REPLACE FUNCTION public.guard_user_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); admin_id uuid; n int;
BEGIN
  IF me IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT id INTO admin_id FROM public.roles WHERE code = 'ADMIN_BUREAU';
  PERFORM 1 FROM public.roles WHERE id = admin_id FOR UPDATE;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.user_id = me
     AND (TG_OP = 'INSERT' OR OLD.user_id <> NEW.user_id OR OLD.role_id <> NEW.role_id)
     AND EXISTS (SELECT 1 FROM public.user_roles WHERE role_id = admin_id) THEN
    RAISE EXCEPTION 'Un rôle ne peut pas être attribué à soi-même : demandez à un autre membre du Bureau.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP IN ('DELETE', 'UPDATE') AND OLD.role_id = admin_id
     AND (TG_OP = 'DELETE' OR NEW.role_id <> admin_id OR NEW.user_id <> OLD.user_id) THEN
    IF OLD.user_id = me THEN
      RAISE EXCEPTION 'Vous ne pouvez pas retirer votre propre rôle Bureau.' USING ERRCODE = '42501';
    END IF;
    SELECT count(*) INTO n FROM public.user_roles WHERE role_id = admin_id;
    IF n <= 1 THEN
      RAISE EXCEPTION 'C''est le dernier membre du Bureau : son rôle Bureau doit être conservé.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_user_roles() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_user_roles_guard ON public.user_roles;
CREATE TRIGGER trg_user_roles_guard BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_roles();

-- 3. Sélecteur de membres multi-qualités (adhérents actifs, visibilité inchangée).
CREATE OR REPLACE FUNCTION public.picker_people()
RETURNS TABLE(id uuid, name text, company text, qualities text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id,
    coalesce(nullif(trim(p.display_name), ''), nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Membre'),
    CASE WHEN p.membership_type = 'PROFESSIONNEL' THEN pd.company_name END,
    array_remove(ARRAY[
      CASE WHEN public.has_role(p.id, 'ADMIN_BUREAU') THEN 'BUREAU' END,
      CASE WHEN p.membership_type = 'PROFESSIONNEL' THEN 'PRO' END,
      CASE WHEN p.membership_type = 'PARTICULIER' OR public.has_role(p.id, 'PARTICULIER') THEN 'PARTICULIER' END,
      CASE WHEN p.membership_type = 'BENEVOLE' OR EXISTS (SELECT 1 FROM public.member_functions f
        WHERE f.user_id = p.id AND f.active AND f.function_type = 'VOLUNTEER') THEN 'BENEVOLE' END,
      CASE WHEN public.has_role(p.id, 'REPRESENTANT_PARTICULIERS') OR EXISTS (SELECT 1 FROM public.member_functions f
        WHERE f.user_id = p.id AND f.active AND f.function_type IN ('REPRESENTANT_PRO', 'REPRESENTANT_PARTICULIER')) THEN 'REPRESENTANT' END,
      CASE WHEN p.membership_type = 'PARTENAIRE' THEN 'PARTENAIRE' END
    ], NULL)
  FROM public.profiles p
  LEFT JOIN public.pro_details pd ON pd.profile_id = p.id
  WHERE auth.uid() IS NOT NULL
    AND p.deleted_at IS NULL AND p.membership_status = 'ACTIVE'
    AND (public.is_bureau(auth.uid())
      OR (public.is_active_member(auth.uid()) AND (p.public_visibility OR p.id = auth.uid())))
  ORDER BY 2
$$;
REVOKE EXECUTE ON FUNCTION public.picker_people() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.picker_people() TO authenticated;

-- 4. Contacts sans compte : type et structure (facultatifs).
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS contact_type text;
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS organization text;
ALTER TABLE public.people DROP CONSTRAINT IF EXISTS people_contact_type_check;
ALTER TABLE public.people ADD CONSTRAINT people_contact_type_check
  CHECK (contact_type IS NULL OR contact_type IN ('PARTICULIER', 'PROFESSIONNEL'));