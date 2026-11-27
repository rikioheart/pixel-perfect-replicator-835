CREATE OR REPLACE FUNCTION public.can_receive_stamps(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT (_user_id=auth.uid() OR public.is_pass_validator(auth.uid()) OR auth.role()='service_role' OR (auth.uid() IS NULL AND session_user IN ('postgres','supabase_admin'))) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=_user_id AND p.membership_status='ACTIVE' AND (p.membership_type='PARTICULIER' OR EXISTS (SELECT 1 FROM public.pass_access a WHERE a.user_id=p.id AND a.personal_pass_at IS NOT NULL)));
$$;
CREATE OR REPLACE FUNCTION public.can_manage_dog(_user_id uuid,_dog_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT (_user_id=auth.uid() OR auth.role()='service_role' OR (auth.uid() IS NULL AND session_user IN ('postgres','supabase_admin'))) AND (public.is_dog_keeper(_user_id,_dog_id) OR public.bureau_dog_full(_user_id));
$$;
CREATE OR REPLACE FUNCTION public.can_view_dog_operational(_user_id uuid,_dog_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT (_user_id=auth.uid() OR auth.role()='service_role' OR (auth.uid() IS NULL AND session_user IN ('postgres','supabase_admin'))) AND public.is_professional(_user_id) AND (
 EXISTS (SELECT 1 FROM public.dog_referents r WHERE r.dog_id=_dog_id AND r.professional_id=_user_id)
 OR EXISTS (SELECT 1 FROM public.participation_dogs pd JOIN public.participations p ON p.id=pd.participation_id LEFT JOIN public.activities a ON a.id=p.activity_id LEFT JOIN public.events e ON e.id=p.event_id WHERE pd.dog_id=_dog_id AND coalesce(p.registration_status,'')<>'CANCELLED' AND (a.professional_id=_user_id OR a.referent_id=_user_id OR _user_id=ANY(coalesce(a.professional_ids,'{}')) OR e.professional_id=_user_id OR e.referent_id=_user_id OR _user_id=ANY(coalesce(e.professional_ids,'{}'))))
 OR EXISTS (SELECT 1 FROM public.terrain_reservation_dogs rd JOIN public.terrain_reservations t ON t.id=rd.reservation_id WHERE rd.dog_id=_dog_id AND t.status IN ('PENDING','APPROVED') AND (t.professional_id=_user_id OR t.requested_by=_user_id OR EXISTS (SELECT 1 FROM public.terrain_reservation_professionals rp WHERE rp.reservation_id=t.id AND rp.professional_id=_user_id)))
 );
$$;
REVOKE ALL ON FUNCTION public.can_receive_stamps(uuid),public.can_manage_dog(uuid,uuid),public.can_view_dog_operational(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_receive_stamps(uuid),public.can_manage_dog(uuid,uuid),public.can_view_dog_operational(uuid,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.add_task_rex(_task_id uuid,_field text,_note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid := auth.uid(); t record; line text; current_text text;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
 IF _field IS NULL OR _field NOT IN ('rex_successes','rex_improvements','rex_advice') THEN RAISE EXCEPTION 'Rubrique du retour d’expérience inconnue'; END IF;
 IF char_length(trim(coalesce(_note,'')))<3 OR char_length(trim(_note))>1000 THEN RAISE EXCEPTION 'Le retour doit contenir entre 3 et 1000 caractères.'; END IF;
 SELECT tk.id,tk.title,tk.status,tk.project_id,p.owner_id INTO t FROM public.tasks tk JOIN public.projects p ON p.id=tk.project_id WHERE tk.id=_task_id FOR UPDATE OF p;
 IF NOT FOUND OR t.status<>'COMPLETED' THEN RAISE EXCEPTION 'Une tâche validée dans un projet est nécessaire.'; END IF;
 IF NOT (public.is_bureau(uid) OR t.owner_id=uid OR public.is_project_coordinator(uid,t.project_id)) THEN RAISE EXCEPTION 'Réservé au Bureau et aux responsables du projet'; END IF;
 line := '• '||t.title||' — '||trim(_note);
 SELECT CASE _field WHEN 'rex_successes' THEN rex_successes WHEN 'rex_improvements' THEN rex_improvements ELSE rex_advice END INTO current_text FROM public.projects WHERE id=t.project_id;
 IF coalesce(current_text,'')<>'' AND position(line IN current_text)>0 THEN RETURN; END IF;
 current_text := CASE WHEN coalesce(current_text,'')='' THEN line ELSE current_text||E'\n'||line END;
 UPDATE public.projects SET rex_successes=CASE WHEN _field='rex_successes' THEN current_text ELSE rex_successes END, rex_improvements=CASE WHEN _field='rex_improvements' THEN current_text ELSE rex_improvements END, rex_advice=CASE WHEN _field='rex_advice' THEN current_text ELSE rex_advice END WHERE id=t.project_id;
 INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,metadata) VALUES(uid,'project.rex_from_task','project',t.project_id,jsonb_build_object('task_id',t.id,'field',_field));
END $$;
REVOKE ALL ON FUNCTION public.add_task_rex(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.add_task_rex(uuid,text,text) TO authenticated,service_role;