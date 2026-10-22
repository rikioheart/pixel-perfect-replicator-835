-- LOT A : droits financiers explicites (Bureau ET permission), transitions de remboursement contrôlées,
-- décision d'adhésion par fonction transactionnelle tracée. Aucune table ni donnée supprimée.

-- 1. Aide unique : être au Bureau ne suffit pas, la permission précise est exigée.
CREATE OR REPLACE FUNCTION public.bureau_has_permission(_user_id uuid, _code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_bureau(_user_id) AND public.has_permission(_user_id, _code)
$$;
REVOKE EXECUTE ON FUNCTION public.bureau_has_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bureau_has_permission(uuid, text) TO authenticated, service_role;

-- 2. Comptabilité (recettes, répartitions, reversements pro).
DROP POLICY IF EXISTS accounting_manage ON public.accounting;
DROP POLICY IF EXISTS accounting_select ON public.accounting;
CREATE POLICY accounting_select ON public.accounting FOR SELECT TO authenticated
  USING (public.bureau_has_permission(auth.uid(), 'finance.view_global') OR professional_id = auth.uid());
CREATE POLICY accounting_insert ON public.accounting FOR INSERT TO authenticated
  WITH CHECK (public.bureau_has_permission(auth.uid(), 'finance.update'));
CREATE POLICY accounting_update ON public.accounting FOR UPDATE TO authenticated
  USING (public.bureau_has_permission(auth.uid(), 'finance.update'))
  WITH CHECK (public.bureau_has_permission(auth.uid(), 'finance.update'));
CREATE POLICY accounting_delete ON public.accounting FOR DELETE TO authenticated
  USING (public.bureau_has_permission(auth.uid(), 'finance.update'));

CREATE OR REPLACE FUNCTION public.guard_accounting()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RETURN coalesce(NEW, OLD); END IF;
  IF TG_OP = 'UPDATE' AND NEW.professional_paid_at IS DISTINCT FROM OLD.professional_paid_at
     AND OLD.professional_id = me THEN
    RAISE EXCEPTION 'Vous ne pouvez pas marquer votre propre reversement comme payé';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.professional_paid_at IS NOT NULL AND NEW.professional_id = me THEN
    RAISE EXCEPTION 'Vous ne pouvez pas marquer votre propre reversement comme payé';
  END IF;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (me, 'accounting.'||lower(TG_OP), 'accounting', coalesce(NEW.id, OLD.id),
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END, CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END);
  RETURN coalesce(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_accounting_guard ON public.accounting;
CREATE TRIGGER trg_accounting_guard BEFORE INSERT OR UPDATE OR DELETE ON public.accounting
  FOR EACH ROW EXECUTE FUNCTION public.guard_accounting();

-- 3. Remboursements : lecture globale et décisions selon permissions distinctes.
DROP POLICY IF EXISTS reimb_select ON public.reimbursements;
DROP POLICY IF EXISTS reimb_insert ON public.reimbursements;
DROP POLICY IF EXISTS reimb_update ON public.reimbursements;
DROP POLICY IF EXISTS reimb_delete ON public.reimbursements;
CREATE POLICY reimb_select ON public.reimbursements FOR SELECT TO authenticated
  USING (person_id = auth.uid()
    OR public.bureau_has_permission(auth.uid(), 'finance.view_global')
    OR public.bureau_has_permission(auth.uid(), 'reimbursements.validate')
    OR public.bureau_has_permission(auth.uid(), 'reimbursements.mark_paid'));
CREATE POLICY reimb_insert ON public.reimbursements FOR INSERT TO authenticated
  WITH CHECK (person_id = auth.uid() OR public.bureau_has_permission(auth.uid(), 'finance.create'));
CREATE POLICY reimb_update ON public.reimbursements FOR UPDATE TO authenticated
  USING ((person_id = auth.uid() AND status = 'PENDING')
    OR public.bureau_has_permission(auth.uid(), 'reimbursements.validate')
    OR public.bureau_has_permission(auth.uid(), 'reimbursements.mark_paid'))
  WITH CHECK ((person_id = auth.uid() AND status = 'PENDING')
    OR public.bureau_has_permission(auth.uid(), 'reimbursements.validate')
    OR public.bureau_has_permission(auth.uid(), 'reimbursements.mark_paid'));
CREATE POLICY reimb_delete ON public.reimbursements FOR DELETE TO authenticated
  USING (public.bureau_has_permission(auth.uid(), 'finance.update')
    OR (person_id = auth.uid() AND status = 'PENDING'));

CREATE OR REPLACE FUNCTION public.guard_reimbursement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); old_s text; new_s text;
BEGIN
  IF me IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    -- Toute demande naît en attente, même saisie par le Bureau pour quelqu'un d'autre.
    NEW.status := 'PENDING'; NEW.processed_by := NULL;
    RETURN NEW;
  END IF;
  IF NEW.person_id IS DISTINCT FROM OLD.person_id THEN
    RAISE EXCEPTION 'Le demandeur ne peut pas être changé';
  END IF;
  IF NEW.label IS DISTINCT FROM OLD.label OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.receipt_url IS DISTINCT FROM OLD.receipt_url THEN
    IF OLD.person_id <> me THEN RAISE EXCEPTION 'Seul le demandeur peut modifier sa demande'; END IF;
    IF OLD.status <> 'PENDING' THEN RAISE EXCEPTION 'Une demande déjà traitée ne peut plus être modifiée'; END IF;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.processed_by IS DISTINCT FROM OLD.processed_by THEN
    IF OLD.person_id = me THEN
      RAISE EXCEPTION 'Vous ne pouvez pas traiter votre propre demande de remboursement';
    END IF;
    old_s := CASE WHEN OLD.status = 'REFUSED' THEN 'REJECTED' ELSE OLD.status END;
    new_s := CASE WHEN NEW.status = 'REFUSED' THEN 'REJECTED' ELSE NEW.status END;
    IF old_s = 'PAID' THEN RAISE EXCEPTION 'Une demande payée ne peut plus changer de statut'; END IF;
    IF old_s = 'REJECTED' THEN RAISE EXCEPTION 'Une demande refusée ne peut plus changer de statut'; END IF;
    IF old_s = 'PENDING' AND new_s IN ('APPROVED', 'REJECTED') THEN
      IF NOT public.bureau_has_permission(me, 'reimbursements.validate') THEN
        RAISE EXCEPTION 'Droit de validation des remboursements requis';
      END IF;
    ELSIF old_s = 'APPROVED' AND new_s = 'REJECTED' THEN
      IF NOT public.bureau_has_permission(me, 'reimbursements.validate') THEN
        RAISE EXCEPTION 'Droit de validation des remboursements requis';
      END IF;
    ELSIF old_s = 'APPROVED' AND new_s = 'PAID' THEN
      IF NOT public.bureau_has_permission(me, 'reimbursements.mark_paid') THEN
        RAISE EXCEPTION 'Droit de paiement des remboursements requis';
      END IF;
    ELSIF old_s = 'PENDING' AND new_s = 'PAID' THEN
      RAISE EXCEPTION 'La demande doit être approuvée avant d''être payée';
    ELSE
      RAISE EXCEPTION 'Transition de statut non autorisée';
    END IF;
    NEW.status := new_s;
    NEW.processed_by := me;
    INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (me, 'reimbursement.' || lower(new_s), 'reimbursement', OLD.id,
      jsonb_build_object('status', OLD.status), jsonb_build_object('status', new_s, 'amount', NEW.amount));
  END IF;
  RETURN NEW;
END $$;

-- 4. Suivi opérationnel : lecture et écriture séparées ; la personne ne lit plus les notes internes.
DROP POLICY IF EXISTS fe_bureau ON public.finance_entries;
DROP POLICY IF EXISTS fe_self ON public.finance_entries;
CREATE POLICY fe_select ON public.finance_entries FOR SELECT TO authenticated
  USING (public.bureau_has_permission(auth.uid(), 'finance.view_global'));
CREATE POLICY fe_insert ON public.finance_entries FOR INSERT TO authenticated
  WITH CHECK (public.bureau_has_permission(auth.uid(), 'finance.create'));
CREATE POLICY fe_update ON public.finance_entries FOR UPDATE TO authenticated
  USING (public.bureau_has_permission(auth.uid(), 'finance.update'))
  WITH CHECK (public.bureau_has_permission(auth.uid(), 'finance.update'));
CREATE POLICY fe_delete ON public.finance_entries FOR DELETE TO authenticated
  USING (public.bureau_has_permission(auth.uid(), 'finance.update'));

-- 5. Journal d'import HelloAsso (e-mails, candidats) : droit adhésions ou finances requis.
DROP POLICY IF EXISTS ie_bureau_read ON public.integration_events;
DROP POLICY IF EXISTS ie_bureau_resolve ON public.integration_events;
CREATE POLICY ie_select ON public.integration_events FOR SELECT TO authenticated
  USING (public.bureau_has_permission(auth.uid(), 'finance.view_global')
    OR public.bureau_has_permission(auth.uid(), 'members.validate'));
CREATE POLICY ie_resolve ON public.integration_events FOR UPDATE TO authenticated
  USING (public.bureau_has_permission(auth.uid(), 'finance.update')
    OR public.bureau_has_permission(auth.uid(), 'members.validate'))
  WITH CHECK (public.bureau_has_permission(auth.uid(), 'finance.update')
    OR public.bureau_has_permission(auth.uid(), 'members.validate'));

-- 6. Adhésions : une demande en attente ne se décide que par decide_membership.
CREATE OR REPLACE FUNCTION public.guard_profile_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); via_decision boolean := coalesce(current_setting('lvdc.membership_decision', true), '') = 'on';
BEGIN
  IF me IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF public.is_bureau(me) AND NEW.id <> me THEN RETURN NEW; END IF;
    NEW.membership_status := 'PENDING';
    NEW.statutory_category := 'ACTIF';
    IF NEW.membership_type NOT IN ('PARTICULIER','PROFESSIONNEL') THEN NEW.membership_type := 'PARTICULIER'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.membership_type IS DISTINCT FROM OLD.membership_type
     OR NEW.membership_status IS DISTINCT FROM OLD.membership_status
     OR NEW.statutory_category IS DISTINCT FROM OLD.statutory_category THEN
    IF NOT public.is_bureau(me) THEN
      RAISE EXCEPTION 'Seul le Bureau peut modifier le type, le statut ou la catégorie d''adhésion';
    END IF;
    IF NEW.id = me THEN
      RAISE EXCEPTION 'Vous ne pouvez pas modifier votre propre adhésion';
    END IF;
    IF NEW.membership_status IS DISTINCT FROM OLD.membership_status THEN
      IF NOT public.bureau_has_permission(me, 'members.validate') THEN
        RAISE EXCEPTION 'Droit de validation des adhésions requis';
      END IF;
      IF OLD.membership_status = 'PENDING' AND NOT via_decision THEN
        RAISE EXCEPTION 'Une demande d''adhésion se traite depuis la file « Adhésions à valider »';
      END IF;
    END IF;
    IF NOT via_decision THEN
      INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, old_values, new_values)
      VALUES (me, 'membership.update', 'profile', NEW.id,
        jsonb_build_object('membership_type', OLD.membership_type, 'membership_status', OLD.membership_status, 'statutory_category', OLD.statutory_category),
        jsonb_build_object('membership_type', NEW.membership_type, 'membership_status', NEW.membership_status, 'statutory_category', NEW.statutory_category));
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.decide_membership(_profile_id uuid, _decision text, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); cur text; note text := nullif(left(trim(coalesce(_reason, '')), 500), '');
BEGIN
  IF me IS NULL OR NOT public.bureau_has_permission(me, 'members.validate') THEN
    RAISE EXCEPTION 'Droit de validation des adhésions requis' USING ERRCODE = '42501';
  END IF;
  IF _decision IS NULL OR _decision NOT IN ('ACTIVE', 'REFUSED') THEN
    RAISE EXCEPTION 'Décision invalide' USING ERRCODE = '22023';
  END IF;
  IF _profile_id = me THEN
    RAISE EXCEPTION 'Vous ne pouvez pas valider votre propre adhésion' USING ERRCODE = '42501';
  END IF;
  -- Verrou de ligne : deux décisions simultanées sont traitées l'une après l'autre.
  SELECT membership_status INTO cur FROM public.profiles WHERE id = _profile_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'NOT_FOUND'); END IF;
  IF cur <> 'PENDING' THEN RETURN jsonb_build_object('ok', false, 'reason', 'ALREADY_PROCESSED', 'status', cur); END IF;
  PERFORM set_config('lvdc.membership_decision', 'on', true);
  UPDATE public.profiles SET membership_status = _decision WHERE id = _profile_id;
  PERFORM set_config('lvdc.membership_decision', '', true);
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, old_values, new_values, metadata)
  VALUES (me, 'membership.' || lower(_decision), 'profile', _profile_id,
    jsonb_build_object('membership_status', cur), jsonb_build_object('membership_status', _decision),
    CASE WHEN note IS NOT NULL THEN jsonb_build_object('reason', note) END);
  PERFORM public.notify_member(_profile_id, me, 'MEMBERSHIP_DECISION',
    CASE WHEN _decision = 'ACTIVE' THEN 'Adhésion validée' ELSE 'Demande d''adhésion' END,
    CASE WHEN _decision = 'ACTIVE' THEN 'Bienvenue ! Le Bureau a validé votre adhésion.'
         ELSE 'Votre demande n''a pas été retenue pour le moment. Le Bureau reste disponible pour en parler.' END,
    'profile', _profile_id, '/my-space', interval '0');
  RETURN jsonb_build_object('ok', true, 'status', _decision);
END $$;
REVOKE EXECUTE ON FUNCTION public.decide_membership(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_membership(uuid, text, text) TO authenticated, service_role;

COMMENT ON TABLE public.accounting IS 'Comptabilité des recettes : brut, part association, part professionnelle et reversement (professional_paid_at). Source de vérité des reversements pro.';
COMMENT ON TABLE public.finance_entries IS 'Suivi opérationnel (à recevoir, à payer, transmis) et export vers l''outil comptable ; jamais additionné à accounting.';
COMMENT ON TABLE public.reimbursements IS 'Demandes de remboursement des membres : PENDING -> APPROVED/REJECTED, APPROVED -> PAID/REJECTED. Source de vérité des remboursements.';