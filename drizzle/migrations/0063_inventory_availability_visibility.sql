CREATE OR REPLACE FUNCTION public.inventory_availability(_start date DEFAULT CURRENT_DATE, _end date DEFAULT NULL::date)
 RETURNS TABLE(inventory_id uuid, stock integer, reserved integer, available integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT i.id, i.quantity,
         public.inventory_reserved_quantity(i.id, COALESCE(_start, current_date), _end, NULL),
         GREATEST(i.quantity - public.inventory_reserved_quantity(i.id, COALESCE(_start, current_date), _end, NULL), 0)
  FROM public.inventory i
  WHERE auth.uid() IS NOT NULL
    AND public.can_see_inventory(auth.uid(), i.visibility)
$function$;
REVOKE EXECUTE ON FUNCTION public.inventory_availability(date, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.inventory_availability(date, date) TO authenticated;