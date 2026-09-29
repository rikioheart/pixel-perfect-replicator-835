ALTER TABLE public.projects
  ADD COLUMN why text, ADD COLUMN for_whom text, ADD COLUMN objective text,
  ADD COLUMN done_steps text, ADD COLUMN next_steps text,
  ADD COLUMN current_needs text, ADD COLUMN how_to_contribute text;

CREATE TABLE public.contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  contribution_type text NOT NULL CHECK (contribution_type IN ('TEMPS','PONCTUEL','COMPETENCE','MISE_EN_RELATION','IDEE','TERRAIN','REFERENT')),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED','DISCUSSION','ACCEPTED','IN_PROGRESS','BLOCKED','COMPLETED','CANCELLED')),
  estimated_time text,
  bureau_reply text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contributions TO authenticated;
GRANT ALL ON public.contributions TO service_role;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY contrib_select ON public.contributions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_bureau(auth.uid())
    OR (project_id IS NOT NULL AND status NOT IN ('PROPOSED','CANCELLED') AND public.can_view_project(auth.uid(), project_id)));
CREATE POLICY contrib_insert ON public.contributions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'PROPOSED');
CREATE POLICY contrib_update ON public.contributions FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_bureau(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_bureau(auth.uid()));
CREATE POLICY contrib_delete ON public.contributions FOR DELETE TO authenticated
  USING (public.is_bureau(auth.uid()) OR (user_id = auth.uid() AND status = 'PROPOSED'));

CREATE OR REPLACE FUNCTION public.contribution_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_bureau(auth.uid()) THEN
    -- un membre peut seulement annuler ou marquer terminée sa contribution acceptée
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
      NEW.status = 'CANCELLED' OR (NEW.status IN ('IN_PROGRESS','COMPLETED','BLOCKED') AND OLD.status IN ('ACCEPTED','IN_PROGRESS','BLOCKED'))
    ) THEN RAISE EXCEPTION 'Seul le Bureau peut changer ce statut'; END IF;
    NEW.bureau_reply := OLD.bureau_reply;
  END IF;
  IF NEW.status = 'COMPLETED' AND OLD.status <> 'COMPLETED' THEN NEW.completed_at := now(); END IF;
  IF NEW.status = 'ACCEPTED' AND OLD.status <> 'ACCEPTED' AND NEW.project_id IS NOT NULL THEN
    INSERT INTO public.project_members (project_id, user_id, project_role, participation_status)
    VALUES (NEW.project_id, NEW.user_id, CASE WHEN NEW.contribution_type = 'REFERENT' THEN 'REFERENT' ELSE 'CONTRIBUTEUR' END, 'ACTIVE')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_contrib_guard BEFORE UPDATE ON public.contributions FOR EACH ROW EXECUTE FUNCTION public.contribution_guard();
CREATE TRIGGER trg_contrib_updated BEFORE UPDATE ON public.contributions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.notify_contribution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a uuid;
BEGIN
  FOR a IN SELECT ur.user_id FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE r.code = 'ADMIN_BUREAU' LOOP
    INSERT INTO public.in_app_notifications (recipient_id, sender_id, kind, title, message, link_url, entity_type, entity_id)
    VALUES (a, NEW.user_id, 'HELP_OFFER', 'Nouvelle proposition d''aide', NEW.title, '/admin/contributions', 'contribution', NEW.id);
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_contrib_notify AFTER INSERT ON public.contributions FOR EACH ROW EXECUTE FUNCTION public.notify_contribution();

ALTER TABLE public.tasks ADD COLUMN contribution_id uuid REFERENCES public.contributions(id) ON DELETE SET NULL;

CREATE TABLE public.association_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('PROJET','ACTION','PARTENARIAT','ACTIVITE','EVENEMENT','BESOIN','RESULTAT')),
  title text NOT NULL,
  body text,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  is_public boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.association_updates TO authenticated;
GRANT SELECT ON public.association_updates TO anon;
GRANT ALL ON public.association_updates TO service_role;
ALTER TABLE public.association_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY au_select_members ON public.association_updates FOR SELECT TO authenticated USING (true);
CREATE POLICY au_select_public ON public.association_updates FOR SELECT TO anon USING (is_public);
CREATE POLICY au_manage ON public.association_updates FOR ALL TO authenticated
  USING (public.is_bureau(auth.uid()) OR (created_by = auth.uid() AND public.is_professional(auth.uid())))
  WITH CHECK (public.is_bureau(auth.uid()) OR (created_by = auth.uid() AND public.is_professional(auth.uid())));

ALTER TABLE public.user_preferences ADD COLUMN show_association_updates boolean NOT NULL DEFAULT true;
