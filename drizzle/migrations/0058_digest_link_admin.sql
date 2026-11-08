CREATE OR REPLACE FUNCTION public.run_weekly_bureau_digest()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE pending int; submitted int; upcoming int; msg text; r record;
BEGIN
  SELECT count(*) INTO submitted FROM public.tasks WHERE upper(status) IN ('SUBMITTED','PENDING_VALIDATION');
  SELECT count(*) INTO pending FROM public.tasks WHERE needs_help = true;
  SELECT count(*) INTO upcoming FROM public.events
    WHERE start_date IS NOT NULL AND start_date BETWEEN now() AND now() + interval '7 days';
  msg := submitted || ' validation(s) en attente · ' || pending || ' demande(s) d''aide · '
      || upcoming || ' événement(s) cette semaine.';
  FOR r IN SELECT ur.user_id FROM public.user_roles ur JOIN public.roles ro ON ro.id = ur.role_id
           WHERE upper(ro.code) IN ('BUREAU','ADMIN','PRESIDENT') GROUP BY ur.user_id
  LOOP
    INSERT INTO public.in_app_notifications (recipient_id, kind, title, message, entity_type, link_url)
    VALUES (r.user_id, 'WEEKLY_DIGEST', 'Récapitulatif de la semaine', msg, 'digest', '/admin');
  END LOOP;
END; $function$;
REVOKE EXECUTE ON FUNCTION public.run_weekly_bureau_digest() FROM PUBLIC, anon, authenticated;