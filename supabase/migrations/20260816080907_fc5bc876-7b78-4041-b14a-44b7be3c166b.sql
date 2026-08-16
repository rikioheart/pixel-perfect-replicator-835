
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS image_url text;

CREATE OR REPLACE FUNCTION public.notify_once(
  _recipient uuid, _kind text, _title text, _message text,
  _entity_type text, _entity_id uuid, _link text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _recipient IS NULL THEN RETURN; END IF;
  IF EXISTS (
    SELECT 1 FROM public.in_app_notifications n
    WHERE n.recipient_id = _recipient AND n.kind = _kind
      AND n.entity_id IS NOT DISTINCT FROM _entity_id
      AND n.created_at > now() - interval '20 hours'
  ) THEN RETURN; END IF;
  INSERT INTO public.in_app_notifications (recipient_id, kind, title, message, entity_type, entity_id, link_url)
  VALUES (_recipient, _kind, _title, _message, _entity_type, _entity_id, _link);
END; $$;

CREATE OR REPLACE FUNCTION public.run_daily_reminders() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; d int;
BEGIN
  -- Rappels d'inscription aux activités (J-2 / J-1)
  FOR r IN
    SELECT p.user_id, a.id, a.title, a.date::date - current_date AS days
    FROM public.participations p JOIN public.activities a ON a.id = p.activity_id
    WHERE a.date IS NOT NULL AND (a.date::date - current_date) IN (1,2)
      AND upper(p.registration_status) NOT IN ('ANNULE','CANCELLED','REFUSE')
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
        AND n.created_at > now() - interval '20 hours');
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.run_weekly_bureau_digest() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pending int; submitted int; upcoming int; msg text; r record;
BEGIN
  SELECT count(*) INTO submitted FROM public.tasks WHERE upper(status) = 'SUBMITTED';
  SELECT count(*) INTO pending FROM public.tasks WHERE needs_help = true;
  SELECT count(*) INTO upcoming FROM public.events
    WHERE start_date IS NOT NULL AND start_date BETWEEN now() AND now() + interval '7 days';
  msg := submitted || ' validation(s) en attente · ' || pending || ' demande(s) d''aide · '
      || upcoming || ' événement(s) cette semaine.';
  FOR r IN SELECT ur.user_id FROM public.user_roles ur JOIN public.roles ro ON ro.id = ur.role_id
           WHERE upper(ro.code) IN ('BUREAU','ADMIN','PRESIDENT') GROUP BY ur.user_id
  LOOP
    INSERT INTO public.in_app_notifications (recipient_id, kind, title, message, entity_type, link_url)
    VALUES (r.user_id, 'WEEKLY_DIGEST', 'Récapitulatif de la semaine', msg, 'digest', '/admin/cockpit');
  END LOOP;
END; $$;

REVOKE ALL ON FUNCTION public.run_daily_reminders() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_weekly_bureau_digest() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_once(uuid,text,text,text,text,uuid,text) FROM public, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  PERFORM cron.unschedule('lvdc-daily-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('lvdc-weekly-digest');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('lvdc-daily-reminders', '0 7 * * *', $$SELECT public.run_daily_reminders();$$);
SELECT cron.schedule('lvdc-weekly-digest', '0 6 * * 1', $$SELECT public.run_weekly_bureau_digest();$$);
