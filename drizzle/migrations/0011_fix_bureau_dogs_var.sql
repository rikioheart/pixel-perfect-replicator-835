CREATE OR REPLACE FUNCTION public.bureau_dogs()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); can_full boolean;
BEGIN
  IF NOT public.is_bureau(me) THEN RAISE EXCEPTION 'Réservé au Bureau'; END IF;
  can_full := public.bureau_dog_full(me);
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', d.id, 'name', d.name, 'breed', d.breed, 'sex', d.sex,
    'household', h.name, 'owner', COALESCE(p.display_name, trim(concat(p.first_name,' ',p.last_name))),
    'full', can_full, 'private_sections', d.private_sections,
    'info', CASE WHEN can_full AND NOT ('info' = ANY (d.private_sections)) THEN jsonb_build_object('character', d.character, 'needs', d.needs, 'useful_information', d.useful_information) END,
    'goals', CASE WHEN can_full AND NOT ('goals' = ANY (d.private_sections)) THEN (SELECT COALESCE(jsonb_agg(jsonb_build_object('title', g.title, 'status', g.status)), '[]'::jsonb) FROM public.dog_goals g WHERE g.dog_id = d.id) END,
    'observations', CASE WHEN can_full AND NOT ('observations' = ANY (d.private_sections)) THEN (SELECT COALESCE(jsonb_agg(jsonb_build_object('body', o.body, 'created_at', o.created_at) ORDER BY o.created_at DESC), '[]'::jsonb) FROM public.dog_observations o WHERE o.dog_id = d.id) END
  ) ORDER BY d.name) FROM public.dogs d LEFT JOIN public.households h ON h.id = d.household_id LEFT JOIN public.profiles p ON p.id = d.owner_id), '[]'::jsonb);
END $$;