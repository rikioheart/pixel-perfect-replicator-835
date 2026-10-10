-- Suivi financier opérationnel (pas une comptabilité)
CREATE TABLE public.finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL DEFAULT current_date,
  direction text NOT NULL CHECK (direction IN ('RECETTE','DEPENSE')),
  category text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  description text,
  person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES public.terrain_reservations(id) ON DELETE SET NULL,
  membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  reimbursement_id uuid REFERENCES public.reimbursements(id) ON DELETE SET NULL,
  receipt_url text,
  payment_method text,
  status text NOT NULL DEFAULT 'A_RECEVOIR' CHECK (status IN ('A_RECEVOIR','RECU','A_PAYER','PAYE','TRANSMIS','ANNULE')),
  external_source text,
  external_ref text,
  internal_note text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX finance_entries_ext_uniq ON public.finance_entries(external_source, external_ref) WHERE external_ref IS NOT NULL;
CREATE UNIQUE INDEX finance_entries_reservation_uniq ON public.finance_entries(reservation_id) WHERE reservation_id IS NOT NULL AND status <> 'ANNULE';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_entries TO authenticated;
GRANT ALL ON public.finance_entries TO service_role;
ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY fe_bureau ON public.finance_entries FOR ALL TO authenticated
  USING (public.is_bureau(auth.uid()) AND public.has_permission(auth.uid(),'finance.read'))
  WITH CHECK (public.is_bureau(auth.uid()) AND public.has_permission(auth.uid(),'finance.read'));
CREATE POLICY fe_self ON public.finance_entries FOR SELECT TO authenticated
  USING (person_id IS NOT NULL AND person_id = public.current_person_id(auth.uid()));
CREATE TRIGGER fe_updated BEFORE UPDATE ON public.finance_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.finance_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (auth.uid(), 'finance.'||lower(TG_OP), 'finance_entry', coalesce(NEW.id, OLD.id),
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END, CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END);
  RETURN coalesce(NEW, OLD);
END $$;
REVOKE ALL ON FUNCTION public.finance_audit() FROM public, anon, authenticated;
CREATE TRIGGER fe_audit AFTER INSERT OR UPDATE OR DELETE ON public.finance_entries FOR EACH ROW EXECUTE FUNCTION public.finance_audit();

-- Journal des intégrations
CREATE TABLE public.integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  external_id text,
  entity_type text,
  entity_id uuid,
  outcome text NOT NULL CHECK (outcome IN ('CREATED','UPDATED','UNCHANGED','TO_REVIEW','PERSON_ONLY','ERROR','RESOLVED','EXPORTED')),
  message text,
  candidates jsonb,
  payload jsonb,
  resolved_by uuid,
  resolved_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX integration_events_src_idx ON public.integration_events(source, external_id);
GRANT SELECT, UPDATE ON public.integration_events TO authenticated;
GRANT ALL ON public.integration_events TO service_role;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ie_bureau_read ON public.integration_events FOR SELECT TO authenticated USING (public.is_bureau(auth.uid()));
CREATE POLICY ie_bureau_resolve ON public.integration_events FOR UPDATE TO authenticated USING (public.is_bureau(auth.uid()));

-- Import HelloAsso idempotent : jamais de fusion automatique en cas d'ambiguïté
CREATE OR REPLACE FUNCTION public.import_helloasso_membership(_ext_id text, _email text, _first text, _last text, _start date, _end date, _amount numeric, _type text DEFAULT 'PARTICULIER')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid; uid uuid; n int; mid uuid; existing public.memberships; outcome text; cands jsonb; payload jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_bureau(auth.uid()) THEN RAISE EXCEPTION 'Réservé au Bureau'; END IF;
  payload := jsonb_build_object('email',_email,'first',_first,'last',_last,'start',_start,'end',_end,'amount',_amount,'type',_type);
  IF coalesce(_ext_id,'') = '' THEN
    INSERT INTO integration_events(source, outcome, message, payload) VALUES ('HELLOASSO','ERROR','Identifiant HelloAsso manquant', payload);
    RETURN jsonb_build_object('outcome','ERROR');
  END IF;
  SELECT * INTO existing FROM memberships WHERE source='HELLOASSO' AND external_id=_ext_id;
  IF existing.id IS NOT NULL THEN
    IF existing.start_date IS NOT DISTINCT FROM _start AND existing.end_date IS NOT DISTINCT FROM _end THEN outcome := 'UNCHANGED';
    ELSE UPDATE memberships SET start_date=_start, end_date=_end WHERE id=existing.id; outcome := 'UPDATED'; END IF;
    INSERT INTO integration_events(source, external_id, entity_type, entity_id, outcome, payload) VALUES ('HELLOASSO',_ext_id,'membership',existing.id,outcome,payload);
    RETURN jsonb_build_object('outcome',outcome,'membership_id',existing.id);
  END IF;
  -- déjà en attente de validation pour ce même identifiant : pas de doublon
  IF EXISTS (SELECT 1 FROM integration_events WHERE source='HELLOASSO' AND external_id=_ext_id AND outcome IN ('TO_REVIEW','PERSON_ONLY') AND resolved_at IS NULL) THEN
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
REVOKE ALL ON FUNCTION public.import_helloasso_membership(text,text,text,text,date,date,numeric,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.import_helloasso_membership(text,text,text,text,date,date,numeric,text) TO authenticated, service_role;

-- Traçabilité IA (propositions importantes seulement)
CREATE TABLE public.ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  action text NOT NULL,
  context_type text,
  context_id uuid,
  proposal text NOT NULL,
  final_text text,
  status text NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED','VALIDATED','REJECTED')),
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ai_suggestions TO authenticated;
GRANT ALL ON public.ai_suggestions TO service_role;
ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_own_read ON public.ai_suggestions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY ai_own_insert ON public.ai_suggestions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY ai_own_update ON public.ai_suggestions FOR UPDATE TO authenticated USING (user_id = auth.uid());