ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS signature text NOT NULL DEFAULT 'BORDEAUX';
ALTER TABLE public.user_preferences DROP CONSTRAINT IF EXISTS user_preferences_signature_check;
ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_signature_check CHECK (signature IN ('BORDEAUX','BLEU_NUIT'));
COMMENT ON COLUMN public.user_preferences.signature IS 'Signature visuelle de l''espace membre (BORDEAUX ou BLEU_NUIT), indépendante du thème clair/sombre.';