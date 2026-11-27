-- Real database regression tests, with beta accounts only. Every fixture rolls back.
-- Run this entire file through the data-query tool; never as a migration.
BEGIN;
DO $$
DECLARE
  p uuid := 'b13acd7b-83e8-4dae-9fa9-ede27d7c9049';
  r uuid := '0cd07ca1-1d78-4576-87cf-995eb07fda38';
  project_id uuid := gen_random_uuid(); other_project uuid := gen_random_uuid();
  event_id uuid := gen_random_uuid(); doc_id uuid := gen_random_uuid();
  share_id uuid := gen_random_uuid(); dog_id uuid := gen_random_uuid();
  offer_id uuid := gen_random_uuid(); unavailable uuid := gen_random_uuid();
  task_id uuid := gen_random_uuid(); accounting_id uuid := gen_random_uuid();
  blog_id uuid := gen_random_uuid(); blocked boolean; target record; txt text;
BEGIN
  IF (SELECT count(*) FROM auth.users WHERE (id=p AND email='associationlavoixduchien+essai-particulier@gmail.com')
    OR (id=r AND email='associationlavoixduchien+essai-pro@gmail.com')) <> 2 THEN
    RAISE EXCEPTION 'Only the explicitly identified beta accounts may be used';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE email IN ('bureau@lavoixduchien.fr','membre@lavoixduchien.fr')) THEN
    RAISE EXCEPTION 'Retired credential accounts still exist';
  END IF;
  INSERT INTO public.projects(id,title,owner_id) VALUES(project_id,'SECURITY ROLLBACK own',p),(other_project,'SECURITY ROLLBACK other',r);
  INSERT INTO public.events(id,title,created_by) VALUES(event_id,'SECURITY ROLLBACK event',r);
  INSERT INTO public.documents(id,title,url,uploaded_by) VALUES(doc_id,'SECURITY ROLLBACK document','https://example.org/security-test',r);
  INSERT INTO public.public_shares(id,token,entity_type,entity_id,created_by) VALUES(share_id,gen_random_uuid()::text,'project',project_id,p);
  INSERT INTO public.dogs(id,name,owner_id) VALUES(dog_id,'SECURITY ROLLBACK dog',r);
  INSERT INTO public.advantages(id,title,status,quantity) VALUES(offer_id,'SECURITY ROLLBACK available','PUBLISHED',1),(unavailable,'SECURITY ROLLBACK unavailable','DRAFT',1);
  INSERT INTO public.tasks(id,title,project_id,status) VALUES(task_id,'SECURITY ROLLBACK task',project_id,'COMPLETED');
  INSERT INTO public.accounting(id,label,professional_id,professional_share) VALUES(accounting_id,'SECURITY ROLLBACK payout',r,10);
  INSERT INTO public.blog_posts(id,title,author_id,status) VALUES(blog_id,'SECURITY ROLLBACK draft',p,'DRAFT');

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p,'role','authenticated')::text,true);
  IF public.can_manage_dog(r,dog_id) IS DISTINCT FROM false THEN RAISE EXCEPTION 'Cross-user dog ownership probe'; END IF;
  IF public.can_view_dog_operational(r,dog_id) IS DISTINCT FROM false THEN RAISE EXCEPTION 'Cross-user operational probe'; END IF;
  IF public.can_receive_stamps(p) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Own active pass unavailable'; END IF;
  IF public.can_receive_stamps(r) IS DISTINCT FROM false THEN RAISE EXCEPTION 'Cross-user pass probe'; END IF;

  FOR target IN SELECT * FROM (VALUES ('project',other_project),('event',event_id),('document',doc_id)) AS t(kind,entity) LOOP
    blocked := false;
    BEGIN UPDATE public.public_shares SET entity_type=target.kind,entity_id=target.entity WHERE id=share_id;
    EXCEPTION WHEN raise_exception THEN blocked := true; END;
    IF NOT blocked THEN RAISE EXCEPTION 'Share retarget accepted: %',target.kind; END IF;
  END LOOP;
  blocked := false;
  BEGIN UPDATE public.public_shares SET created_by=r WHERE id=share_id;
  EXCEPTION WHEN raise_exception THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Share creator replacement accepted'; END IF;
  UPDATE public.public_shares SET revoked=true WHERE id=share_id;
  IF NOT (SELECT revoked FROM public.public_shares WHERE id=share_id) THEN RAISE EXCEPTION 'Revocation failed'; END IF;

  blocked := false;
  BEGIN UPDATE public.dogs SET owner_id=p WHERE id=dog_id;
  EXCEPTION WHEN raise_exception THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Dog ownership takeover accepted'; END IF;

  INSERT INTO public.advantage_claims(advantage_id,user_id) VALUES(offer_id,p);
  blocked := false;
  BEGIN INSERT INTO public.advantage_claims(advantage_id,user_id) VALUES(offer_id,p);
  EXCEPTION WHEN raise_exception THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Offer capacity exceeded'; END IF;
  blocked := false;
  BEGIN INSERT INTO public.advantage_claims(advantage_id,user_id) VALUES(unavailable,p);
  EXCEPTION WHEN raise_exception THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Draft offer accepted'; END IF;
  UPDATE public.advantages SET status='PUBLISHED',valid_until=CURRENT_DATE-1 WHERE id=unavailable;
  blocked := false;
  BEGIN INSERT INTO public.advantage_claims(advantage_id,user_id) VALUES(unavailable,p);
  EXCEPTION WHEN raise_exception THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Expired offer accepted'; END IF;
  UPDATE public.advantages SET valid_until=null,valid_from=CURRENT_DATE+1 WHERE id=unavailable;
  blocked := false;
  BEGIN INSERT INTO public.advantage_claims(advantage_id,user_id) VALUES(unavailable,p);
  EXCEPTION WHEN raise_exception THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Future offer accepted'; END IF;

  blocked := false;
  BEGIN UPDATE public.blog_posts SET status='PUBLISHED' WHERE id=blog_id;
  EXCEPTION WHEN raise_exception THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Self publication accepted'; END IF;
  blocked := false;
  BEGIN INSERT INTO public.blog_posts(title,author_id,status) VALUES('SECURITY ROLLBACK published',p,'PUBLISHED');
  EXCEPTION WHEN raise_exception THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Direct publication accepted'; END IF;
  blocked := false;
  BEGIN UPDATE public.blog_posts SET attachment_path='private/non-owned-security-fixture.pdf' WHERE id=blog_id;
  EXCEPTION WHEN raise_exception THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Foreign file reference accepted'; END IF;

  blocked := false;
  BEGIN INSERT INTO public.accounting(label,professional_id,professional_share) VALUES('SECURITY ROLLBACK own payout',p,100);
  EXCEPTION WHEN raise_exception THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Self payout accepted'; END IF;
  blocked := false;
  BEGIN UPDATE public.accounting SET professional_id=p,professional_share=100 WHERE id=accounting_id;
  EXCEPTION WHEN raise_exception THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Payout retarget accepted'; END IF;

  blocked := false;
  BEGIN PERFORM public.add_task_rex(task_id,'rex_successes; DELETE FROM projects','security note');
  EXCEPTION WHEN raise_exception THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Arbitrary command field accepted'; END IF;
  PERFORM public.add_task_rex(task_id,'rex_successes','security note');
  PERFORM public.add_task_rex(task_id,'rex_successes','security note');
  SELECT rex_successes INTO txt FROM public.projects WHERE id=project_id;
  IF txt <> '• SECURITY ROLLBACK task — security note' THEN RAISE EXCEPTION 'Rex append or deduplication failed'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',r,'role','authenticated')::text,true);
  blocked := false;
  BEGIN PERFORM public.add_task_rex(task_id,'rex_successes','unauthorized note');
  EXCEPTION WHEN raise_exception THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Non-coordinator rex accepted'; END IF;
  IF public.can_receive_stamps(p) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Validated pro cannot check pass'; END IF;

  PERFORM set_config('request.jwt.claims','{}',true);
  UPDATE public.profiles SET membership_status='PENDING' WHERE id=p;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p,'role','authenticated')::text,true);
  UPDATE public.advantages SET valid_from=null WHERE id=unavailable;
  blocked := false;
  BEGIN INSERT INTO public.advantage_claims(advantage_id,user_id) VALUES(unavailable,p);
  EXCEPTION WHEN raise_exception THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Pending member claimed offer'; END IF;
  RAISE NOTICE 'PASS: selected security trigger and helper regressions';
END $$;
ROLLBACK;