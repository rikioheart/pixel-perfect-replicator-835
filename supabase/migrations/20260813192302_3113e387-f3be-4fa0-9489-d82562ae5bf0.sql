
-- Helper: professional check
CREATE OR REPLACE FUNCTION public.is_professional(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user_id AND p.membership_type = 'PROFESSIONNEL')
$$;

-- DOGS
CREATE TABLE public.dogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  breed text,
  birth_date date,
  character text,
  needs text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dogs TO authenticated;
GRANT ALL ON public.dogs TO service_role;
ALTER TABLE public.dogs ENABLE ROW LEVEL SECURITY;
CREATE POLICY dogs_select ON public.dogs FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY dogs_manage_own ON public.dogs FOR ALL TO authenticated USING (owner_id = auth.uid() OR public.is_bureau(auth.uid())) WITH CHECK (owner_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE TRIGGER trg_dogs_updated BEFORE UPDATE ON public.dogs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PRO DETAILS
CREATE TABLE public.pro_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  professional_category text,
  description text,
  website_url text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  partnership_percentage numeric(5,2) NOT NULL DEFAULT 0,
  contract_url text,
  can_grant_stamps boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_details TO authenticated;
GRANT ALL ON public.pro_details TO service_role;
ALTER TABLE public.pro_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY pro_details_select ON public.pro_details FOR SELECT TO authenticated USING (true);
CREATE POLICY pro_details_update_own ON public.pro_details FOR UPDATE TO authenticated USING (profile_id = auth.uid() OR public.is_bureau(auth.uid())) WITH CHECK (profile_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY pro_details_insert ON public.pro_details FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY pro_details_delete ON public.pro_details FOR DELETE TO authenticated USING (public.is_bureau(auth.uid()));
CREATE TRIGGER trg_pro_details_updated BEFORE UPDATE ON public.pro_details FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PROJECT TEAMS
CREATE TABLE public.project_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_in_project text NOT NULL DEFAULT 'CONTRIBUTOR',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, member_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_teams TO authenticated;
GRANT ALL ON public.project_teams TO service_role;
ALTER TABLE public.project_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_teams_select ON public.project_teams FOR SELECT TO authenticated USING (public.can_view_project(auth.uid(), project_id));
CREATE POLICY project_teams_manage ON public.project_teams FOR ALL TO authenticated USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));

-- TASK HISTORY
CREATE TABLE public.task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.task_history TO authenticated;
GRANT ALL ON public.task_history TO service_role;
ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_history_select ON public.task_history FOR SELECT TO authenticated USING (
  public.is_bureau(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_history.task_id AND (t.assigned_user_id = auth.uid() OR t.created_by = auth.uid())
  )
);
CREATE POLICY task_history_insert ON public.task_history FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ACTIVITIES
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'ATELIER',
  date timestamptz,
  location text,
  price_public numeric(10,2) NOT NULL DEFAULT 0,
  price_member numeric(10,2) NOT NULL DEFAULT 0,
  capacity integer,
  eligible_for_loyalty boolean NOT NULL DEFAULT false,
  professional_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'PLANNED',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY activities_select ON public.activities FOR SELECT TO authenticated USING (true);
CREATE POLICY activities_manage ON public.activities FOR ALL TO authenticated USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));
CREATE TRIGGER trg_activities_updated BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- EVENTS
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_type text NOT NULL DEFAULT 'RENCONTRE',
  start_date timestamptz,
  end_date timestamptz,
  location text,
  visibility text NOT NULL DEFAULT 'ASSOCIATION',
  professional_ids uuid[] NOT NULL DEFAULT '{}',
  financial_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PLANNED',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_select ON public.events FOR SELECT TO authenticated USING (visibility <> 'BUREAU' OR public.is_bureau(auth.uid()));
CREATE POLICY events_manage ON public.events FOR ALL TO authenticated USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PARTICIPATIONS
CREATE TABLE public.participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.activities(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'PARTICIPANT',
  registration_status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.participations TO authenticated;
GRANT ALL ON public.participations TO service_role;
ALTER TABLE public.participations ENABLE ROW LEVEL SECURITY;
CREATE POLICY participations_select ON public.participations FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY participations_insert_own ON public.participations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY participations_update ON public.participations FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_bureau(auth.uid())) WITH CHECK (user_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY participations_delete ON public.participations FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE TRIGGER trg_participations_updated BEFORE UPDATE ON public.participations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PROFESSIONAL PROPOSALS
CREATE TABLE public.professional_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'ACTIVITE',
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'PENDING',
  reviewed_by uuid,
  review_comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_proposals TO authenticated;
GRANT ALL ON public.professional_proposals TO service_role;
ALTER TABLE public.professional_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY proposals_select ON public.professional_proposals FOR SELECT TO authenticated USING (submitted_by = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY proposals_insert ON public.professional_proposals FOR INSERT TO authenticated WITH CHECK (submitted_by = auth.uid());
CREATE POLICY proposals_update ON public.professional_proposals FOR UPDATE TO authenticated USING (public.is_bureau(auth.uid()) OR (submitted_by = auth.uid() AND status = 'PENDING')) WITH CHECK (public.is_bureau(auth.uid()) OR submitted_by = auth.uid());
CREATE POLICY proposals_delete ON public.professional_proposals FOR DELETE TO authenticated USING (public.is_bureau(auth.uid()));
CREATE TRIGGER trg_proposals_updated BEFORE UPDATE ON public.professional_proposals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PARTNERS
CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'ENTREPRISE',
  contact text,
  website_url text,
  advantages text,
  promo_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partners TO authenticated;
GRANT ALL ON public.partners TO service_role;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY partners_select ON public.partners FOR SELECT TO authenticated USING (true);
CREATE POLICY partners_manage ON public.partners FOR ALL TO authenticated USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));
CREATE TRIGGER trg_partners_updated BEFORE UPDATE ON public.partners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- LOYALTY
CREATE TABLE public.loyalty_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_stamps integer NOT NULL DEFAULT 0,
  qr_code text NOT NULL DEFAULT gen_random_uuid()::text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_cards TO authenticated;
GRANT ALL ON public.loyalty_cards TO service_role;
ALTER TABLE public.loyalty_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY loyalty_cards_select ON public.loyalty_cards FOR SELECT TO authenticated USING (member_id = auth.uid() OR public.is_bureau(auth.uid()) OR public.is_professional(auth.uid()));
CREATE POLICY loyalty_cards_insert ON public.loyalty_cards FOR INSERT TO authenticated WITH CHECK (member_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY loyalty_cards_update ON public.loyalty_cards FOR UPDATE TO authenticated USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));
CREATE POLICY loyalty_cards_delete ON public.loyalty_cards FOR DELETE TO authenticated USING (public.is_bureau(auth.uid()));
CREATE TRIGGER trg_loyalty_cards_updated BEFORE UPDATE ON public.loyalty_cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.loyalty_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid REFERENCES public.activities(id) ON DELETE CASCADE,
  stamps_given integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_rules TO authenticated;
GRANT ALL ON public.loyalty_rules TO service_role;
ALTER TABLE public.loyalty_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY loyalty_rules_select ON public.loyalty_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY loyalty_rules_manage ON public.loyalty_rules FOR ALL TO authenticated USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));

CREATE TABLE public.loyalty_stamps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.loyalty_cards(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL,
  professional_id uuid,
  stamps integer NOT NULL DEFAULT 1,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.loyalty_stamps TO authenticated;
GRANT ALL ON public.loyalty_stamps TO service_role;
ALTER TABLE public.loyalty_stamps ENABLE ROW LEVEL SECURITY;
CREATE POLICY loyalty_stamps_select ON public.loyalty_stamps FOR SELECT TO authenticated USING (
  public.is_bureau(auth.uid())
  OR professional_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.loyalty_cards c WHERE c.id = loyalty_stamps.card_id AND c.member_id = auth.uid())
);
CREATE POLICY loyalty_stamps_insert ON public.loyalty_stamps FOR INSERT TO authenticated WITH CHECK (
  public.is_bureau(auth.uid())
  OR (professional_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.pro_details d WHERE d.profile_id = auth.uid() AND d.can_grant_stamps
  ))
);
CREATE POLICY loyalty_stamps_delete ON public.loyalty_stamps FOR DELETE TO authenticated USING (public.is_bureau(auth.uid()));

CREATE OR REPLACE FUNCTION public.sync_loyalty_total()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.loyalty_cards c
  SET total_stamps = COALESCE((SELECT SUM(s.stamps) FROM public.loyalty_stamps s WHERE s.card_id = c.id), 0)
  WHERE c.id = COALESCE(NEW.card_id, OLD.card_id);
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_loyalty_stamps_sync AFTER INSERT OR DELETE ON public.loyalty_stamps
FOR EACH ROW EXECUTE FUNCTION public.sync_loyalty_total();

-- ACCOUNTING
CREATE TABLE public.accounting (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL,
  professional_id uuid,
  label text,
  gross_revenue numeric(12,2) NOT NULL DEFAULT 0,
  association_share numeric(12,2) NOT NULL DEFAULT 0,
  professional_share numeric(12,2) NOT NULL DEFAULT 0,
  recorded_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting TO authenticated;
GRANT ALL ON public.accounting TO service_role;
ALTER TABLE public.accounting ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounting_select ON public.accounting FOR SELECT TO authenticated USING (public.is_bureau(auth.uid()) OR professional_id = auth.uid());
CREATE POLICY accounting_manage ON public.accounting FOR ALL TO authenticated USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));
CREATE TRIGGER trg_accounting_updated BEFORE UPDATE ON public.accounting FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- REIMBURSEMENTS
CREATE TABLE public.reimbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'PENDING',
  receipt_url text,
  processed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reimbursements TO authenticated;
GRANT ALL ON public.reimbursements TO service_role;
ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;
CREATE POLICY reimb_select ON public.reimbursements FOR SELECT TO authenticated USING (person_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY reimb_insert ON public.reimbursements FOR INSERT TO authenticated WITH CHECK (person_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY reimb_update ON public.reimbursements FOR UPDATE TO authenticated USING (public.is_bureau(auth.uid()) OR (person_id = auth.uid() AND status = 'PENDING')) WITH CHECK (public.is_bureau(auth.uid()) OR person_id = auth.uid());
CREATE POLICY reimb_delete ON public.reimbursements FOR DELETE TO authenticated USING (public.is_bureau(auth.uid()));
CREATE TRIGGER trg_reimb_updated BEFORE UPDATE ON public.reimbursements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TERRAIN
CREATE TABLE public.terrain_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'AVAILABLE',
  location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.terrain_resources TO authenticated;
GRANT ALL ON public.terrain_resources TO service_role;
ALTER TABLE public.terrain_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY terrain_res_select ON public.terrain_resources FOR SELECT TO authenticated USING (true);
CREATE POLICY terrain_res_manage ON public.terrain_resources FOR ALL TO authenticated USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));
CREATE TRIGGER trg_terrain_res_updated BEFORE UPDATE ON public.terrain_resources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.terrain_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL REFERENCES public.terrain_resources(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  purpose text,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.terrain_reservations TO authenticated;
GRANT ALL ON public.terrain_reservations TO service_role;
ALTER TABLE public.terrain_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY terrain_resv_select ON public.terrain_reservations FOR SELECT TO authenticated USING (true);
CREATE POLICY terrain_resv_insert ON public.terrain_reservations FOR INSERT TO authenticated WITH CHECK (professional_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY terrain_resv_update ON public.terrain_reservations FOR UPDATE TO authenticated USING (public.is_bureau(auth.uid()) OR professional_id = auth.uid()) WITH CHECK (public.is_bureau(auth.uid()) OR professional_id = auth.uid());
CREATE POLICY terrain_resv_delete ON public.terrain_reservations FOR DELETE TO authenticated USING (public.is_bureau(auth.uid()) OR professional_id = auth.uid());
CREATE TRIGGER trg_terrain_resv_updated BEFORE UPDATE ON public.terrain_reservations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.check_terrain_reservation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.end_time <= NEW.start_time THEN
    RAISE EXCEPTION 'L''heure de fin doit être postérieure à l''heure de début';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_terrain_resv_check BEFORE INSERT OR UPDATE ON public.terrain_reservations
FOR EACH ROW EXECUTE FUNCTION public.check_terrain_reservation();

-- MAIRIES
CREATE TABLE public.mairies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization text NOT NULL,
  city text,
  contact_person text,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'PROSPECT',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mairies TO authenticated;
GRANT ALL ON public.mairies TO service_role;
ALTER TABLE public.mairies ENABLE ROW LEVEL SECURITY;
CREATE POLICY mairies_all ON public.mairies FOR ALL TO authenticated USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));
CREATE TRIGGER trg_mairies_updated BEFORE UPDATE ON public.mairies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BLOG
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE,
  excerpt text,
  content text,
  cover_url text,
  status text NOT NULL DEFAULT 'DRAFT',
  author_id uuid,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY blog_select ON public.blog_posts FOR SELECT TO authenticated USING (status = 'PUBLISHED' OR author_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY blog_insert ON public.blog_posts FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY blog_update ON public.blog_posts FOR UPDATE TO authenticated USING (public.is_bureau(auth.uid()) OR author_id = auth.uid()) WITH CHECK (public.is_bureau(auth.uid()) OR author_id = auth.uid());
CREATE POLICY blog_delete ON public.blog_posts FOR DELETE TO authenticated USING (public.is_bureau(auth.uid()));
CREATE TRIGGER trg_blog_updated BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- INVENTORY
CREATE TABLE public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  quantity integer NOT NULL DEFAULT 0,
  alert_threshold integer NOT NULL DEFAULT 0,
  location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO authenticated;
GRANT ALL ON public.inventory TO service_role;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_select ON public.inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY inventory_manage ON public.inventory FOR ALL TO authenticated USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));
CREATE TRIGGER trg_inventory_updated BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CONTESTS
CREATE TABLE public.contests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'CONCOURS',
  start_date date,
  end_date date,
  prizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  winners jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contests TO authenticated;
GRANT ALL ON public.contests TO service_role;
ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
CREATE POLICY contests_select ON public.contests FOR SELECT TO authenticated USING (status <> 'DRAFT' OR public.is_bureau(auth.uid()));
CREATE POLICY contests_manage ON public.contests FOR ALL TO authenticated USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));
CREATE TRIGGER trg_contests_updated BEFORE UPDATE ON public.contests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- DOCUMENTS
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text,
  url text NOT NULL,
  visibility text NOT NULL DEFAULT 'ASSOCIATION',
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_select ON public.documents FOR SELECT TO authenticated USING (visibility <> 'BUREAU' OR public.is_bureau(auth.uid()));
CREATE POLICY documents_manage ON public.documents FOR ALL TO authenticated USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
