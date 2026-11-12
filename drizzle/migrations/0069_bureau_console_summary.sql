-- Console du Bureau : uniquement des compteurs, pourcentages et totaux, jamais une ligne nominative.
CREATE OR REPLACE FUNCTION public.bureau_console_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'Europe/Paris')::date;
  _can_reimb boolean;
  _can_global boolean;
  _ag_id uuid;
  _ag_title text;
  result jsonb;
BEGIN
  IF _uid IS NULL OR NOT public.is_bureau(_uid) THEN
    RAISE EXCEPTION 'Console réservée au Bureau';
  END IF;

  _can_global := public.bureau_has_permission(_uid, 'finance.view_global');
  _can_reimb := _can_global
    OR public.bureau_has_permission(_uid, 'reimbursements.validate')
    OR public.bureau_has_permission(_uid, 'reimbursements.mark_paid');

  SELECT g.id, g.title INTO _ag_id, _ag_title
  FROM public.governance_records g
  WHERE g.kind = 'AG'
  ORDER BY g.meeting_date DESC NULLS LAST
  LIMIT 1;

  WITH open_tasks AS (
    SELECT t.id, t.status, t.deadline, t.needs_help, t.assigned_user_id
    FROM public.tasks t
    WHERE t.status NOT IN ('COMPLETED', 'ARCHIVED', 'CANCELLED', 'REJECTED', 'VALIDATED')
  ),
  working AS (
    SELECT * FROM open_tasks WHERE status IN ('TODO', 'IN_PROGRESS', 'BLOCKED')
  ),
  people AS (
    SELECT assigned_user_id AS uid FROM working WHERE assigned_user_id IS NOT NULL
    UNION
    SELECT ta.user_id FROM public.task_assignees ta JOIN working w ON w.id = ta.task_id
  )
  SELECT jsonb_build_object(
    'members', jsonb_build_object(
      'active', (SELECT count(*) FROM public.profiles WHERE membership_status = 'ACTIVE'),
      'active_particuliers', (SELECT count(*) FROM public.profiles WHERE membership_status = 'ACTIVE' AND membership_type IS DISTINCT FROM 'PROFESSIONNEL'),
      'active_pros', (SELECT count(*) FROM public.profiles WHERE membership_status = 'ACTIVE' AND membership_type = 'PROFESSIONNEL'),
      'pending', (SELECT count(*) FROM public.profiles WHERE membership_status = 'PENDING'),
      'considered', (SELECT count(*) FROM public.profiles WHERE membership_status IN ('ACTIVE', 'PENDING', 'EXPIRED', 'INACTIVE'))
    ),
    'tasks', jsonb_build_object(
      'working', (SELECT count(*) FROM working),
      'assigned', (SELECT count(*) FROM working w WHERE w.assigned_user_id IS NOT NULL OR EXISTS (SELECT 1 FROM public.task_assignees ta WHERE ta.task_id = w.id)),
      'overdue', (SELECT count(*) FROM working WHERE deadline IS NOT NULL AND deadline < _today),
      'to_validate', (SELECT count(*) FROM open_tasks WHERE status = 'PENDING_VALIDATION'),
      'needs_help', (SELECT count(*) FROM open_tasks WHERE needs_help),
      'people_involved', (SELECT count(*) FROM people)
    ),
    'offers', (SELECT count(*) FROM public.contributions WHERE status IN ('PROPOSED', 'DISCUSSION')),
    'pro_proposals', (SELECT count(*) FROM public.professional_proposals WHERE status = 'PENDING'),
    'inventory', jsonb_build_object(
      'low_stock', (SELECT count(*) FROM public.inventory WHERE quantity <= alert_threshold),
      'overdue_loans', (SELECT count(*) FROM public.inventory_reservations WHERE status = 'ACTIVE' AND end_date IS NOT NULL AND end_date < _today)
    ),
    'ag', CASE WHEN _ag_id IS NULL THEN NULL ELSE jsonb_build_object(
      'title', _ag_title,
      'counted', (SELECT count(*) FROM public.ag_attendance WHERE record_id = _ag_id AND status IN ('PRESENT', 'REPRESENTED'))
    ) END,
    'finance', CASE WHEN NOT (_can_reimb OR _can_global) THEN NULL ELSE jsonb_build_object(
      'reimb_pending_count', CASE WHEN _can_reimb THEN (SELECT count(*) FROM public.reimbursements WHERE status = 'PENDING') END,
      'reimb_pending_amount', CASE WHEN _can_reimb THEN (SELECT COALESCE(sum(amount), 0) FROM public.reimbursements WHERE status = 'PENDING') END,
      'reimb_approved_amount', CASE WHEN _can_reimb THEN (SELECT COALESCE(sum(amount), 0) FROM public.reimbursements WHERE status = 'APPROVED') END,
      'payouts_due_amount', CASE WHEN _can_global THEN (SELECT COALESCE(sum(professional_share), 0) FROM public.accounting WHERE professional_share > 0 AND professional_id IS NOT NULL AND professional_paid_at IS NULL) END
    ) END
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bureau_console_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bureau_console_summary() TO authenticated;