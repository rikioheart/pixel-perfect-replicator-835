-- Colonnes lues par l'application (PROFILE_COLUMNS) mais non accordées : toute lecture de profil échouait (403).
GRANT SELECT (account_choice_at, deleted_at) ON public.profiles TO authenticated;

-- Phase bêta : réservations du terrain suspendues pour les membres ; seul le Bureau peut encore créer une demande.
-- Retour arrière : recréer la politique sans la condition is_bureau.
DROP POLICY IF EXISTS terrain_resv_insert ON public.terrain_reservations;
CREATE POLICY terrain_resv_insert ON public.terrain_reservations FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND public.is_bureau(auth.uid()) AND public.can_request_terrain(auth.uid(), project_id, activity_id));