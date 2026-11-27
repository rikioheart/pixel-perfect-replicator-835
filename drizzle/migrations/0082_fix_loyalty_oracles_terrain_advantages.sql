
DROP POLICY IF EXISTS loyalty_stamps_insert ON public.loyalty_stamps;
CREATE POLICY loyalty_stamps_insert ON public.loyalty_stamps FOR INSERT TO authenticated WITH CHECK (public.is_bureau(auth.uid()));

DROP POLICY IF EXISTS advantages_insert ON public.advantages;
CREATE POLICY advantages_insert ON public.advantages FOR INSERT TO authenticated WITH CHECK (public.is_bureau(auth.uid()));
DROP POLICY IF EXISTS advantages_update ON public.advantages;
CREATE POLICY advantages_update ON public.advantages FOR UPDATE TO authenticated USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));

CREATE OR REPLACE FUNCTION public.guard_participation_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_bureau(auth.uid())
     OR COALESCE(current_setting('lvdc.manual_stamp_sync', true),'')='on' THEN RETURN NEW; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.registration_status IN ('ATTENDED','VALIDATED','CONFIRMED') THEN NEW.registration_status := 'PENDING'; END IF;
    NEW.validated_at := NULL; NEW.validated_by := NULL;
  ELSE
    IF NEW.registration_status IS DISTINCT FROM OLD.registration_status AND NEW.registration_status IN ('ATTENDED','VALIDATED','CONFIRMED') THEN
      RAISE EXCEPTION 'La présence est confirmée par le Bureau ou un valideur';
    END IF;
    NEW.validated_at := OLD.validated_at; NEW.validated_by := OLD.validated_by;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_participation_status() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS a_guard_participation_status ON public.participations;
CREATE TRIGGER a_guard_participation_status BEFORE INSERT OR UPDATE ON public.participations FOR EACH ROW EXECUTE FUNCTION public.guard_participation_status();

-- Internal (non-exposed) variants for trusted callers
CREATE OR REPLACE FUNCTION public.person_id_of(_user_id uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT person_id FROM public.profiles WHERE id=_user_id $$;
REVOKE EXECUTE ON FUNCTION public.person_id_of(uuid) FROM public, anon, authenticated;

DO $$ DECLARE d text; BEGIN
  d := pg_get_functiondef('public.can_view_comment_target(uuid,text,uuid)'::regprocedure);
  d := replace(d, 'public.can_view_comment_target(', 'public.comment_target_visible_to(');
  EXECUTE d;
END $$;
REVOKE EXECUTE ON FUNCTION public.comment_target_visible_to(uuid,text,uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.can_view_comment_target(_user_id uuid, _type text, _id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE WHEN auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN false
  ELSE public.comment_target_visible_to(_user_id,_type,_id) END $$;

CREATE OR REPLACE FUNCTION public.current_person_id(_user_id uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT CASE WHEN auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() AND NOT public.is_bureau(auth.uid()) THEN NULL
  ELSE public.person_id_of(_user_id) END $$;

DO $$ DECLARE f text; d text; BEGIN
  FOREACH f IN ARRAY ARRAY['notify_comment_added','can_view_terrain_reservation','fill_person_from_user','submit_form_response','account_deletion_blockers'] LOOP
    SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE proname=f AND pronamespace='public'::regnamespace;
    d := replace(replace(d, 'can_view_comment_target(r,', 'comment_target_visible_to(r,'), 'current_person_id(', 'person_id_of(');
    EXECUTE d;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.can_edit_dog_indicators(_user_id uuid, _dog_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid()) AND (public.can_manage_dog(_user_id,_dog_id)
   OR EXISTS (SELECT 1 FROM public.dog_referents r JOIN public.dogs d ON d.id=r.dog_id
     WHERE r.dog_id=_dog_id AND r.professional_id=_user_id AND coalesce(d.referent_can_share_followup,false) AND public.is_professional(_user_id))) $$;

CREATE OR REPLACE FUNCTION public.has_scoped_permission(_user_id uuid, _code text, _scope_type text, _scope_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid()) AND (public.has_permission(_user_id,_code)
   OR (_scope_type='PROJECT' AND public.is_project_coordinator(_user_id,_scope_id) AND split_part(_code,'.',1) IN ('projects','tasks','terrain','documents'))
   OR EXISTS (SELECT 1 FROM public.delegations d WHERE d.delegate_id=_user_id AND d.permission_code=_code AND d.scope_type=_scope_type AND d.scope_id=_scope_id AND d.revoked_at IS NULL AND now() BETWEEN d.starts_at AND d.ends_at)) $$;

DO $$ DECLARE d text; n text; BEGIN
  d := pg_get_functiondef('public.global_search(text,text,date)'::regprocedure);
  n := replace(d, 'FROM public.terrain_resources tr WHERE ', 'FROM public.terrain_resources tr WHERE (public.is_active_member(auth.uid()) OR public.is_bureau(auth.uid())) AND ');
  IF n = d THEN RAISE EXCEPTION 'global_search patch failed'; END IF; EXECUTE n;
  d := pg_get_functiondef('public.entity_peek(text,uuid)'::regprocedure);
  n := replace(d, 'FROM public.terrain_resources tr WHERE tr.id=_id;', 'FROM public.terrain_resources tr WHERE tr.id=_id AND (public.is_active_member(auth.uid()) OR public.is_bureau(auth.uid()));');
  IF n = d THEN RAISE EXCEPTION 'entity_peek patch failed'; END IF; EXECUTE n;
  d := pg_get_functiondef('public.award_manual_stamp(uuid,uuid,uuid,uuid,text)'::regprocedure);
  n := regexp_replace(d, '(\n\s*k := ''MANUAL:'')', E'\n  IF _event_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id=_event_id AND coalesce(e.status,'''') <> ''CANCELLED'' AND e.start_date IS NOT NULL AND e.start_date >= now() - interval ''7 days'' AND e.start_date <= now() + interval ''1 day'' AND (public.is_bureau(me) OR e.professional_id=me OR me = ANY(coalesce(e.professional_ids, ''{}''::uuid[])) OR e.referent_id=me OR e.created_by=me)) THEN\n    RAISE EXCEPTION ''Événement non rattachable : choisissez un événement récent que vous encadrez'';\n  END IF;\\1');
  IF n = d THEN RAISE EXCEPTION 'award patch failed'; END IF; EXECUTE n;
END $$;
