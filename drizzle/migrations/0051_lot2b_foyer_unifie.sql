-- Personnes du foyer sans compte : nom, date de naissance, lien.
ALTER TABLE public.household_children ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.household_children ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE public.household_children ADD COLUMN IF NOT EXISTS relation text NOT NULL DEFAULT 'ENFANT';
ALTER TABLE public.household_children DROP CONSTRAINT IF EXISTS household_children_relation_chk;
ALTER TABLE public.household_children ADD CONSTRAINT household_children_relation_chk CHECK (relation IN ('ENFANT','CONJOINT','PARENT','AUTRE'));
COMMENT ON TABLE public.household_children IS 'Personnes du foyer sans compte (enfants, conjoint, parent, autre).';
COMMENT ON COLUMN public.household_children.birth_year IS 'DEPRECATED: remplacé par birth_date (conservé pour les anciennes fiches).';

-- Fiche chien enrichie + personne de référence sans compte.
ALTER TABLE public.dogs ADD COLUMN IF NOT EXISTS keeper_person_id uuid REFERENCES public.household_children(id) ON DELETE SET NULL;
ALTER TABLE public.dogs ADD COLUMN IF NOT EXISTS identification text;
ALTER TABLE public.dogs ADD COLUMN IF NOT EXISTS coat_color text;
ALTER TABLE public.dogs ADD COLUMN IF NOT EXISTS weight_kg numeric(5,1);
ALTER TABLE public.dogs ADD COLUMN IF NOT EXISTS arrival_date date;
ALTER TABLE public.dogs DROP CONSTRAINT IF EXISTS dogs_weight_chk;
ALTER TABLE public.dogs ADD CONSTRAINT dogs_weight_chk CHECK (weight_kg IS NULL OR (weight_kg > 0 AND weight_kg < 150));

CREATE OR REPLACE FUNCTION public.check_dog_keeper() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.keeper_person_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.household_children c WHERE c.id = NEW.keeper_person_id AND c.household_id = NEW.household_id
  ) THEN
    RAISE EXCEPTION 'La personne de référence doit faire partie du foyer du chien.';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.check_dog_keeper() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS check_dog_keeper ON public.dogs;
CREATE TRIGGER check_dog_keeper BEFORE INSERT OR UPDATE OF keeper_person_id, household_id ON public.dogs
FOR EACH ROW EXECUTE FUNCTION public.check_dog_keeper();

-- Un seul foyer par membre (les doublons existants restent, à régulariser par le Bureau).
CREATE OR REPLACE FUNCTION public.guard_single_household() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.household_members m WHERE m.user_id = NEW.user_id AND m.household_id <> NEW.household_id) THEN
    RAISE EXCEPTION 'Cette personne fait déjà partie d''un foyer : un seul foyer par membre.';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_single_household() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_single_household ON public.household_members;
CREATE TRIGGER guard_single_household BEFORE INSERT OR UPDATE OF user_id, household_id ON public.household_members
FOR EACH ROW EXECUTE FUNCTION public.guard_single_household();

-- Vue Bureau : mêmes protections qu'avant, enrichie (foyer, référent, nouvelles infos, archivage).
CREATE OR REPLACE FUNCTION public.bureau_dogs()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); can_full boolean;
BEGIN
  IF NOT public.is_bureau(me) THEN RAISE EXCEPTION 'Réservé au Bureau'; END IF;
  can_full := public.bureau_dog_full(me);
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', d.id, 'name', d.name, 'breed', d.breed, 'sex', d.sex,
    'household_id', d.household_id, 'household', h.name,
    'owner', COALESCE(p.display_name, trim(concat(p.first_name,' ',p.last_name))),
    'keeper', CASE WHEN k.id IS NOT NULL THEN trim(concat(k.first_name,' ',k.last_name)) END,
    'archived_at', d.archived_at,
    'full', can_full, 'private_sections', d.private_sections,
    'info', CASE WHEN can_full AND NOT ('info' = ANY (d.private_sections)) THEN jsonb_build_object(
      'character', d.character, 'needs', d.needs, 'useful_information', d.useful_information,
      'identification', d.identification, 'coat_color', d.coat_color, 'weight_kg', d.weight_kg,
      'arrival_date', d.arrival_date, 'birth_date', d.birth_date, 'sterilization', d.sterilization,
      'living_environment', d.living_environment) END,
    'indicators', CASE WHEN can_full THEN (SELECT COALESCE(jsonb_agg(jsonb_build_object('family', i.family, 'label', i.label)), '[]'::jsonb) FROM public.dog_indicators i WHERE i.dog_id = d.id) END,
    'goals', CASE WHEN can_full AND NOT ('goals' = ANY (d.private_sections)) THEN (SELECT COALESCE(jsonb_agg(jsonb_build_object('title', g.title, 'status', g.status)), '[]'::jsonb) FROM public.dog_goals g WHERE g.dog_id = d.id) END,
    'observations', CASE WHEN can_full AND NOT ('observations' = ANY (d.private_sections)) THEN (SELECT COALESCE(jsonb_agg(jsonb_build_object('body', o.body, 'created_at', o.created_at) ORDER BY o.created_at DESC), '[]'::jsonb) FROM public.dog_observations o WHERE o.dog_id = d.id) END
  ) ORDER BY d.archived_at NULLS FIRST, d.name)
  FROM public.dogs d
  LEFT JOIN public.households h ON h.id = d.household_id
  LEFT JOIN public.profiles p ON p.id = d.owner_id
  LEFT JOIN public.household_children k ON k.id = d.keeper_person_id), '[]'::jsonb);
END $function$;
REVOKE EXECUTE ON FUNCTION public.bureau_dogs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bureau_dogs() TO authenticated;