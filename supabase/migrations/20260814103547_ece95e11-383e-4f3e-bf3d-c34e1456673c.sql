-- 33. user_permission_overrides
CREATE TABLE public.user_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  effect text NOT NULL DEFAULT 'GRANT' CHECK (effect IN ('GRANT','REVOKE')),
  reason text,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permission_overrides TO authenticated;
GRANT ALL ON public.user_permission_overrides TO service_role;
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "overrides_select" ON public.user_permission_overrides FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY "overrides_manage" ON public.user_permission_overrides FOR ALL TO authenticated
  USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));

-- 40. memberships
CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  membership_type text NOT NULL DEFAULT 'PARTICULIER',
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','ACTIVE','SUSPENDED','EXPIRED','REJECTED','ARCHIVED')),
  start_date date,
  end_date date,
  validated_by uuid,
  validated_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memberships_select" ON public.memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY "memberships_insert_self" ON public.memberships FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY "memberships_manage" ON public.memberships FOR ALL TO authenticated
  USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));
CREATE TRIGGER trg_memberships_updated BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 37. professional_categories
CREATE TABLE public.professional_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_categories TO authenticated;
GRANT SELECT ON public.professional_categories TO anon;
GRANT ALL ON public.professional_categories TO service_role;
ALTER TABLE public.professional_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "procat_read" ON public.professional_categories FOR SELECT USING (true);
CREATE POLICY "procat_manage" ON public.professional_categories FOR ALL TO authenticated
  USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));
CREATE TRIGGER trg_procat_updated BEFORE UPDATE ON public.professional_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.professional_categories (code, name, sort_order) VALUES
 ('EDUCATEUR','Éducateur canin',10),
 ('COMPORTEMENTALISTE','Comportementaliste',20),
 ('PHOTOGRAPHE','Photographe',30),
 ('OSTEOPATHE','Ostéopathe',40),
 ('MASSAGE','Massage',50),
 ('REFLEXOLOGIE','Réflexologie',60),
 ('PENSION','Pension',70),
 ('PET_SITTING','Pet-sitting',80),
 ('BOUTIQUE','Boutique',90),
 ('FABRICANT','Fabricant',100),
 ('SPORT_CANIN','Sport canin',110),
 ('PREVENTION','Prévention',120),
 ('FORMATION','Formation',130),
 ('SANTE_ANIMALE','Santé animale',140),
 ('ACCOMPAGNEMENT_HUMAIN','Accompagnement humain',150),
 ('AUTRE','Autre',999);

-- 38. professional_services
CREATE TABLE public.professional_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category_id uuid REFERENCES public.professional_categories(id),
  category text,
  active boolean NOT NULL DEFAULT true,
  visibility text NOT NULL DEFAULT 'PUBLIC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_services TO authenticated;
GRANT ALL ON public.professional_services TO service_role;
ALTER TABLE public.professional_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proserv_select" ON public.professional_services FOR SELECT TO authenticated
  USING (visibility <> 'PRIVATE' OR professional_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY "proserv_own" ON public.professional_services FOR ALL TO authenticated
  USING (professional_id = auth.uid() OR public.is_bureau(auth.uid()))
  WITH CHECK (professional_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE TRIGGER trg_proserv_updated BEFORE UPDATE ON public.professional_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 39. social_links
CREATE TABLE public.social_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  url text NOT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_links TO authenticated;
GRANT ALL ON public.social_links TO service_role;
ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social_select" ON public.social_links FOR SELECT TO authenticated
  USING (is_visible OR professional_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY "social_own" ON public.social_links FOR ALL TO authenticated
  USING (professional_id = auth.uid() OR public.is_bureau(auth.uid()))
  WITH CHECK (professional_id = auth.uid() OR public.is_bureau(auth.uid()));

-- 45. task_assignees
CREATE TABLE public.task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_in_task text NOT NULL DEFAULT 'CONTRIBUTOR',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_assignees TO authenticated;
GRANT ALL ON public.task_assignees TO service_role;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_assignees_select" ON public.task_assignees FOR SELECT TO authenticated USING (true);
CREATE POLICY "task_assignees_manage" ON public.task_assignees FOR ALL TO authenticated
  USING (public.is_bureau(auth.uid()) OR user_id = auth.uid())
  WITH CHECK (public.is_bureau(auth.uid()) OR user_id = auth.uid());

-- 46. task_dependencies
CREATE TABLE public.task_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, depends_on_task_id),
  CHECK (task_id <> depends_on_task_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_dependencies TO authenticated;
GRANT ALL ON public.task_dependencies TO service_role;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_deps_select" ON public.task_dependencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "task_deps_manage" ON public.task_dependencies FOR ALL TO authenticated
  USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));

-- 35. dogs extra fields
ALTER TABLE public.dogs
  ADD COLUMN IF NOT EXISTS sex text,
  ADD COLUMN IF NOT EXISTS useful_information text,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'PRIVATE';

-- 24. notifications: read_at
ALTER TABLE public.in_app_notifications
  ADD COLUMN IF NOT EXISTS read_at timestamptz;