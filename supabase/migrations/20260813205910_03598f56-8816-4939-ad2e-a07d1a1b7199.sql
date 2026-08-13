CREATE POLICY "role_permissions_bureau_insert" ON public.role_permissions FOR INSERT TO authenticated WITH CHECK (public.is_bureau(auth.uid()));
CREATE POLICY "role_permissions_bureau_delete" ON public.role_permissions FOR DELETE TO authenticated USING (public.is_bureau(auth.uid()));
GRANT INSERT, DELETE ON public.role_permissions TO authenticated;