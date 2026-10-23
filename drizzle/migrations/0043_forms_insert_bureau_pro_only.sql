DROP POLICY IF EXISTS forms_insert ON public.forms;
CREATE POLICY forms_insert ON public.forms FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND (public.is_bureau(auth.uid()) OR public.is_professional(auth.uid())));