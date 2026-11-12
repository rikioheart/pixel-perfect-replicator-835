-- Lot 2 : préférences de lecture et de confort (ajouts uniquement, couverts par la politique existante user_id = auth.uid()).
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS text_scale smallint NOT NULL DEFAULT 100;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS font_family text NOT NULL DEFAULT 'PLEX';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS line_spacing text NOT NULL DEFAULT 'NORMAL';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS letter_spacing text NOT NULL DEFAULT 'NORMAL';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS paragraph_spacing text NOT NULL DEFAULT 'NORMAL';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS reading_width text NOT NULL DEFAULT 'FULL';
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS calm_mode boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS focus_mode boolean NOT NULL DEFAULT false;

-- Reprise de l'ancienne taille de texte (3 paliers) vers l'échelle en pourcentage.
UPDATE public.user_preferences
SET text_scale = CASE text_size WHEN 'LARGE' THEN 112 WHEN 'XLARGE' THEN 125 ELSE 100 END
WHERE text_scale = 100 AND text_size IN ('LARGE', 'XLARGE');

ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_text_scale_check CHECK (text_scale IN (100, 112, 125, 150, 175, 200));
ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_font_family_check CHECK (font_family IN ('PLEX', 'ATKINSON', 'LEXEND'));
ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_line_spacing_check CHECK (line_spacing IN ('NORMAL', 'RELAXED', 'LOOSE'));
ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_letter_spacing_check CHECK (letter_spacing IN ('NORMAL', 'WIDE', 'WIDER'));
ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_paragraph_spacing_check CHECK (paragraph_spacing IN ('NORMAL', 'WIDE'));
ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_reading_width_check CHECK (reading_width IN ('FULL', 'COMFORTABLE', 'NARROW'));
ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_default_view_check CHECK (default_view IN ('LIST', 'CARDS', 'KANBAN'));

COMMENT ON COLUMN public.user_preferences.text_size IS 'DEPRECATED: replaced by text_scale (percentage 100-200).';
COMMENT ON COLUMN public.user_preferences.notify_email IS 'Not exposed: the platform sends no notification e-mails yet.';
COMMENT ON COLUMN public.user_preferences.focus_mode IS 'Focus mode: compact navigation behind a menu button, centred content; no feature removed.';

-- Rappels : notify_reminders est enfin respecté, et le rappel de fin de concours respecte aussi notify_in_app.
CREATE OR REPLACE FUNCTION public.run_daily_reminders()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  -- Rappels d'inscription aux activités (J-2 / J-1)
  FOR r IN
    SELECT p.user_id, a.id, a.title, a.date::date - current_date AS days
    FROM public.participations p JOIN public.activities a ON a.id = p.activity_id
    WHERE a.date IS NOT NULL AND (a.date::date - current_date) IN (1,2)
      AND upper(p.registration_status) NOT IN ('ANNULE','CANCELLED','REFUSE')
      AND NOT EXISTS (SELECT 1 FROM public.user_preferences up WHERE up.user_id = p.user_id AND up.notify_reminders = false)
  LOOP
    PERFORM public.notify_once(r.user_id, 'ACTIVITY_REMINDER',
      'Rappel : ' || r.title,
      CASE WHEN r.days = 1 THEN 'C''est demain, on compte sur vous !' ELSE 'C''est dans deux jours.' END,
      'activity', r.id, '/activities');
  END LOOP;

  -- Rappels d'inscription aux événements (J-2 / J-1)
  FOR r IN
    SELECT p.user_id, e.id, e.title, e.start_date::date - current_date AS days
    FROM public.participations p JOIN public.events e ON e.id = p.event_id
    WHERE e.start_date IS NOT NULL AND (e.start_date::date - current_date) IN (1,2)
      AND upper(p.registration_status) NOT IN ('ANNULE','CANCELLED','REFUSE')
      AND NOT EXISTS (SELECT 1 FROM public.user_preferences up WHERE up.user_id = p.user_id AND up.notify_reminders = false)
  LOOP
    PERFORM public.notify_once(r.user_id, 'EVENT_REMINDER',
      'Rappel : ' || r.title,
      CASE WHEN r.days = 1 THEN 'C''est demain, on compte sur vous !' ELSE 'C''est dans deux jours.' END,
      'event', r.id, '/events/' || r.id);
  END LOOP;

  -- Tâches proches de l'échéance (J-2 / J-1)
  FOR r IN
    SELECT t.assigned_user_id AS user_id, t.id, t.title, t.deadline::date - current_date AS days
    FROM public.tasks t
    WHERE t.assigned_user_id IS NOT NULL AND t.deadline IS NOT NULL
      AND (t.deadline::date - current_date) IN (1,2)
      AND upper(t.status) NOT IN ('DONE','VALIDATED','TERMINE','ARCHIVED')
      AND NOT EXISTS (SELECT 1 FROM public.user_preferences up WHERE up.user_id = t.assigned_user_id AND up.notify_reminders = false)
  LOOP
    PERFORM public.notify_once(r.user_id, 'TASK_DEADLINE',
      'Échéance proche : ' || r.title,
      CASE WHEN r.days = 1 THEN 'À rendre demain — un petit pas suffit.' ELSE 'À rendre dans deux jours.' END,
      'task', r.id, '/tasks');
  END LOOP;

  -- Concours qui se terminent bientôt
  FOR r IN
    SELECT c.id, c.title FROM public.contests c
    WHERE c.end_date IS NOT NULL AND (c.end_date::date - current_date) IN (1,2)
      AND upper(c.status) NOT IN ('CLOS','CLOSED','ARCHIVED')
  LOOP
    INSERT INTO public.in_app_notifications (recipient_id, kind, title, message, entity_type, entity_id, link_url)
    SELECT pr.id, 'CONTEST_ENDING', 'Le concours « ' || r.title || ' » se termine bientôt',
           'Il reste quelques jours pour participer.', 'contest', r.id, '/blog'
    FROM public.profiles pr
    WHERE NOT EXISTS (
      SELECT 1 FROM public.in_app_notifications n
      WHERE n.recipient_id = pr.id AND n.kind = 'CONTEST_ENDING' AND n.entity_id = r.id
        AND n.created_at > now() - interval '20 hours')
      AND NOT EXISTS (
        SELECT 1 FROM public.user_preferences up
        WHERE up.user_id = pr.id AND (up.notify_reminders = false OR up.notify_in_app = false));
  END LOOP;
END; $function$;
