ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS archived_at timestamptz, ADD COLUMN IF NOT EXISTS archive_reason text;

CREATE OR REPLACE FUNCTION public.retire_inventory_item(_inventory_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _q integer;
BEGIN
  IF NOT public.is_bureau(auth.uid()) THEN RAISE EXCEPTION 'Réservé au Bureau.' USING ERRCODE = '42501'; END IF;
  SELECT quantity INTO _q FROM public.inventory WHERE id = _inventory_id AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Article introuvable ou déjà sorti.'; END IF;
  IF EXISTS (SELECT 1 FROM public.inventory_reservations WHERE inventory_id = _inventory_id AND status = 'ACTIVE') THEN
    RAISE EXCEPTION 'Sortie refusée : des réservations sont encore en cours. Clôturez-les d''abord.';
  END IF;
  IF _q > 0 THEN
    PERFORM set_config('lvdc.inventory_reason', COALESCE('Sortie définitive : ' || left(btrim(_reason), 480), 'Sortie définitive'), true);
    UPDATE public.inventory SET quantity = 0, updated_at = now() WHERE id = _inventory_id;
    PERFORM set_config('lvdc.inventory_reason', '', true);
  END IF;
  UPDATE public.inventory SET archived_at = now(), archive_reason = NULLIF(left(btrim(_reason), 500), '') WHERE id = _inventory_id;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'INVENTORY_RETIRED', 'inventory', _inventory_id, jsonb_build_object('reason', _reason, 'quantity', _q));
END $$;

CREATE OR REPLACE FUNCTION public.delete_inventory_item(_inventory_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  IF NOT public.is_bureau(auth.uid()) THEN RAISE EXCEPTION 'Réservé au Bureau.' USING ERRCODE = '42501'; END IF;
  SELECT name INTO _name FROM public.inventory WHERE id = _inventory_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Article introuvable.'; END IF;
  IF EXISTS (SELECT 1 FROM public.inventory_reservations WHERE inventory_id = _inventory_id) THEN
    RAISE EXCEPTION 'Suppression refusée : cet article a servi à des projets. Utilisez la sortie définitive pour garder l''historique.';
  END IF;
  DELETE FROM public.inventory_movements WHERE inventory_id = _inventory_id;
  DELETE FROM public.inventory WHERE id = _inventory_id;
  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'INVENTORY_DELETED', 'inventory', _inventory_id, jsonb_build_object('name', _name));
END $$;

REVOKE EXECUTE ON FUNCTION public.retire_inventory_item(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_inventory_item(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retire_inventory_item(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_inventory_item(uuid) TO authenticated;