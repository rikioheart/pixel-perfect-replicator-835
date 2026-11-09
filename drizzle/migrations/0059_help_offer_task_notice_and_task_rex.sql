-- Axe 1 : un bénévole est prévenu (une seule fois) quand sa proposition d'aide devient une tâche.
CREATE OR REPLACE FUNCTION public.notify_task_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE actor uuid := auth.uid(); actor_name text; c uuid; ptitle text; from_offer boolean := false;
BEGIN
  IF NEW.assigned_user_id IS NOT NULL AND NEW.contribution_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id OR NEW.contribution_id IS DISTINCT FROM OLD.contribution_id)
     AND EXISTS (SELECT 1 FROM public.contributions ct WHERE ct.id = NEW.contribution_id AND ct.user_id = NEW.assigned_user_id) THEN
    from_offer := true;
    SELECT p.title INTO ptitle FROM public.projects p WHERE p.id = NEW.project_id;
    -- même type et même objet que l'avis de changement de statut : l'anti-doublon n'envoie qu'un message.
    PERFORM public.notify_member(NEW.assigned_user_id, actor, 'CONTRIBUTION_UPDATE', 'Votre proposition d''aide devient une tâche',
      'Merci ! « ' || NEW.title || ' » vous est confiée' || coalesce(' pour le projet « ' || ptitle || ' »', '') || '.',
      'contribution', NEW.contribution_id,
      CASE WHEN NEW.project_id IS NOT NULL THEN '/tasks?projectId=' || NEW.project_id::text ELSE '/tasks' END,
      interval '1 minute');
  END IF;

  IF NOT from_offer AND NEW.assigned_user_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id) THEN
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
      coalesce(actor_name, 'Un membre') || ' a soumis la tâche « ' || NEW.title || ' » pour validation.', 'task', NEW.id, '/admin/validation');
    IF NEW.project_id IS NOT NULL THEN
      FOR c IN SELECT DISTINCT pm.user_id FROM public.project_members pm
        WHERE pm.project_id = NEW.project_id AND upper(coalesce(pm.project_role,'')) IN ('OWNER','COORDINATOR') LOOP
        PERFORM public.notify_member(c, actor, 'TASK_PENDING_VALIDATION', 'Tâche à valider',
          coalesce(actor_name, 'Un membre') || ' a soumis la tâche « ' || NEW.title || ' » pour validation.',
          'task', NEW.id, '/projects/' || NEW.project_id::text, interval '20 hours');
      END LOOP;
    END IF;
  END IF;

  IF coalesce(OLD.status, '') = 'PENDING_VALIDATION' AND NEW.status IN ('COMPLETED', 'TODO', 'IN_PROGRESS') AND NEW.assigned_user_id IS NOT NULL THEN
    PERFORM public.notify_member(NEW.assigned_user_id, actor,
      CASE WHEN NEW.status = 'COMPLETED' THEN 'TASK_APPROVED' ELSE 'TASK_REJECTED' END,
      CASE WHEN NEW.status = 'COMPLETED' THEN 'Tâche validée' ELSE 'Tâche à compléter' END,
      CASE WHEN NEW.status = 'COMPLETED' THEN 'La tâche « ' || NEW.title || ' » a été validée. Merci !'
        ELSE 'La tâche « ' || NEW.title || ' » vous est renvoyée : ' || coalesce(NEW.rejection_reason, 'complément demandé') END,
      'task', NEW.id, '/tasks', interval '1 minute');
  END IF;
  RETURN NEW;
END $function$;

-- Axe 1 : boucle de clôture, une tâche validée alimente le retour d'expérience de son projet.
CREATE OR REPLACE FUNCTION public.add_task_rex(_task_id uuid, _field text, _note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); t record; line text; current_text text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF _field IS NULL OR _field NOT IN ('rex_successes', 'rex_improvements', 'rex_advice') THEN
    RAISE EXCEPTION 'Rubrique du retour d''expérience inconnue';
  END IF;
  IF char_length(trim(coalesce(_note, ''))) < 3 THEN RAISE EXCEPTION 'Écrivez au moins quelques mots'; END IF;
  IF char_length(trim(_note)) > 1000 THEN RAISE EXCEPTION 'Texte trop long (1000 caractères au plus)'; END IF;

  SELECT tk.id, tk.title, tk.status, tk.project_id, p.owner_id INTO t
    FROM public.tasks tk JOIN public.projects p ON p.id = tk.project_id
    WHERE tk.id = _task_id
    FOR UPDATE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tâche introuvable ou sans projet'; END IF;
  IF t.status <> 'COMPLETED' THEN RAISE EXCEPTION 'Seule une tâche validée peut nourrir le retour d''expérience'; END IF;
  IF NOT (public.is_bureau(uid) OR t.owner_id = uid OR public.is_project_coordinator(uid, t.project_id)) THEN
    RAISE EXCEPTION 'Réservé au Bureau et aux responsables du projet';
  END IF;

  line := '• ' || t.title || ' — ' || trim(_note);
  EXECUTE format('SELECT %I FROM public.projects WHERE id = $1', _field) INTO current_text USING t.project_id;
  IF coalesce(current_text, '') <> '' AND position(line IN current_text) > 0 THEN RETURN; END IF;

  EXECUTE format(
    'UPDATE public.projects SET %1$I = CASE WHEN coalesce(%1$I, '''') = '''' THEN $1 ELSE %1$I || E''\n'' || $1 END WHERE id = $2',
    _field) USING line, t.project_id;

  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  VALUES (uid, 'project.rex_from_task', 'project', t.project_id, jsonb_build_object('task_id', t.id, 'field', _field));
END $function$;

REVOKE ALL ON FUNCTION public.add_task_rex(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_task_rex(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.add_task_rex(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_task_rex(uuid, text, text) TO service_role;