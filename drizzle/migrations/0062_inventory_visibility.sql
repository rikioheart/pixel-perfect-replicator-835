ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'BUREAU';
ALTER TABLE public.inventory
  ADD CONSTRAINT inventory_visibility_check CHECK (visibility IN ('BUREAU', 'PROS', 'MEMBERS'));
COMMENT ON COLUMN public.inventory.visibility IS
  'BUREAU = privé Bureau ; PROS = Bureau + professionnels validés (membres bienfaiteurs) ; MEMBERS = tous les adhérents actifs.';
-- Les fiches existantes étaient lisibles par tous les connectés : on garde ce comportement.
UPDATE public.inventory SET visibility = 'MEMBERS';

CREATE OR REPLACE FUNCTION public.can_see_inventory(_user_id uuid, _visibility text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_bureau(_user_id)
    OR (_visibility = 'MEMBERS' AND public.is_active_member(_user_id))
    OR (_visibility IN ('PROS', 'MEMBERS') AND public.is_professional(_user_id))
$function$;
REVOKE EXECUTE ON FUNCTION public.can_see_inventory(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_inventory(uuid, text) TO authenticated, service_role;

DROP POLICY IF EXISTS inventory_select ON public.inventory;
CREATE POLICY inventory_select ON public.inventory
  FOR SELECT TO authenticated
  USING (public.can_see_inventory(auth.uid(), visibility));

-- Un coordinateur ne réserve que du matériel qu'il peut voir.
DROP POLICY IF EXISTS inv_resv_insert ON public.inventory_reservations;
CREATE POLICY inv_resv_insert ON public.inventory_reservations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_bureau(auth.uid())
    OR (
      public.is_project_coordinator(auth.uid(), project_id)
      AND EXISTS (
        SELECT 1 FROM public.inventory i
        WHERE i.id = inventory_id AND public.can_see_inventory(auth.uid(), i.visibility)
      )
    )
  );