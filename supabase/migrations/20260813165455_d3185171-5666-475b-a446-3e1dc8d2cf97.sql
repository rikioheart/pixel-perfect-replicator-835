-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  display_name text,
  email text,
  phone text,
  avatar_path text,
  city text,
  department text,
  membership_type text NOT NULL DEFAULT 'PARTICULIER',
  membership_status text NOT NULL DEFAULT 'PENDING',
  membership_date date,
  involvement_level text,
  bio text,
  public_visibility boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ ROLES / PERMISSIONS ============
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_system_role boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  module text NOT NULL,
  action text NOT NULL
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.member_functions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  function_type text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  start_date date DEFAULT current_date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_functions TO authenticated;
GRANT ALL ON public.member_functions TO service_role;
ALTER TABLE public.member_functions ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER HELPERS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = _user_id AND r.code = _role_code
  )
$$;

CREATE OR REPLACE FUNCTION public.is_bureau(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'ADMIN_BUREAU')
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id AND p.code = _permission_code
  )
$$;

-- Bootstrap: le tout premier compte peut se déclarer Bureau s'il n'y a aucun admin
CREATE OR REPLACE FUNCTION public.claim_bureau_bootstrap()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_role_id uuid;
  existing int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT id INTO admin_role_id FROM public.roles WHERE code = 'ADMIN_BUREAU';
  SELECT count(*) INTO existing FROM public.user_roles WHERE role_id = admin_role_id;
  IF existing > 0 THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role_id, assigned_by)
  VALUES (auth.uid(), admin_role_id, auth.uid())
  ON CONFLICT DO NOTHING;
  UPDATE public.profiles SET membership_status = 'ACTIVE', membership_type = 'BUREAU' WHERE id = auth.uid();
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_bureau_bootstrap() TO authenticated;

-- ============ PROJETS ============
CREATE TABLE public.project_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  color text
);
GRANT SELECT ON public.project_categories TO authenticated;
GRANT ALL ON public.project_categories TO service_role;
ALTER TABLE public.project_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE,
  description text,
  category_id uuid REFERENCES public.project_categories(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'PLANNED',
  priority text NOT NULL DEFAULT 'NORMAL',
  start_date date,
  deadline date,
  owner_id uuid,
  progress_percent int NOT NULL DEFAULT 0,
  visibility text NOT NULL DEFAULT 'ASSOCIATION',
  parent_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_role text NOT NULL DEFAULT 'CONTRIBUTOR',
  participation_status text NOT NULL DEFAULT 'ACTIVE',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = _project_id AND pm.user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.can_view_project(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id
      AND (
        public.is_bureau(_user_id)
        OR p.owner_id = _user_id
        OR p.visibility = 'ASSOCIATION'
        OR public.is_project_member(_user_id, p.id)
      )
  )
$$;

-- ============ TÂCHES ============
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'TODO',
  priority text NOT NULL DEFAULT 'NORMAL',
  assigned_user_id uuid,
  created_by uuid,
  deadline date,
  started_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  validated_at timestamptz,
  validated_by uuid,
  rejection_reason text,
  is_volunteer_task boolean NOT NULL DEFAULT false,
  needs_help boolean NOT NULL DEFAULT false,
  visibility text NOT NULL DEFAULT 'ASSOCIATION',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.task_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL,
  comment text,
  proof_url text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_submissions TO authenticated;
GRANT ALL ON public.task_submissions TO service_role;
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.task_validation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  validated_by uuid NOT NULL,
  status text NOT NULL,
  comment text,
  validated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_validation TO authenticated;
GRANT ALL ON public.task_validation TO service_role;
ALTER TABLE public.task_validation ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public_visibility OR public.is_bureau(auth.uid()));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_bureau" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));

CREATE POLICY "roles_read" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "permissions_read" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions_read" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "project_categories_read" ON public.project_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY "user_roles_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));

CREATE POLICY "member_functions_select" ON public.member_functions FOR SELECT TO authenticated USING (true);
CREATE POLICY "member_functions_manage" ON public.member_functions FOR ALL TO authenticated
  USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));

CREATE POLICY "projects_select" ON public.projects FOR SELECT TO authenticated
  USING (public.is_bureau(auth.uid()) OR owner_id = auth.uid() OR visibility = 'ASSOCIATION' OR public.is_project_member(auth.uid(), id));
CREATE POLICY "projects_insert" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (public.is_bureau(auth.uid()) OR public.has_permission(auth.uid(), 'projects.create'));
CREATE POLICY "projects_update" ON public.projects FOR UPDATE TO authenticated
  USING (public.is_bureau(auth.uid()) OR owner_id = auth.uid())
  WITH CHECK (public.is_bureau(auth.uid()) OR owner_id = auth.uid());
CREATE POLICY "projects_delete" ON public.projects FOR DELETE TO authenticated
  USING (public.is_bureau(auth.uid()));

CREATE POLICY "project_members_select" ON public.project_members FOR SELECT TO authenticated
  USING (public.can_view_project(auth.uid(), project_id));
CREATE POLICY "project_members_manage" ON public.project_members FOR ALL TO authenticated
  USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));

CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (public.is_bureau(auth.uid()) OR assigned_user_id = auth.uid() OR created_by = auth.uid()
         OR (project_id IS NOT NULL AND public.can_view_project(auth.uid(), project_id)));
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_bureau(auth.uid())
              OR (project_id IS NOT NULL AND public.is_project_member(auth.uid(), project_id)));
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated
  USING (public.is_bureau(auth.uid()) OR assigned_user_id = auth.uid() OR created_by = auth.uid())
  WITH CHECK (public.is_bureau(auth.uid()) OR assigned_user_id = auth.uid() OR created_by = auth.uid());
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated
  USING (public.is_bureau(auth.uid()));

CREATE POLICY "task_submissions_select" ON public.task_submissions FOR SELECT TO authenticated
  USING (public.is_bureau(auth.uid()) OR submitted_by = auth.uid()
         OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND (t.assigned_user_id = auth.uid() OR t.created_by = auth.uid())));
CREATE POLICY "task_submissions_insert" ON public.task_submissions FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "task_validation_select" ON public.task_validation FOR SELECT TO authenticated
  USING (public.is_bureau(auth.uid())
         OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND (t.assigned_user_id = auth.uid() OR t.created_by = auth.uid())));
CREATE POLICY "task_validation_insert" ON public.task_validation FOR INSERT TO authenticated
  WITH CHECK (public.is_bureau(auth.uid()) AND validated_by = auth.uid());

CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_bureau(auth.uid()));
CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- ============ TRIGGERS updated_at ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SEED ============
INSERT INTO public.roles (code, name, description) VALUES
  ('ADMIN_BUREAU', 'Membre du Bureau', 'Droits administrateur complets'),
  ('PROFESSIONNEL', 'Professionnel', 'Professionnel du réseau'),
  ('PARTICULIER', 'Particulier', 'Adhérent particulier'),
  ('MEMBRE_FONDATEUR', 'Membre fondateur', 'Fondateur de l''association'),
  ('REPRESENTANT_PROFESSIONNELS', 'Représentant des professionnels', NULL),
  ('REPRESENTANT_PARTICULIERS', 'Représentant des particuliers', NULL);

INSERT INTO public.permissions (code, name, module, action) VALUES
  ('projects.view','Voir les projets','projects','view'),
  ('projects.create','Créer un projet','projects','create'),
  ('projects.update','Modifier un projet','projects','update'),
  ('projects.archive','Archiver un projet','projects','archive'),
  ('tasks.view','Voir les tâches','tasks','view'),
  ('tasks.create','Créer une tâche','tasks','create'),
  ('tasks.update','Modifier une tâche','tasks','update'),
  ('tasks.assign','Assigner une tâche','tasks','assign'),
  ('tasks.submit','Soumettre une tâche','tasks','submit'),
  ('tasks.validate','Valider une tâche','tasks','validate'),
  ('members.view','Voir les membres','members','view'),
  ('members.validate','Valider un membre','members','validate'),
  ('users.manage','Gérer les comptes','users','manage'),
  ('audit.view','Consulter le journal','audit','view');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p WHERE r.code = 'ADMIN_BUREAU';

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.code IN ('projects.view','tasks.view','tasks.update','tasks.submit','members.view')
WHERE r.code IN ('PROFESSIONNEL','PARTICULIER');

INSERT INTO public.project_categories (code, name, color) VALUES
  ('EVENEMENTS','Événements','#7B1E3A'),
  ('FORMATIONS','Formations','#1B2A4A'),
  ('PARTENARIATS_MAIRIE','Partenariats mairie','#7B1E3A'),
  ('ASSOCIATIONS','Associations & refuges','#1B2A4A'),
  ('PEDAGOGIE','Pédagogie & prévention','#7B1E3A'),
  ('TERRAIN','Terrain','#1B2A4A'),
  ('COMMUNICATION','Communication','#7B1E3A'),
  ('BLOG','Blog & contenus','#1B2A4A'),
  ('DIGITAL','Digital','#7B1E3A'),
  ('DEVELOPPEMENT','Développement associatif','#1B2A4A'),
  ('AUTRE','Autre','#5A5A5A');