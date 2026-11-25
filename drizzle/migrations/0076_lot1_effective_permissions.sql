CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT CASE
   WHEN EXISTS (SELECT 1 FROM public.user_permission_overrides o JOIN public.permissions p ON p.id = o.permission_id WHERE o.user_id = _user_id AND p.code = _permission_code AND o.effect = 'REVOKE') THEN false
   ELSE EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.role_permissions rp ON rp.role_id = ur.role_id JOIN public.permissions p ON p.id = rp.permission_id WHERE ur.user_id = _user_id AND p.code = _permission_code AND (NOT rp.requires_professional OR public.is_professional(_user_id)))
     OR (EXISTS (SELECT 1 FROM public.user_permission_overrides o JOIN public.permissions p ON p.id = o.permission_id WHERE o.user_id = _user_id AND p.code = _permission_code AND o.effect = 'GRANT')
       AND (public.is_professional(_user_id) OR NOT coalesce((SELECT bool_and(rp.requires_professional) FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id WHERE p.code = _permission_code), false)))
 END
$$;
REVOKE ALL ON FUNCTION public.has_permission(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.my_permission_codes()
RETURNS TABLE(code text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT p.code FROM public.permissions p WHERE auth.uid() IS NOT NULL AND public.has_permission(auth.uid(),p.code) ORDER BY p.code
$$;
REVOKE ALL ON FUNCTION public.my_permission_codes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_permission_codes() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_permission_override()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NOT NULL THEN
   IF NOT public.is_bureau(auth.uid()) THEN RAISE EXCEPTION 'Seul le Bureau peut modifier les droits individuels'; END IF;
   IF (TG_OP <> 'INSERT' AND OLD.user_id = auth.uid()) OR (TG_OP <> 'DELETE' AND NEW.user_id = auth.uid()) THEN RAISE EXCEPTION 'Vous ne pouvez pas modifier vos propres droits individuels'; END IF;
   IF TG_OP <> 'DELETE' THEN NEW.assigned_by := auth.uid(); END IF;
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_permission_override() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_permission_override() TO service_role;
CREATE TRIGGER guard_permission_override BEFORE INSERT OR UPDATE OR DELETE ON public.user_permission_overrides FOR EACH ROW EXECUTE FUNCTION public.guard_permission_override();

CREATE OR REPLACE FUNCTION public.audit_permission_override()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.user_permission_overrides;
BEGIN
 r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
 INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,old_values,new_values,metadata)
 VALUES(auth.uid(),'PERMISSION_OVERRIDE_' || TG_OP,'user_permission_override',r.id,
   CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE jsonb_build_object('user_id',OLD.user_id,'permission_id',OLD.permission_id,'effect',OLD.effect,'reason',OLD.reason) END,
   CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE jsonb_build_object('user_id',NEW.user_id,'permission_id',NEW.permission_id,'effect',NEW.effect,'reason',NEW.reason) END,
   jsonb_build_object('user_id',r.user_id));
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.audit_permission_override() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_permission_override() TO service_role;
CREATE TRIGGER audit_permission_override AFTER INSERT OR UPDATE OR DELETE ON public.user_permission_overrides FOR EACH ROW EXECUTE FUNCTION public.audit_permission_override();