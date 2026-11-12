-- Lot 5 : petites marques de reconnaissance (badges calculés à la volée, célébration des tampons), désactivables.
-- Ajout seul, couvert par la politique existante user_id = auth.uid() ; aucun badge n'est stocké.
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS show_recognition boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.user_preferences.show_recognition IS 'Shows personal recognition badges (computed from human-validated data, visible only to the member) and the stamp celebration. No badge is stored.';