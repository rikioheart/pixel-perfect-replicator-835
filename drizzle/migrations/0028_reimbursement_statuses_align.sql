CREATE OR REPLACE FUNCTION public.guard_reimbursement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_bureau(me) OR NEW.person_id = me THEN
      NEW.status := 'PENDING'; NEW.processed_by := NULL;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.processed_by IS DISTINCT FROM OLD.processed_by THEN
    IF NOT public.is_bureau(me) THEN RAISE EXCEPTION 'Seul le Bureau peut traiter une demande de remboursement'; END IF;
    IF OLD.person_id = me THEN RAISE EXCEPTION 'Vous ne pouvez pas traiter votre propre demande de remboursement'; END IF;
    IF NEW.status NOT IN ('PENDING','APPROVED','REJECTED','REFUSED','PAID') THEN RAISE EXCEPTION 'Statut de remboursement invalide'; END IF;
    IF OLD.status = 'PAID' THEN RAISE EXCEPTION 'Une demande payée ne peut plus changer de statut'; END IF;
    IF NEW.status = 'PAID' AND OLD.status NOT IN ('PENDING','APPROVED') THEN RAISE EXCEPTION 'Une demande refusée ne peut pas être payée'; END IF;
    NEW.processed_by := me;
  ELSIF OLD.person_id = me AND OLD.status <> 'PENDING' AND NOT public.is_bureau(me) THEN
    RAISE EXCEPTION 'Une demande déjà traitée ne peut plus être modifiée';
  END IF;
  IF NEW.person_id IS DISTINCT FROM OLD.person_id AND NOT public.is_bureau(me) THEN
    RAISE EXCEPTION 'Le demandeur ne peut pas être changé';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_reimbursement() FROM PUBLIC, anon, authenticated;