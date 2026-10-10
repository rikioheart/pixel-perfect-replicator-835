CREATE OR REPLACE FUNCTION public.import_helloasso_membership(_ext_id text, _email text, _first text, _last text, _start date, _end date, _amount numeric, _type text DEFAULT 'PARTICULIER')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid; uid uuid; n int; mid uuid; existing public.memberships; v_out text; cands jsonb; payload jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_bureau(auth.uid()) THEN RAISE EXCEPTION 'Réservé au Bureau'; END IF;
  payload := jsonb_build_object('email',_email,'first',_first,'last',_last,'start',_start,'end',_end,'amount',_amount,'type',_type);
  IF coalesce(_ext_id,'') = '' THEN
    INSERT INTO integration_events(source, outcome, message, payload) VALUES ('HELLOASSO','ERROR','Identifiant HelloAsso manquant', payload);
    RETURN jsonb_build_object('outcome','ERROR');
  END IF;
  SELECT * INTO existing FROM memberships WHERE source='HELLOASSO' AND external_id=_ext_id;
  IF existing.id IS NOT NULL THEN
    IF existing.start_date IS NOT DISTINCT FROM _start AND existing.end_date IS NOT DISTINCT FROM _end THEN v_out := 'UNCHANGED';
    ELSE UPDATE memberships SET start_date=_start, end_date=_end WHERE id=existing.id; v_out := 'UPDATED'; END IF;
    INSERT INTO integration_events(source, external_id, entity_type, entity_id, outcome, payload) VALUES ('HELLOASSO',_ext_id,'membership',existing.id,v_out,payload);
    RETURN jsonb_build_object('outcome',v_out,'membership_id',existing.id);
  END IF;
  IF EXISTS (SELECT 1 FROM integration_events WHERE source='HELLOASSO' AND external_id=_ext_id AND integration_events.outcome IN ('TO_REVIEW','PERSON_ONLY') AND resolved_at IS NULL) THEN
    RETURN jsonb_build_object('outcome','UNCHANGED');
  END IF;
  SELECT count(*), jsonb_agg(jsonb_build_object('id',id,'name',coalesce(display_name, first_name||' '||last_name))) INTO n, cands
    FROM people WHERE lower(email) = lower(trim(_email))
      AND (lower(coalesce(last_name,'')) = lower(coalesce(_last,'')) OR lower(coalesce(display_name,'')) LIKE '%'||lower(coalesce(_last,'#'))||'%');
  IF n > 1 OR (n = 0 AND EXISTS (SELECT 1 FROM people WHERE lower(email)=lower(trim(_email)))) THEN
    SELECT jsonb_agg(jsonb_build_object('id',id,'name',coalesce(display_name, first_name||' '||last_name))) INTO cands FROM people WHERE lower(email)=lower(trim(_email));
    INSERT INTO integration_events(source, external_id, outcome, message, candidates, payload)
      VALUES ('HELLOASSO',_ext_id,'TO_REVIEW','Correspondance ambiguë : validation humaine requise', cands, payload);
    RETURN jsonb_build_object('outcome','TO_REVIEW');
  END IF;
  IF n = 1 THEN SELECT (c->>'id')::uuid INTO pid FROM jsonb_array_elements(cands) c LIMIT 1;
  ELSE
    INSERT INTO people(first_name, last_name, display_name, email) VALUES (_first, _last, trim(coalesce(_first,'')||' '||coalesce(_last,'')), lower(trim(_email))) RETURNING id INTO pid;
  END IF;
  SELECT id INTO uid FROM profiles WHERE person_id = pid LIMIT 1;
  IF uid IS NULL THEN
    INSERT INTO integration_events(source, external_id, entity_type, entity_id, outcome, message, payload)
      VALUES ('HELLOASSO',_ext_id,'person',pid,'PERSON_ONLY','Personne sans compte : adhésion à rattacher à la création du compte', payload);
    RETURN jsonb_build_object('outcome','PERSON_ONLY','person_id',pid);
  END IF;
  INSERT INTO memberships(user_id, person_id, membership_type, status, start_date, end_date, source, external_id, notes)
    VALUES (uid, pid, coalesce(_type,'PARTICULIER'), 'ACTIVE', _start, _end, 'HELLOASSO', _ext_id, 'Import HelloAsso') RETURNING id INTO mid;
  IF coalesce(_amount,0) > 0 THEN
    INSERT INTO finance_entries(entry_date, direction, category, amount, person_id, membership_id, status, external_source, external_ref, description)
      VALUES (coalesce(_start,current_date),'RECETTE','ADHESION',_amount,pid,mid,'RECU','HELLOASSO',_ext_id,'Adhésion HelloAsso')
      ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO integration_events(source, external_id, entity_type, entity_id, outcome, payload) VALUES ('HELLOASSO',_ext_id,'membership',mid,'CREATED',payload);
  RETURN jsonb_build_object('outcome','CREATED','membership_id',mid);
END $$;