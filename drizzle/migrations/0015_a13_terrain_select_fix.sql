DROP POLICY IF EXISTS terrain_resv_select ON public.terrain_reservations;
CREATE POLICY terrain_resv_select ON public.terrain_reservations FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR professional_id = auth.uid() OR public.is_bureau(auth.uid())
    OR (project_id IS NOT NULL AND public.is_project_coordinator(auth.uid(), project_id))
    OR public.can_view_terrain_reservation(auth.uid(), id));