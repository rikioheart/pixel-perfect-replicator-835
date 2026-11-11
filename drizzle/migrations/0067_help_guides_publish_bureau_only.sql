-- Seul le Bureau publie un guide ; un adhérent peut uniquement envoyer une proposition en attente.
DROP POLICY IF EXISTS "Chacun peut proposer un guide" ON public.help_guides;
CREATE POLICY "Chacun peut proposer un guide" ON public.help_guides
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (public.is_bureau(auth.uid()) OR (status = 'PENDING' AND visibility = 'ALL'))
  );