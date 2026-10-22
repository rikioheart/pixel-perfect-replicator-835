-- Lot 6 : notifications de collaboration émises uniquement par la base (idempotentes, respect des préférences et des droits).

CREATE OR REPLACE FUNCTION public.notify_member(_recipient uuid, _sender uuid, _kind text, _title text, _message text, _entity_type text, _entity_id uuid, _link text, _window interval DEFAULT interval '10 minutes')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _recipient IS NULL OR _recipient IS NOT DISTINCT FROM _sender THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.user_preferences p WHERE p.user_id = _recipient AND p.notify_in_app = false) THEN RETURN; END IF;
  IF EXISTS (
    SELECT 1 FROM public.in_app_notifications n
    WHERE n.recipient_id = _recipient AND n.kind = _kind
      AND n.entity_id IS NOT DISTINCT FROM _entity_id
      AND n.created_at > now() - _window
  ) THEN RETURN; END IF;
  INSERT INTO public.in_app_notifications (recipient_id, sender_id, kind, title, message, entity_type, entity_id, link_url)
  VALUES (_recipient, _sender, _kind, _title, left(_message, 300), _entity_type, _entity_id, _link);
END $$;

CREATE OR REPLACE FUNCTION public.notify_bureau_members(_sender uuid, _kind text, _title text, _message text, _entity_type text, _entity_id uuid, _link text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b uuid;
BEGIN
  FOR b IN SELECT DISTINCT ur.user_id FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE r.code = 'ADMIN_BUREAU' LOOP
    PERFORM public.notify_member(b, _sender, _kind, _title, _message, _entity_type, _entity_id, _link, interval '20 hours');
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.notify_member(uuid, uuid, text, text, text, text, uuid, text, interval) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_bureau_members(uuid, text, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_member(uuid, uuid, text, text, text, text, uuid, text, interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_bureau_members(uuid, text, text, text, text, uuid, text) TO service_role;

-- Commentaires : auteurs précédents + responsables de l'objet, uniquement s'ils peuvent voir l'objet.
CREATE OR REPLACE FUNCTION public.notify_comment_added()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r uuid; link text; label text; title_txt text;
BEGIN
  IF NEW.entity_type = 'task' THEN
    SELECT t.title INTO title_txt FROM public.tasks t WHERE t.id = NEW.entity_id; link := '/tasks'; label := 'une tâche';
  ELSIF NEW.entity_type = 'project' THEN
    SELECT p.title INTO title_txt FROM public.projects p WHERE p.id = NEW.entity_id; link := '/projects/' || NEW.entity_id; label := 'un projet';
  ELSIF NEW.entity_type = 'event' THEN
    SELECT e.title INTO title_txt FROM public.events e WHERE e.id = NEW.entity_id; link := '/events/' || NEW.entity_id; label := 'un événement';
  ELSIF NEW.entity_type = 'document' THEN
    SELECT d.title INTO title_txt FROM public.documents d WHERE d.id = NEW.entity_id; link := '/documents'; label := 'un document';
  ELSE
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT DISTINCT x.uid FROM (
      SELECT c.author_id AS uid FROM public.comments c WHERE c.entity_type = NEW.entity_type AND c.entity_id = NEW.entity_id
      UNION SELECT t.assigned_user_id FROM public.tasks t WHERE NEW.entity_type = 'task' AND t.id = NEW.entity_id
      UNION SELECT t.created_by FROM public.tasks t WHERE NEW.entity_type = 'task' AND t.id = NEW.entity_id
      UNION SELECT p.owner_id FROM public.projects p WHERE NEW.entity_type = 'project' AND p.id = NEW.entity_id
      UNION SELECT pm.user_id FROM public.project_members pm WHERE NEW.entity_type = 'project' AND pm.project_id = NEW.entity_id
      UNION SELECT e.created_by FROM public.events e WHERE NEW.entity_type = 'event' AND e.id = NEW.entity_id
      UNION SELECT d.uploaded_by FROM public.documents d WHERE NEW.entity_type = 'document' AND d.id = NEW.entity_id
    ) x WHERE x.uid IS NOT NULL AND x.uid <> NEW.author_id
  LOOP
    IF public.can_view_comment_target(r, NEW.entity_type, NEW.entity_id) THEN
      PERFORM public.notify_member(r, NEW.author_id, 'COMMENT_ADDED', 'Nouveau commentaire sur ' || label,
        coalesce(title_txt || ' — ', '') || left(NEW.body, 120), NEW.entity_type, NEW.entity_id, link);
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_comments_notify ON public.comments;
CREATE TRIGGER trg_comments_notify AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION public.notify_comment_added();

-- Tâches : affectation, création par un membre, soumission et décision (y compris renvoi en cours).
CREATE OR REPLACE FUNCTION public.notify_task_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid := auth.uid(); actor_name text;
BEGIN
  IF NEW.assigned_user_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id) THEN
    PERFORM public.notify_member(NEW.assigned_user_id, actor, 'TASK_ASSIGNED', 'Une tâche vous est confiée',
      NEW.title, 'task', NEW.id, '/tasks');
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF actor IS NOT NULL AND NOT public.is_bureau(actor) THEN
      PERFORM public.notify_bureau_members(actor, 'TASK_CREATED', 'Nouvelle tâche proposée', NEW.title, 'task', NEW.id, '/tasks');
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status = 'PENDING_VALIDATION' AND coalesce(OLD.status, '') <> 'PENDING_VALIDATION' THEN
    SELECT coalesce(p.display_name, nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''), 'Un membre')
      INTO actor_name FROM public.profiles p WHERE p.id = coalesce(actor, NEW.assigned_user_id);
    PERFORM public.notify_bureau_members(actor, 'TASK_PENDING_VALIDATION', 'Tâche à valider',
      coalesce(actor_name, 'Un membre') || ' a marqué la tâche « ' || NEW.title || ' » comme terminée.', 'task', NEW.id, '/admin/validation');
  END IF;

  IF coalesce(OLD.status, '') = 'PENDING_VALIDATION' AND NEW.status IN ('COMPLETED', 'TODO', 'IN_PROGRESS') AND NEW.assigned_user_id IS NOT NULL THEN
    PERFORM public.notify_member(NEW.assigned_user_id, actor,
      CASE WHEN NEW.status = 'COMPLETED' THEN 'TASK_APPROVED' ELSE 'TASK_REJECTED' END,
      CASE WHEN NEW.status = 'COMPLETED' THEN 'Tâche validée' ELSE 'Tâche à compléter' END,
      CASE WHEN NEW.status = 'COMPLETED' THEN 'Le Bureau a validé la tâche « ' || NEW.title || ' ». Merci !'
        ELSE 'Le Bureau a renvoyé la tâche « ' || NEW.title || ' » : ' || coalesce(NEW.rejection_reason, 'complément demandé') END,
      'task', NEW.id, '/tasks', interval '1 minute');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_tasks_notify ON public.tasks;
CREATE TRIGGER trg_tasks_notify AFTER INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.notify_task_status_change();

-- Projets : création par un membre (Bureau informé) et ajout à l'équipe.
CREATE OR REPLACE FUNCTION public.notify_project_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_bureau(auth.uid()) THEN
    PERFORM public.notify_bureau_members(auth.uid(), 'PROJECT_CREATED', 'Nouveau projet créé', NEW.title, 'project', NEW.id, '/projects/' || NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_projects_notify ON public.projects;
CREATE TRIGGER trg_projects_notify AFTER INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.notify_project_created();

CREATE OR REPLACE FUNCTION public.notify_project_member_added()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t text;
BEGIN
  SELECT p.title INTO t FROM public.projects p WHERE p.id = NEW.project_id;
  PERFORM public.notify_member(NEW.user_id, auth.uid(), 'PROJECT_MEMBER_ADDED', 'Vous rejoignez un projet',
    coalesce(t, 'Projet'), 'project', NEW.project_id, '/projects/' || NEW.project_id, interval '20 hours');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_project_members_notify ON public.project_members;
CREATE TRIGGER trg_project_members_notify AFTER INSERT ON public.project_members FOR EACH ROW EXECUTE FUNCTION public.notify_project_member_added();

-- Propositions professionnelles.
CREATE OR REPLACE FUNCTION public.notify_pro_proposal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_bureau_members(NEW.submitted_by, 'PROPOSAL_SUBMITTED', 'Nouvelle proposition', NEW.title, 'proposal', NEW.id, '/proposals');
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('ACCEPTED', 'REFUSED') THEN
    PERFORM public.notify_member(NEW.submitted_by, auth.uid(),
      CASE WHEN NEW.status = 'ACCEPTED' THEN 'PROPOSAL_ACCEPTED' ELSE 'PROPOSAL_REJECTED' END,
      CASE WHEN NEW.status = 'ACCEPTED' THEN 'Proposition acceptée' ELSE 'Proposition non retenue' END,
      NEW.title || coalesce(' — ' || NEW.review_comment, ''), 'proposal', NEW.id, '/proposals', interval '1 minute');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_pro_proposals_notify ON public.professional_proposals;
CREATE TRIGGER trg_pro_proposals_notify AFTER INSERT OR UPDATE OF status ON public.professional_proposals FOR EACH ROW EXECUTE FUNCTION public.notify_pro_proposal();

-- Guides d'aide proposés par un membre.
CREATE OR REPLACE FUNCTION public.notify_help_guide()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'PENDING' THEN
    PERFORM public.notify_bureau_members(NEW.author_id, 'HELP_GUIDE_PROPOSED', 'Nouveau guide proposé', NEW.title, 'help_guide', NEW.id, '/help');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_help_guides_notify ON public.help_guides;
CREATE TRIGGER trg_help_guides_notify AFTER INSERT ON public.help_guides FOR EACH ROW EXECUTE FUNCTION public.notify_help_guide();

-- Propositions d'aide : arrivée (idempotente) et réponse du Bureau.
CREATE OR REPLACE FUNCTION public.notify_contribution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_bureau_members(NEW.user_id, 'HELP_OFFER', 'Nouvelle proposition d''aide', NEW.title, 'contribution', NEW.id, '/admin/contributions');
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify_member(NEW.user_id, auth.uid(), 'CONTRIBUTION_UPDATE', 'Votre proposition d''aide a avancé',
      coalesce(NEW.bureau_reply, NEW.title), 'contribution', NEW.id, '/parcours', interval '1 minute');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_contrib_notify ON public.contributions;
CREATE TRIGGER trg_contrib_notify AFTER INSERT OR UPDATE OF status ON public.contributions FOR EACH ROW EXECUTE FUNCTION public.notify_contribution();

REVOKE ALL ON FUNCTION public.notify_comment_added(), public.notify_task_status_change(), public.notify_project_created(),
  public.notify_project_member_added(), public.notify_pro_proposal(), public.notify_help_guide(), public.notify_contribution()
  FROM PUBLIC, anon, authenticated;