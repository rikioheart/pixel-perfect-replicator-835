-- Quantité réservée = pic d'occupation simultanée sur la période (et non la somme brute des chevauchements),
-- pour ne pas bloquer à tort deux réservations successives. L'usage ne change qu'aux dates de début :
-- le pic se trouve au début de la période ou au début d'une réservation incluse.
CREATE OR REPLACE FUNCTION public.inventory_reserved_quantity(_inventory_id uuid, _start date, _end date, _exclude uuid DEFAULT NULL)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH rs AS (
    SELECT r.quantity, r.start_date, r.end_date
    FROM public.inventory_reservations r
    WHERE r.inventory_id = _inventory_id
      AND r.status = 'ACTIVE'
      AND (_exclude IS NULL OR r.id <> _exclude)
      AND daterange(r.start_date, r.end_date, '[]') && daterange(_start, _end, '[]')
  ), pts AS (
    SELECT _start AS d
    UNION SELECT rs.start_date FROM rs WHERE rs.start_date > _start
  )
  SELECT COALESCE(MAX((
    SELECT COALESCE(SUM(rs.quantity), 0) FROM rs
    WHERE rs.start_date <= pts.d AND (rs.end_date IS NULL OR rs.end_date >= pts.d)
  )), 0)::integer
  FROM pts
$$;
REVOKE EXECUTE ON FUNCTION public.inventory_reserved_quantity(uuid, date, date, uuid) FROM PUBLIC, anon, authenticated;