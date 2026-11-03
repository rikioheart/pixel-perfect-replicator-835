-- Les privilèges par défaut du schéma accordaient tout à anon/authenticated sur les nouvelles tables.
-- On restreint aux seuls droits voulus (la RLS reste la frontière, ceci est une défense supplémentaire).
REVOKE ALL ON public.inventory_movements FROM anon, authenticated;
GRANT SELECT ON public.inventory_movements TO authenticated;
GRANT UPDATE (reason) ON public.inventory_movements TO authenticated;

REVOKE ALL ON public.inventory_reservations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.inventory_reservations TO authenticated;