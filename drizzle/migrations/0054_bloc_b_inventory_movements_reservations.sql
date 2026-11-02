-- Bloc B — Inventaire : champs facultatifs, mouvements tracés, réservations par projet sans surréservation.
-- Strictement additif : aucune colonne supprimée, aucune donnée effacée.

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS condition text,
  ADD COLUMN IF NOT EXISTS referent_person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS document_url text,
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.inventory ADD CONSTRAINT inventory_type_check
  CHECK (type IS NULL OR type IN ('MATERIEL','EQUIPEMENT','CONSOMMABLE','VENTE'));
ALTER TABLE public.inventory ADD CONSTRAINT inventory_condition_check
  CHECK (condition IS NULL OR condition IN ('NEUF','BON','USAGE','A_REPARER'));
ALTER TABLE public.inventory ADD CONSTRAINT inventory_unit_price_check
  CHECK (unit_price IS NULL OR unit_price >= 0);
ALTER TABLE public.inventory ADD CONSTRAINT inventory_document_url_check
  CHECK (document_url IS NULL OR document_url ~* '^https?://');
ALTER TABLE public.inventory ADD CONSTRAINT inventory_quantity_nonneg
  CHECK (quantity >= 0 AND alert_threshold >= 0);

-- ---------------------------------------------------------------------------
-- Mouvements : journal en lecture seule, alimenté uniquement par déclencheur.
CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid NOT NULL REFERENCES public.inventory(id) ON DELETE RESTRICT,
  quantity_change integer NOT NULL CHECK (quantity_change <> 0),
  reason text CHECK (reason IS NULL OR char_length(reason) <= 500),
  actor_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inventory_movements_item_idx ON public.inventory_movements (inventory_id, created_at DESC);

GRANT SELECT ON public.inventory_movements TO authenticated;
GRANT UPDATE (reason) ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY inv_mov_select ON public.inventory_movements FOR SELECT TO authenticated
  USING (public.is_bureau(auth.uid()));
-- Seul le motif peut être complété plus tard (droit de colonne), par le Bureau.
CREATE POLICY inv_mov_update_reason ON public.inventory_movements FOR UPDATE TO authenticated
  USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));

-- ---------------------------------------------------------------------------
-- Réservations de matériel par projet.
CREATE TABLE public.inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid NOT NULL REFERENCES public.inventory(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','RETURNED','CANCELLED')),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX inventory_reservations_active_idx ON public.inventory_reservations (inventory_id) WHERE status = 'ACTIVE';
CREATE INDEX inventory_reservations_project_idx ON public.inventory_reservations (project_id);

GRANT SELECT, INSERT, UPDATE ON public.inventory_reservations TO authenticated;
GRANT ALL ON public.inventory_reservations TO service_role;
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY inv_resv_select ON public.inventory_reservations FOR SELECT TO authenticated
  USING (public.is_bureau(auth.uid()) OR public.is_project_coordinator(auth.uid(), project_id));
CREATE POLICY inv_resv_insert ON public.inventory_reservations FOR INSERT TO authenticated
  WITH CHECK (public.is_bureau(auth.uid()) OR public.is_project_coordinator(auth.uid(), project_id));
CREATE POLICY inv_resv_update ON public.inventory_reservations FOR UPDATE TO authenticated
  USING (public.is_bureau(auth.uid()) OR public.is_project_coordinator(auth.uid(), project_id))
  WITH CHECK (public.is_bureau(auth.uid()) OR public.is_project_coordinator(auth.uid(), project_id));

-- ---------------------------------------------------------------------------
-- Quantité réservée (ACTIVE) qui chevauche une période ; fin NULL = sans fin.
CREATE OR REPLACE FUNCTION public.inventory_reserved_quantity(_inventory_id uuid, _start date, _end date, _exclude uuid DEFAULT NULL)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(r.quantity), 0)::integer
  FROM public.inventory_reservations r
  WHERE r.inventory_id = _inventory_id
    AND r.status = 'ACTIVE'
    AND (_exclude IS NULL OR r.id <> _exclude)
    AND daterange(r.start_date, r.end_date, '[]') && daterange(_start, _end, '[]')
$$;
REVOKE EXECUTE ON FUNCTION public.inventory_reserved_quantity(uuid, date, date, uuid) FROM PUBLIC, anon, authenticated;

-- Garde des réservations : verrou de la ligne d'inventaire puis contrôle de disponibilité.
CREATE OR REPLACE FUNCTION public.guard_inventory_reservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _stock integer; _reserved integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.created_at := now();
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;

  IF NEW.status <> 'ACTIVE' THEN
    RETURN NEW; -- RETURNED / CANCELLED ne consomment pas de stock
  END IF;

  -- En REPEATABLE READ, l'instantané figé ne verrait pas une réservation concurrente validée : on refuse.
  IF current_setting('transaction_isolation') = 'repeatable read' THEN
    RAISE EXCEPTION 'Réservation de matériel impossible dans ce mode de transaction.' USING ERRCODE = '40001';
  END IF;

  -- Verrou exclusif : toutes les réservations et sorties de stock d'un même article sont sérialisées.
  SELECT quantity INTO _stock FROM public.inventory WHERE id = NEW.inventory_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Article introuvable.'; END IF;

  -- Nouvel instantané (READ COMMITTED) pris après le verrou : inclut les réservations validées entre-temps.
  _reserved := public.inventory_reserved_quantity(NEW.inventory_id, NEW.start_date, NEW.end_date,
                 CASE WHEN TG_OP = 'UPDATE' THEN OLD.id END);

  IF _reserved + NEW.quantity > _stock THEN
    RAISE EXCEPTION 'Stock insuffisant : % disponible(s) sur cette période, % demandé(s).',
      GREATEST(_stock - _reserved, 0), NEW.quantity USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_inventory_reservation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER a_guard_inventory_reservation
  BEFORE INSERT OR UPDATE ON public.inventory_reservations
  FOR EACH ROW EXECUTE FUNCTION public.guard_inventory_reservation();

-- Garde du stock : une baisse ne peut pas passer sous les réservations actives en cours ou à venir.
CREATE OR REPLACE FUNCTION public.guard_inventory_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _reserved integer;
BEGIN
  IF NEW.quantity < OLD.quantity THEN
    _reserved := public.inventory_reserved_quantity(NEW.id, current_date, NULL, NULL);
    IF NEW.quantity < _reserved THEN
      RAISE EXCEPTION 'Sortie refusée : % unité(s) réservée(s) pour des projets. Libérez une réservation avant.',
        _reserved USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_inventory_stock() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER a_guard_inventory_stock
  BEFORE UPDATE OF quantity ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.guard_inventory_stock();

-- Journal automatique : toute création ou variation de quantité laisse un mouvement.
CREATE OR REPLACE FUNCTION public.log_inventory_movement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _change integer; _reason text := NULLIF(current_setting('lvdc.inventory_reason', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    _change := NEW.quantity;
    _reason := COALESCE(_reason, 'Stock initial');
  ELSE
    _change := NEW.quantity - OLD.quantity;
  END IF;
  IF _change <> 0 THEN
    INSERT INTO public.inventory_movements (inventory_id, quantity_change, reason, actor_id)
    VALUES (NEW.id, _change, left(_reason, 500), auth.uid());
  END IF;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.log_inventory_movement() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER z_log_inventory_movement
  AFTER INSERT OR UPDATE OF quantity ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.log_inventory_movement();

-- Entrée / sortie atomique (quantity = quantity + n), motif facultatif. Bureau uniquement.
CREATE OR REPLACE FUNCTION public.adjust_inventory_stock(_inventory_id uuid, _change integer, _reason text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new integer;
BEGIN
  IF NOT public.is_bureau(auth.uid()) THEN RAISE EXCEPTION 'Réservé au Bureau.' USING ERRCODE = '42501'; END IF;
  IF _change IS NULL OR _change = 0 THEN RAISE EXCEPTION 'Quantité de mouvement invalide.'; END IF;
  PERFORM set_config('lvdc.inventory_reason', COALESCE(left(btrim(_reason), 500), ''), true);
  UPDATE public.inventory SET quantity = quantity + _change, updated_at = now()
    WHERE id = _inventory_id RETURNING quantity INTO _new;
  IF NOT FOUND THEN RAISE EXCEPTION 'Article introuvable.'; END IF;
  PERFORM set_config('lvdc.inventory_reason', '', true);
  RETURN _new;
EXCEPTION WHEN check_violation THEN
  IF SQLERRM LIKE 'Sortie refusée%' THEN RAISE; END IF;
  RAISE EXCEPTION 'Stock insuffisant pour cette sortie.' USING ERRCODE = '23514';
END $$;
REVOKE EXECUTE ON FUNCTION public.adjust_inventory_stock(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_inventory_stock(uuid, integer, text) TO authenticated;

-- Disponibilité agrégée (aucun détail de projet) pour tous les comptes connectés.
CREATE OR REPLACE FUNCTION public.inventory_availability(_start date DEFAULT current_date, _end date DEFAULT NULL)
RETURNS TABLE (inventory_id uuid, stock integer, reserved integer, available integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, i.quantity,
         public.inventory_reserved_quantity(i.id, COALESCE(_start, current_date), _end, NULL),
         GREATEST(i.quantity - public.inventory_reserved_quantity(i.id, COALESCE(_start, current_date), _end, NULL), 0)
  FROM public.inventory i
  WHERE auth.uid() IS NOT NULL
$$;
REVOKE EXECUTE ON FUNCTION public.inventory_availability(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inventory_availability(date, date) TO authenticated;