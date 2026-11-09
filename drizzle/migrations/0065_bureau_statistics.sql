CREATE OR REPLACE FUNCTION public.bureau_statistics(_from date, _to date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  f timestamptz;
  t timestamptz;
  result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_bureau(auth.uid()) THEN
    RAISE EXCEPTION 'Statistiques réservées au Bureau';
  END IF;
  IF _from IS NULL OR _to IS NULL OR _to < _from THEN
    RAISE EXCEPTION 'Période invalide';
  END IF;
  IF _to - _from > 3700 THEN
    RAISE EXCEPTION 'Période trop longue (10 ans maximum)';
  END IF;
  f := (_from::timestamp AT TIME ZONE 'Europe/Paris');
  t := ((_to + 1)::timestamp AT TIME ZONE 'Europe/Paris');

  WITH
  done_tasks AS (
    SELECT id, assigned_user_id, completed_at FROM public.tasks
    WHERE status IN ('COMPLETED', 'VALIDATED') AND COALESCE(completed_at, validated_at, updated_at) >= f AND COALESCE(completed_at, validated_at, updated_at) < t
  ),
  volunteers AS (
    SELECT assigned_user_id AS uid FROM done_tasks WHERE assigned_user_id IS NOT NULL
    UNION SELECT ta.user_id FROM public.task_assignees ta JOIN done_tasks d ON d.id = ta.task_id
    UNION SELECT user_id FROM public.contributions WHERE status IN ('ACCEPTED', 'COMPLETED') AND created_at >= f AND created_at < t
  ),
  project_progress AS (
    SELECT p.id,
           count(tk.id) FILTER (WHERE tk.status NOT IN ('CANCELLED', 'REJECTED', 'ARCHIVED')) AS eligible,
           count(tk.id) FILTER (WHERE tk.status IN ('COMPLETED', 'VALIDATED')) AS done
    FROM public.projects p LEFT JOIN public.tasks tk ON tk.project_id = p.id
    WHERE p.archived_at IS NULL
    GROUP BY p.id
  ),
  stamps AS (
    SELECT s.*, c.member_id FROM public.loyalty_stamps s JOIN public.loyalty_cards c ON c.id = s.card_id
    WHERE s.created_at >= f AND s.created_at < t
  ),
  months AS (
    SELECT generate_series(date_trunc('month', _from::timestamp), date_trunc('month', _to::timestamp), interval '1 month') AS m
  )
  SELECT jsonb_build_object(
    'members', jsonb_build_object(
      'particuliers_actifs', (SELECT count(*) FROM public.profiles WHERE membership_status = 'ACTIVE' AND membership_type IS DISTINCT FROM 'PROFESSIONNEL'),
      'pros_bienfaiteurs', (SELECT count(*) FROM public.profiles WHERE membership_status = 'ACTIVE' AND membership_type = 'PROFESSIONNEL'),
      'en_attente', (SELECT count(*) FROM public.profiles WHERE membership_status = 'PENDING'),
      'nouveaux', (SELECT count(*) FROM public.profiles WHERE created_at >= f AND created_at < t)
    ),
    'life', jsonb_build_object(
      'activites', (SELECT count(*) FROM public.activities WHERE date >= f AND date < t AND COALESCE(status, '') NOT IN ('CANCELLED', 'DRAFT')),
      'evenements', (SELECT count(*) FROM public.events WHERE start_date >= f AND start_date < t AND COALESCE(status, '') NOT IN ('CANCELLED', 'DRAFT')),
      'inscriptions', (SELECT count(*) FROM public.participations WHERE COALESCE(registered_at, created_at) >= f AND COALESCE(registered_at, created_at) < t),
      'presences_validees', (SELECT count(*) FROM public.participations WHERE validated_at >= f AND validated_at < t),
      'participants_uniques', (SELECT count(DISTINCT user_id) FROM public.participations WHERE COALESCE(registered_at, created_at) >= f AND COALESCE(registered_at, created_at) < t)
    ),
    'projects', jsonb_build_object(
      'en_cours', (SELECT count(*) FROM public.projects WHERE archived_at IS NULL AND status IN ('ACTIVE', 'IN_PROGRESS')),
      'en_preparation', (SELECT count(*) FROM public.projects WHERE archived_at IS NULL AND status IN ('PLANNED', 'DRAFT', 'IDEA')),
      'en_pause', (SELECT count(*) FROM public.projects WHERE archived_at IS NULL AND status = 'ON_HOLD'),
      'termines', (SELECT count(*) FROM public.projects WHERE status = 'COMPLETED'),
      'crees', (SELECT count(*) FROM public.projects WHERE created_at >= f AND created_at < t),
      'avancement_moyen', (SELECT COALESCE(round(avg(done::numeric * 100 / eligible)), 0) FROM project_progress WHERE eligible > 0),
      'taches_realisees', (SELECT count(*) FROM done_tasks),
      'taches_ouvertes', (SELECT count(*) FROM public.tasks WHERE status IN ('TODO', 'IN_PROGRESS', 'PENDING_VALIDATION', 'BLOCKED')),
      'taches_en_retard', (SELECT count(*) FROM public.tasks WHERE status IN ('TODO', 'IN_PROGRESS', 'BLOCKED') AND deadline IS NOT NULL AND deadline < current_date)
    ),
    'volunteers', jsonb_build_object(
      'benevoles_engages', (SELECT count(DISTINCT uid) FROM volunteers WHERE uid IS NOT NULL),
      'propositions', (SELECT count(*) FROM public.contributions WHERE created_at >= f AND created_at < t),
      'propositions_acceptees', (SELECT count(*) FROM public.contributions WHERE status IN ('ACCEPTED', 'COMPLETED') AND created_at >= f AND created_at < t),
      'demandes_aide', (SELECT count(*) FROM public.help_requests WHERE created_at >= f AND created_at < t),
      'taches_benevoles_realisees', (SELECT count(*) FROM public.tasks WHERE is_volunteer_task AND id IN (SELECT id FROM done_tasks))
    ),
    'pass', jsonb_build_object(
      'tampons', (SELECT COALESCE(sum(stamps), 0) FROM stamps),
      'beneficiaires', (SELECT count(DISTINCT member_id) FROM stamps),
      'cartes', (SELECT count(*) FROM public.loyalty_cards),
      'par_partenaire', COALESCE((
        SELECT jsonb_agg(row_to_json(x) ORDER BY x.name)
        FROM (
          SELECT COALESCE(NULLIF(trim(pr.display_name), ''), NULLIF(trim(concat_ws(' ', pr.first_name, pr.last_name)), ''), 'Partenaire') AS name,
                 CASE WHEN pr.membership_type = 'PROFESSIONNEL' THEN 'PRO' ELSE 'BUREAU' END AS source,
                 sum(s.stamps)::int AS tampons,
                 count(DISTINCT s.member_id)::int AS personnes
          FROM stamps s JOIN public.profiles pr ON pr.id = COALESCE(s.professional_id, s.awarded_by)
          GROUP BY 1, 2
        ) x
      ), '[]'::jsonb),
      'automatiques', (SELECT COALESCE(sum(stamps), 0) FROM stamps WHERE professional_id IS NULL AND awarded_by IS NULL)
    ),
    'series', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'mois', to_char(mo.m, 'YYYY-MM'),
        'adherents', (SELECT count(*) FROM public.profiles WHERE created_at >= GREATEST(mo.m AT TIME ZONE 'Europe/Paris', f) AND created_at < LEAST((mo.m + interval '1 month') AT TIME ZONE 'Europe/Paris', t)),
        'taches', (SELECT count(*) FROM done_tasks WHERE COALESCE(completed_at, f) >= mo.m AT TIME ZONE 'Europe/Paris' AND COALESCE(completed_at, f) < (mo.m + interval '1 month') AT TIME ZONE 'Europe/Paris'),
        'participations', (SELECT count(*) FROM public.participations WHERE COALESCE(registered_at, created_at) >= GREATEST(mo.m AT TIME ZONE 'Europe/Paris', f) AND COALESCE(registered_at, created_at) < LEAST((mo.m + interval '1 month') AT TIME ZONE 'Europe/Paris', t)),
        'tampons', (SELECT COALESCE(sum(stamps), 0) FROM stamps WHERE created_at >= mo.m AT TIME ZONE 'Europe/Paris' AND created_at < (mo.m + interval '1 month') AT TIME ZONE 'Europe/Paris')
      ) ORDER BY mo.m)
      FROM months mo
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END $$;
REVOKE EXECUTE ON FUNCTION public.bureau_statistics(date, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.bureau_statistics(date, date) TO authenticated;