SET check_function_bodies = off;

ALTER TABLE public.member_functions
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'ASSOCIATION',
  ADD COLUMN IF NOT EXISTS scope_id uuid;
ALTER TABLE public.member_functions ADD CONSTRAINT member_functions_scope_chk
  CHECK (scope_type IN ('ASSOCIATION','PROJECT','ACTIVITY','TERRAIN') AND (scope_type = 'ASSOCIATION' OR scope_id IS NOT NULL));
UPDATE public.member_functions mf SET person_id = p.person_id FROM public.profiles p WHERE p.id = mf.user_id AND mf.person_id IS NULL;

-- Lecture des fonctions : Bureau, la personne concernée, ou membres pour les fonctions ASSOCIATION actives
DROP POLICY IF EXISTS member_functions_select ON public.member_functions;
CREATE POLICY member_functions_select ON public.member_functions FOR SELECT TO authenticated
  USING (public.is_bureau(auth.uid()) OR user_id = auth.uid() OR (active AND scope_type = 'ASSOCIATION'));

CREATE OR REPLACE FUNCTION public.is_project_coordinator(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = _project_id
    AND pm.user_id = _user_id AND upper(coalesce(pm.project_role,'')) IN ('OWNER','COORDINATOR'))
  OR EXISTS (SELECT 1 FROM public.member_functions mf WHERE mf.user_id = _user_id AND mf.active
    AND mf.scope_type = 'PROJECT' AND mf.scope_id = _project_id AND upper(mf.function_type) IN ('COORDINATOR','COORDINATEUR')
    AND (mf.end_date IS NULL OR mf.end_date >= current_date))
$$;

CREATE TABLE public.delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delegate_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_code text NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('PROJECT','ACTIVITY','TERRAIN','EVENT')),
  scope_id uuid NOT NULL,
  reason text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (delegator_id <> delegate_id),
  CHECK (ends_at > starts_at)
);
GRANT SELECT ON public.delegations TO authenticated;
GRANT ALL ON public.delegations TO service_role;
ALTER TABLE public.delegations ENABLE ROW LEVEL SECURITY;
CREATE POLICY delegations_select ON public.delegations FOR SELECT TO authenticated
  USING (public.is_bureau(auth.uid()) OR delegator_id = auth.uid() OR delegate_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_scoped_permission(_user_id uuid, _code text, _scope_type text, _scope_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_permission(_user_id, _code)
    OR (_scope_type = 'PROJECT' AND public.is_project_coordinator(_user_id, _scope_id)
        AND split_part(_code,'.',1) IN ('projects','tasks','terrain','documents'))
    OR EXISTS (SELECT 1 FROM public.delegations d WHERE d.delegate_id = _user_id AND d.permission_code = _code
        AND d.scope_type = _scope_type AND d.scope_id = _scope_id AND d.revoked_at IS NULL
        AND now() BETWEEN d.starts_at AND d.ends_at)
$$;

CREATE OR REPLACE FUNCTION public.create_delegation(_delegate uuid, _code text, _scope_type text, _scope_id uuid, _reason text, _ends_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid; _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF coalesce(trim(_reason),'') = '' THEN RAISE EXCEPTION 'Motif obligatoire'; END IF;
  IF _ends_at IS NULL OR _ends_at <= now() OR _ends_at > now() + interval '365 days' THEN
    RAISE EXCEPTION 'Date de fin obligatoire, dans les 365 jours'; END IF;
  -- On ne délègue que ce qu'on possède soi-même (hors délégation reçue : pas de re-délégation)
  IF NOT (public.has_permission(_me, _code)
     OR (_scope_type = 'PROJECT' AND public.is_project_coordinator(_me, _scope_id) AND split_part(_code,'.',1) IN ('projects','tasks','terrain','documents'))) THEN
    RAISE EXCEPTION 'Vous ne pouvez déléguer qu''une permission que vous possédez sur ce périmètre'; END IF;
  INSERT INTO public.delegations(delegator_id, delegate_id, permission_code, scope_type, scope_id, reason, ends_at)
  VALUES (_me, _delegate, _code, _scope_type, _scope_id, trim(_reason), _ends_at) RETURNING id INTO _id;
  INSERT INTO public.audit_logs(user_id, action, entity_type, entity_id, new_values)
  VALUES (_me, 'DELEGATION_CREATE', 'delegation', _id, jsonb_build_object('delegate', _delegate, 'code', _code, 'scope', _scope_type, 'scope_id', _scope_id, 'ends_at', _ends_at));
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.revoke_delegation(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid();
BEGIN
  UPDATE public.delegations SET revoked_at = now(), revoked_by = _me
   WHERE id = _id AND revoked_at IS NULL AND (delegator_id = _me OR public.is_bureau(_me));
  IF NOT FOUND THEN RAISE EXCEPTION 'Délégation introuvable ou non autorisée'; END IF;
  INSERT INTO public.audit_logs(user_id, action, entity_type, entity_id) VALUES (_me, 'DELEGATION_REVOKE', 'delegation', _id);
END $$;

REVOKE EXECUTE ON FUNCTION public.create_delegation(uuid,text,text,uuid,text,timestamptz) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.revoke_delegation(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_delegation(uuid,text,text,uuid,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_delegation(uuid) TO authenticated;

-- Tâches : le coordinateur gère les tâches de son projet uniquement
DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated
  USING (public.is_bureau(auth.uid()) OR assigned_user_id = auth.uid() OR created_by = auth.uid()
    OR (project_id IS NOT NULL AND public.is_project_coordinator(auth.uid(), project_id)))
  WITH CHECK (public.is_bureau(auth.uid()) OR assigned_user_id = auth.uid() OR created_by = auth.uid()
    OR (project_id IS NOT NULL AND public.is_project_coordinator(auth.uid(), project_id)));
DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO authenticated
  USING (public.is_bureau(auth.uid()) OR (project_id IS NOT NULL AND public.is_project_coordinator(auth.uid(), project_id)));