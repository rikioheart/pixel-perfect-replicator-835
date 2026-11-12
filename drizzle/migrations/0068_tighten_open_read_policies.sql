-- Remplace les règles de lecture USING (true) par des règles fondées sur le rôle, le périmètre ou le statut.

-- Rôles et droits : le Bureau voit tout, chacun voit ses propres rôles et droits.
DROP POLICY IF EXISTS roles_read ON public.roles;
CREATE POLICY roles_read ON public.roles FOR SELECT TO authenticated
USING (
  public.is_bureau(auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.role_id = roles.id AND ur.user_id = auth.uid())
);

DROP POLICY IF EXISTS role_permissions_read ON public.role_permissions;
CREATE POLICY role_permissions_read ON public.role_permissions FOR SELECT TO authenticated
USING (
  public.is_bureau(auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.role_id = role_permissions.role_id AND ur.user_id = auth.uid())
);

DROP POLICY IF EXISTS permissions_read ON public.permissions;
CREATE POLICY permissions_read ON public.permissions FOR SELECT TO authenticated
USING (
  public.is_bureau(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role_id = rp.role_id
    WHERE rp.permission_id = permissions.id AND ur.user_id = auth.uid()
  )
);

-- Paramétrage : options actives pour tous, options retirées pour le Bureau.
DROP POLICY IF EXISTS config_options_read ON public.config_options;
CREATE POLICY config_options_read ON public.config_options FOR SELECT TO authenticated
USING (is_active OR public.is_bureau(auth.uid()));

-- Carte mentale : adhérents actifs et Bureau.
DROP POLICY IF EXISTS mindmap_config_select ON public.mindmap_config;
CREATE POLICY mindmap_config_select ON public.mindmap_config FOR SELECT TO authenticated
USING (public.is_active_member(auth.uid()) OR public.is_bureau(auth.uid()));

-- Ressources terrain : adhérents actifs et Bureau.
DROP POLICY IF EXISTS terrain_res_select ON public.terrain_resources;
CREATE POLICY terrain_res_select ON public.terrain_resources FOR SELECT TO authenticated
USING (public.is_active_member(auth.uid()) OR public.is_bureau(auth.uid()));

-- Règles de fidélité : règles actives pour tous, inactives pour le Bureau.
DROP POLICY IF EXISTS loyalty_rules_select ON public.loyalty_rules;
CREATE POLICY loyalty_rules_select ON public.loyalty_rules FOR SELECT TO authenticated
USING (is_active OR public.is_bureau(auth.uid()));

-- Partenaires (contacts, codes promo) : partenaires actifs pour les adhérents actifs, tout pour le Bureau.
DROP POLICY IF EXISTS partners_select ON public.partners;
CREATE POLICY partners_select ON public.partners FOR SELECT TO authenticated
USING (public.is_bureau(auth.uid()) OR (active AND public.is_active_member(auth.uid())));

-- Avantages (codes promo) : publiés pour les adhérents actifs ; auteur, pro concerné et Bureau.
DROP POLICY IF EXISTS advantages_select ON public.advantages;
CREATE POLICY advantages_select ON public.advantages FOR SELECT TO authenticated
USING (
  public.is_bureau(auth.uid())
  OR created_by = auth.uid()
  OR professional_id = auth.uid()
  OR (status = 'PUBLISHED' AND public.is_active_member(auth.uid()))
);

-- Formations : brouillons visibles seulement par l'auteur et le Bureau.
DROP POLICY IF EXISTS formations_select ON public.formations;
CREATE POLICY formations_select ON public.formations FOR SELECT TO authenticated
USING (public.is_bureau(auth.uid()) OR created_by = auth.uid() OR status <> 'DRAFT');

-- Inscriptions aux formations : sa propre inscription, l'auteur de la formation, le Bureau.
DROP POLICY IF EXISTS formation_reg_select ON public.formation_registrations;
CREATE POLICY formation_reg_select ON public.formation_registrations FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_bureau(auth.uid())
  OR EXISTS (SELECT 1 FROM public.formations f WHERE f.id = formation_registrations.formation_id AND f.created_by = auth.uid())
);

-- Nombre d'inscrits par formation (sans identité) pour afficher les places restantes.
CREATE OR REPLACE FUNCTION public.formation_registration_counts()
RETURNS TABLE(formation_id uuid, total integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.formation_id, count(*)::int
  FROM public.formation_registrations r
  JOIN public.formations f ON f.id = r.formation_id
  WHERE auth.uid() IS NOT NULL
    AND (f.status <> 'DRAFT' OR f.created_by = auth.uid() OR public.is_bureau(auth.uid()))
  GROUP BY r.formation_id
$$;
REVOKE EXECUTE ON FUNCTION public.formation_registration_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.formation_registration_counts() TO authenticated;

-- Affectations et dépendances de tâches : seulement pour les tâches que l'on peut voir.
DROP POLICY IF EXISTS task_assignees_select ON public.task_assignees;
CREATE POLICY task_assignees_select ON public.task_assignees FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_bureau(auth.uid())
  OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_assignees.task_id)
);

DROP POLICY IF EXISTS task_deps_select ON public.task_dependencies;
CREATE POLICY task_deps_select ON public.task_dependencies FOR SELECT TO authenticated
USING (
  public.is_bureau(auth.uid())
  OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_dependencies.task_id)
);