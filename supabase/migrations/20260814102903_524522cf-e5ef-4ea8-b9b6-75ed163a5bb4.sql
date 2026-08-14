REVOKE EXECUTE ON FUNCTION public.recompute_loyalty_for_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recompute_loyalty_all() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_loyalty_for_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recompute_loyalty_all() TO authenticated, service_role;