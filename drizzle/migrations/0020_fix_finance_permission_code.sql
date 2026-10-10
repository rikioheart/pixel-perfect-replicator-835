DROP POLICY fe_bureau ON public.finance_entries;
CREATE POLICY fe_bureau ON public.finance_entries FOR ALL TO authenticated
  USING (public.is_bureau(auth.uid()) AND public.has_permission(auth.uid(),'finance.view_global'))
  WITH CHECK (public.is_bureau(auth.uid()) AND public.has_permission(auth.uid(),'finance.update'));