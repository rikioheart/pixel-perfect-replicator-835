ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_context_type_chk;
ALTER TABLE public.documents ADD CONSTRAINT documents_context_type_chk CHECK (context_type IS NULL OR context_type IN ('ASSOCIATION','PERSON','HOUSEHOLD','DOG','PROFESSIONAL','PROJECT','ACTIVITY','EVENT','RESERVATION','TASK','FORMATION','MEETING'));
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS service text;
COMMENT ON COLUMN public.documents.service IS 'Service externe reconnu depuis l''URL (indicatif, jamais une autorisation)';

-- Peut-on ajouter une ressource à ce contexte ? (lecture du contexte requise, SENSIBLE réservé au Bureau)
CREATE OR REPLACE FUNCTION public.can_add_context_resource(_user_id uuid, _type text, _id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.is_bureau(_user_id) THEN true
    WHEN _type = 'PROJECT' THEN public.is_project_member(_user_id,_id) OR public.is_project_coordinator(_user_id,_id)
    WHEN _type = 'TASK' THEN EXISTS (SELECT 1 FROM tasks t WHERE t.id=_id AND (t.assigned_user_id=_user_id OR t.created_by=_user_id OR (t.project_id IS NOT NULL AND public.is_project_coordinator(_user_id,t.project_id))))
    WHEN _type = 'ACTIVITY' THEN EXISTS (SELECT 1 FROM activities a WHERE a.id=_id AND (a.created_by=_user_id OR a.professional_id=_user_id OR a.referent_id=_user_id OR _user_id = ANY(coalesce(a.professional_ids,'{}'))))
    WHEN _type = 'EVENT' THEN EXISTS (SELECT 1 FROM events e WHERE e.id=_id AND (e.created_by=_user_id OR e.professional_id=_user_id OR e.referent_id=_user_id OR _user_id = ANY(coalesce(e.professional_ids,'{}'))))
    WHEN _type = 'RESERVATION' THEN public.can_manage_terrain_reservation(_user_id,_id)
    WHEN _type = 'FORMATION' THEN EXISTS (SELECT 1 FROM formations f WHERE f.id=_id AND f.created_by=_user_id)
    ELSE false END
$$;
REVOKE ALL ON FUNCTION public.can_add_context_resource(uuid,text,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_add_context_resource(uuid,text,uuid) TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
CREATE POLICY documents_context_insert ON public.documents FOR INSERT TO authenticated WITH CHECK (
  uploaded_by = auth.uid()
  AND sensitivity <> 'SENSIBLE' AND upper(coalesce(visibility,'')) <> 'BUREAU'
  AND context_type IS NOT NULL AND context_id IS NOT NULL
  AND public.can_add_context_resource(auth.uid(), context_type, context_id));
CREATE POLICY documents_own_delete ON public.documents FOR DELETE TO authenticated USING (uploaded_by = auth.uid());