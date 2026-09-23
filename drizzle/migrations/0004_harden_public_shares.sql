-- Fonction de contrôle : qui a le droit de créer un lien de partage externe
CREATE OR REPLACE FUNCTION public.can_share_entity(_user_id uuid, _entity_type text, _entity_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_vis text;
  v_owner uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF public.is_bureau(_user_id) THEN RETURN true; END IF;

  IF _entity_type = 'document' THEN
    SELECT d.visibility, d.uploaded_by INTO v_vis, v_owner FROM public.documents d WHERE d.id = _entity_id;
    IF v_vis IS NULL THEN RETURN false; END IF;
    -- un document réservé au Bureau ne peut jamais être partagé à l'extérieur par un membre
    IF upper(v_vis) = 'BUREAU' THEN RETURN false; END IF;
    RETURN v_owner = _user_id;
  END IF;

  IF _entity_type = 'project' THEN
    SELECT p.owner_id INTO v_owner FROM public.projects p WHERE p.id = _entity_id;
    IF v_owner IS NULL THEN RETURN false; END IF;
    RETURN v_owner = _user_id;
  END IF;

  IF _entity_type = 'event' THEN
    SELECT e.visibility, e.created_by INTO v_vis, v_owner FROM public.events e WHERE e.id = _entity_id;
    IF v_owner IS NULL THEN RETURN false; END IF;
    RETURN v_owner = _user_id;
  END IF;

  RETURN false;
END;
$$;

-- Les jetons de partage ne doivent pas être lisibles par toute personne connectée
DROP POLICY IF EXISTS public_shares_select ON public.public_shares;
CREATE POLICY public_shares_select ON public.public_shares
  FOR SELECT TO authenticated
  USING (public.is_bureau(auth.uid()) OR created_by = auth.uid());

-- La création d'un lien externe est conditionnée aux droits sur l'objet partagé
DROP POLICY IF EXISTS public_shares_insert ON public.public_shares;
CREATE POLICY public_shares_insert ON public.public_shares
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.can_share_entity(auth.uid(), entity_type, entity_id)
  );
