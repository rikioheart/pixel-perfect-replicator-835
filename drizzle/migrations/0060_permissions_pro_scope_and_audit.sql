-- Droits « réservés aux pros validés » : un droit porté par un rôle peut exiger is_professional.
ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS requires_professional boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.role_permissions.requires_professional IS
  'Le droit ne s''applique qu''aux professionnels validés (is_professional). Ex. : droits pro du rôle Membre bienfaiteur.';

-- Le Bureau peut basculer ce réglage (lecture/insert/delete déjà couverts).
DROP POLICY IF EXISTS role_permissions_bureau_update ON public.role_permissions;
CREATE POLICY role_permissions_bureau_update ON public.role_permissions
  FOR UPDATE TO authenticated
  USING (public.is_bureau(auth.uid()))
  WITH CHECK (public.is_bureau(auth.uid()));

-- Source unique des droits : un droit « pro » n'est effectif que pour un pro validé.
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id
      AND p.code = _permission_code
      AND (NOT rp.requires_professional OR public.is_professional(_user_id))
  )
$function$;

-- Journal systématique de toute modification de la matrice, quelle que soit l'origine.
CREATE OR REPLACE FUNCTION public.audit_role_permission_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _row public.role_permissions;
  _role record;
  _perm record;
  _action text;
BEGIN
  _row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  SELECT code, name INTO _role FROM public.roles WHERE id = _row.role_id;
  SELECT code, name INTO _perm FROM public.permissions WHERE id = _row.permission_id;
  _action := CASE TG_OP
    WHEN 'INSERT' THEN 'PERMISSION_GRANTED'
    WHEN 'DELETE' THEN 'PERMISSION_REVOKED'
    ELSE 'PERMISSION_SCOPE_UPDATED' END;
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, old_values, new_values, metadata)
  VALUES (
    auth.uid(), _action, 'role_permission', _row.role_id,
    CASE WHEN TG_OP = 'INSERT' THEN NULL
      ELSE jsonb_build_object('requires_professional', OLD.requires_professional) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL
      ELSE jsonb_build_object('requires_professional', NEW.requires_professional) END,
    jsonb_build_object(
      'role', _role.code, 'role_name', _role.name,
      'permission', _perm.code, 'permission_name', _perm.name,
      'summary', concat_ws(' · ', coalesce(_role.name, 'Rôle'), coalesce(_perm.name, _perm.code))
    )
  );
  RETURN NULL;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.audit_role_permission_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_role_permissions_audit ON public.role_permissions;
CREATE TRIGGER trg_role_permissions_audit
  AFTER INSERT OR DELETE OR UPDATE OF requires_professional ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_role_permission_change();

-- Président, Secrétaire et Trésorier : un seul titulaire actif, garanti par la base.
CREATE UNIQUE INDEX IF NOT EXISTS member_functions_unique_office
  ON public.member_functions (function_type)
  WHERE active AND function_type IN ('PRESIDENT', 'SECRETARY', 'TREASURER');

-- Catégorie statutaire : doublon des rôles système, retirée de l'interface.
COMMENT ON COLUMN public.profiles.statutory_category IS
  'DEPRECATED: remplacée par les rôles système (Fondateur, Bienfaiteur, Apprenant, Soutien, Particulier).';