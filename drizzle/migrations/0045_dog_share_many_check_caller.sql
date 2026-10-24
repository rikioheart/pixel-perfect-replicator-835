-- Vérifie le droit de partager avant tout, pour ne jamais révéler à un tiers qui a déjà accès au dossier.
CREATE OR REPLACE FUNCTION public.share_dog_access_many(
  _dog_id uuid, _professional_ids uuid[], _identity boolean, _info boolean, _goals boolean,
  _activities boolean, _observations boolean, _context text, _expires_at timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE me uuid := auth.uid(); pid uuid; shared uuid[] := '{}'; skipped uuid[] := '{}';
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF NOT (public.can_manage_dog(me, _dog_id) OR EXISTS (
      SELECT 1 FROM public.dog_referents r
      JOIN public.dog_professional_access a ON a.dog_id = r.dog_id AND a.professional_id = r.professional_id
      WHERE r.dog_id = _dog_id AND r.professional_id = me AND NOT a.revoked
        AND (a.expires_at IS NULL OR a.expires_at > now()))) THEN
    RAISE EXCEPTION 'Seul le propriétaire ou un professionnel référent peut partager ce dossier';
  END IF;
  IF _professional_ids IS NULL OR cardinality(_professional_ids) = 0 THEN
    RAISE EXCEPTION 'Choisissez au moins un professionnel';
  END IF;
  IF cardinality(_professional_ids) > 20 THEN
    RAISE EXCEPTION 'Vingt professionnels au maximum par partage';
  END IF;
  FOR pid IN SELECT DISTINCT unnest(_professional_ids) LOOP
    IF EXISTS (SELECT 1 FROM public.dog_professional_access a
               WHERE a.dog_id = _dog_id AND a.professional_id = pid AND NOT a.revoked
                 AND (a.expires_at IS NULL OR a.expires_at > now())) THEN
      skipped := skipped || pid;
    ELSE
      PERFORM public.share_dog_access(_dog_id, pid, _identity, _info, _goals, _activities, _observations, _context, _expires_at);
      shared := shared || pid;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('shared', to_jsonb(shared), 'skipped', to_jsonb(skipped));
END $$;

REVOKE ALL ON FUNCTION public.share_dog_access_many(uuid, uuid[], boolean, boolean, boolean, boolean, boolean, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_dog_access_many(uuid, uuid[], boolean, boolean, boolean, boolean, boolean, text, timestamptz) TO authenticated;