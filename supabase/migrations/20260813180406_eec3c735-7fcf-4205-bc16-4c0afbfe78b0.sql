CREATE TABLE public.in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id uuid,
  kind text NOT NULL DEFAULT 'INFO',
  title text NOT NULL,
  message text,
  link_url text,
  entity_type text,
  entity_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.in_app_notifications TO authenticated;
GRANT ALL ON public.in_app_notifications TO service_role;

ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_select_own" ON public.in_app_notifications
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid() OR public.is_bureau(auth.uid()));

CREATE POLICY "notif_update_own" ON public.in_app_notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

CREATE POLICY "notif_insert_bureau" ON public.in_app_notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.is_bureau(auth.uid()));

CREATE POLICY "notif_delete_own" ON public.in_app_notifications
  FOR DELETE TO authenticated
  USING (recipient_id = auth.uid() OR public.is_bureau(auth.uid()));

CREATE INDEX idx_notif_recipient_unread ON public.in_app_notifications (recipient_id, is_read, created_at DESC);

CREATE OR REPLACE FUNCTION public.notify_task_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_name text;
  admin_id uuid;
BEGIN
  IF NEW.status = 'PENDING_VALIDATION' AND COALESCE(OLD.status, '') <> 'PENDING_VALIDATION' THEN
    SELECT COALESCE(p.display_name, NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')), ''), 'Un membre')
      INTO actor_name
    FROM public.profiles p WHERE p.id = COALESCE(auth.uid(), NEW.assigned_user_id);

    FOR admin_id IN
      SELECT ur.user_id FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE r.code = 'ADMIN_BUREAU'
    LOOP
      INSERT INTO public.in_app_notifications (recipient_id, sender_id, kind, title, message, link_url, entity_type, entity_id)
      VALUES (
        admin_id,
        auth.uid(),
        'TASK_PENDING_VALIDATION',
        'Tâche à valider',
        COALESCE(actor_name, 'Un membre') || ' a marqué la tâche « ' || NEW.title || ' » comme terminée. En attente de validation.',
        '/admin/validation',
        'task',
        NEW.id
      );
    END LOOP;
  END IF;

  IF NEW.status IN ('COMPLETED','TODO') AND COALESCE(OLD.status,'') = 'PENDING_VALIDATION' AND NEW.assigned_user_id IS NOT NULL THEN
    INSERT INTO public.in_app_notifications (recipient_id, sender_id, kind, title, message, link_url, entity_type, entity_id)
    VALUES (
      NEW.assigned_user_id,
      auth.uid(),
      CASE WHEN NEW.status = 'COMPLETED' THEN 'TASK_APPROVED' ELSE 'TASK_REJECTED' END,
      CASE WHEN NEW.status = 'COMPLETED' THEN 'Tâche validée' ELSE 'Tâche refusée' END,
      CASE WHEN NEW.status = 'COMPLETED'
        THEN 'Le Bureau a validé la tâche « ' || NEW.title || ' ». Bravo !'
        ELSE 'Le Bureau a renvoyé la tâche « ' || NEW.title || ' » : ' || COALESCE(NEW.rejection_reason, 'complément demandé') END,
      '/tasks',
      'task',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tasks_notify
AFTER UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_status_change();

ALTER TABLE public.in_app_notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.in_app_notifications;