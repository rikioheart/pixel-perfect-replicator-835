ALTER TABLE public.dogs ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.dogs ADD COLUMN IF NOT EXISTS archived_reason text;
GRANT SELECT (archived_at, archived_reason), UPDATE (archived_at, archived_reason) ON public.dogs TO authenticated;

-- Un chien ayant un historique de participation ne peut plus être supprimé (cascade destructrice) : il s'archive.
CREATE OR REPLACE FUNCTION public.guard_dog_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.participation_dogs WHERE dog_id = OLD.id) THEN
    RAISE EXCEPTION 'Ce chien a un historique de participations : archivez sa fiche au lieu de la supprimer.';
  END IF;
  RETURN OLD;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_dog_delete() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_dog_delete ON public.dogs;
CREATE TRIGGER guard_dog_delete BEFORE DELETE ON public.dogs FOR EACH ROW EXECUTE FUNCTION public.guard_dog_delete();