ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'SYSTEM';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS comfortable_spacing boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS notification_sound boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_preferences DROP CONSTRAINT IF EXISTS user_preferences_theme_check;
ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_theme_check CHECK (theme IN ('LIGHT','DARK','SYSTEM'));