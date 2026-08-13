CREATE TABLE public.config_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family text NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  description text,
  color text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_options TO authenticated;
GRANT ALL ON public.config_options TO service_role;

ALTER TABLE public.config_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_options_read" ON public.config_options
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "config_options_insert" ON public.config_options
  FOR INSERT TO authenticated WITH CHECK (public.is_bureau(auth.uid()));
CREATE POLICY "config_options_update" ON public.config_options
  FOR UPDATE TO authenticated USING (public.is_bureau(auth.uid())) WITH CHECK (public.is_bureau(auth.uid()));
CREATE POLICY "config_options_delete" ON public.config_options
  FOR DELETE TO authenticated USING (public.is_bureau(auth.uid()) AND is_system = false);

CREATE TRIGGER trg_config_options_updated BEFORE UPDATE ON public.config_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS access_level text NOT NULL DEFAULT 'STANDARD';

INSERT INTO public.roles (code, name, description, is_system_role) VALUES
  ('MEMBRE_FONDATEUR', 'Membre fondateur', 'Rôle complémentaire honorifique et historique', false),
  ('REPRESENTANT_PROFESSIONNELS', 'Représentant des professionnels', 'Porte la voix des professionnels auprès du Bureau', false),
  ('REPRESENTANT_PARTICULIERS', 'Représentant des particuliers', 'Porte la voix des particuliers auprès du Bureau', false),
  ('MEMBRE_APPRENANT', 'Membre apprenant', 'Membre en apprentissage accompagné', false),
  ('MEMBRE_SOUTIEN', 'Membre soutien', 'Soutient l''association sans engagement opérationnel', false),
  ('MEMBRE_BIENFAITEUR', 'Membre bienfaiteur', 'Soutien financier ou matériel significatif', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.config_options (family, code, label, description, sort_order, is_system) VALUES
  ('PROFESSIONAL_CATEGORY','EDUCATEUR','Éducateur canin',null,10,true),
  ('PROFESSIONAL_CATEGORY','COMPORTEMENTALISTE','Comportementaliste',null,20,true),
  ('PROFESSIONAL_CATEGORY','VETERINAIRE','Vétérinaire',null,30,true),
  ('PROFESSIONAL_CATEGORY','TOILETTEUR','Toiletteur',null,40,true),
  ('PROFESSIONAL_CATEGORY','PENSION','Pension / garde',null,50,false),
  ('PROFESSIONAL_CATEGORY','OSTEOPATHE','Ostéopathe animalier',null,60,false),
  ('PROJECT_CATEGORY','TERRAIN','Terrain',null,10,true),
  ('PROJECT_CATEGORY','COMMUNICATION','Communication',null,20,true),
  ('PROJECT_CATEGORY','PARTENARIATS','Partenariats',null,30,true),
  ('PROJECT_CATEGORY','EVENEMENTIEL','Événementiel',null,40,true),
  ('PROJECT_CATEGORY','ADMINISTRATIF','Administratif',null,50,true),
  ('ACTIVITY_TYPE','BALADE','Balade éducative',null,10,true),
  ('ACTIVITY_TYPE','ATELIER','Atelier',null,20,true),
  ('ACTIVITY_TYPE','FORMATION','Formation',null,30,true),
  ('ACTIVITY_TYPE','CONSULTATION','Consultation',null,40,false),
  ('ACTIVITY_TYPE','SENSIBILISATION','Sensibilisation',null,50,false),
  ('EVENT_TYPE','SALON','Salon',null,10,true),
  ('EVENT_TYPE','JOURNEE_PORTES_OUVERTES','Journée portes ouvertes',null,20,true),
  ('EVENT_TYPE','ASSEMBLEE','Assemblée générale',null,30,true),
  ('EVENT_TYPE','COLLECTE','Collecte solidaire',null,40,false),
  ('EVENT_TYPE','CONCOURS','Concours',null,50,false),
  ('INVOLVEMENT_LEVEL','OBSERVATEUR','Observateur','Suit l''association sans participation active',10,true),
  ('INVOLVEMENT_LEVEL','PONCTUEL','Ponctuel','Participe de temps en temps',20,true),
  ('INVOLVEMENT_LEVEL','REGULIER','Régulier','Participe régulièrement aux actions',30,true),
  ('INVOLVEMENT_LEVEL','MOTEUR','Moteur','Porte des projets et entraîne le collectif',40,true),
  ('PROJECT_ROLE','OWNER','Responsable',null,10,true),
  ('PROJECT_ROLE','COORDINATOR','Coordinateur',null,20,true),
  ('PROJECT_ROLE','CONTRIBUTOR','Contributeur',null,30,true),
  ('PROJECT_ROLE','VOLUNTEER','Bénévole',null,40,true),
  ('PROJECT_ROLE','EXPERT','Expert',null,50,true),
  ('PROJECT_ROLE','REVIEWER','Relecteur',null,60,true),
  ('ACCESS_LEVEL','STANDARD','Accès standard','Consultation de son espace et des contenus partagés',10,true),
  ('ACCESS_LEVEL','ETENDU','Accès étendu','Accès élargi aux projets de l''association',20,true),
  ('ACCESS_LEVEL','COORDINATION','Accès coordination','Peut piloter des projets et des équipes',30,true),
  ('ACCESS_LEVEL','ADMINISTRATION','Accès administration','Accès complet au cockpit du Bureau',40,true),
  ('TASK_STATUS','TODO','À faire',null,10,true),
  ('TASK_STATUS','IN_PROGRESS','En cours',null,20,true),
  ('TASK_STATUS','WAITING','En attente',null,30,true),
  ('TASK_STATUS','PENDING_VALIDATION','À valider',null,40,true),
  ('TASK_STATUS','COMPLETED','Terminée',null,50,true),
  ('TASK_STATUS','BLOCKED','Bloquée',null,60,true),
  ('TASK_STATUS','CANCELLED','Annulée',null,70,true),
  ('TASK_STATUS','ARCHIVED','Archivée',null,80,true),
  ('PROJECT_STATUS','PLANNED','Planifié',null,10,true),
  ('PROJECT_STATUS','ACTIVE','Actif',null,20,true),
  ('PROJECT_STATUS','ON_HOLD','En pause',null,30,true),
  ('PROJECT_STATUS','COMPLETED','Terminé',null,40,true),
  ('PROJECT_STATUS','ARCHIVED','Archivé',null,50,true),
  ('MEMBERSHIP_STATUS','PENDING','En attente',null,10,true),
  ('MEMBERSHIP_STATUS','ACTIVE','Actif',null,20,true),
  ('MEMBERSHIP_STATUS','SUSPENDED','Suspendu',null,30,true),
  ('MEMBERSHIP_STATUS','INACTIVE','Inactif',null,40,true),
  ('PARTNER_CATEGORY','COMMERCE','Commerce local',null,10,true),
  ('PARTNER_CATEGORY','MAIRIE','Mairie / collectivité',null,20,true),
  ('PARTNER_CATEGORY','ASSOCIATION','Association',null,30,true),
  ('PARTNER_CATEGORY','MARQUE','Marque / fournisseur',null,40,true),
  ('PARTNER_CATEGORY','MEDIA','Média',null,50,false),
  ('DOCUMENT_CATEGORY','STATUTS','Statuts et règlement',null,10,true),
  ('DOCUMENT_CATEGORY','COMPTE_RENDU','Compte-rendu',null,20,true),
  ('DOCUMENT_CATEGORY','CONVENTION','Convention',null,30,true),
  ('DOCUMENT_CATEGORY','SUPPORT','Support pédagogique',null,40,true),
  ('DOCUMENT_CATEGORY','ADMINISTRATIF','Administratif',null,50,true),
  ('VISIBILITY','PUBLIC','Public','Visible par tous, y compris hors association',10,true),
  ('VISIBILITY','ASSOCIATION','Association','Visible par tous les membres',20,true),
  ('VISIBILITY','PROJECT','Équipe projet','Visible par les membres du projet',30,true),
  ('VISIBILITY','BUREAU','Bureau','Réservé au Bureau',40,true),
  ('VISIBILITY','PRIVATE','Privé','Visible par l''auteur uniquement',50,true),
  ('MEMBER_FUNCTION','FONDATEUR','Fondateur','Fonction historique, n''écrase pas le rôle principal',10,true),
  ('MEMBER_FUNCTION','REPRESENTANT_PROFESSIONNELS','Représentant des professionnels',null,20,true),
  ('MEMBER_FUNCTION','REPRESENTANT_PARTICULIERS','Représentant des particuliers',null,30,true),
  ('MEMBER_FUNCTION','COORDINATEUR_PROJET','Coordinateur de projet',null,40,true),
  ('MEMBER_FUNCTION','REFERENT_BENEVOLES','Référent bénévoles',null,50,true),
  ('MEMBER_FUNCTION','PRESIDENT','Président',null,60,true),
  ('MEMBER_FUNCTION','SECRETARY','Secrétaire',null,70,true),
  ('MEMBER_FUNCTION','TREASURER','Trésorier',null,80,true),
  ('PRO_LEVEL','PRO_STANDARD','Professionnel standard',null,10,true),
  ('PRO_LEVEL','PRO_AVANCE','Professionnel avancé',null,20,true),
  ('PRO_LEVEL','PRO_COORDINATEUR','Professionnel coordinateur',null,30,true),
  ('PARTICULIER_LEVEL','PARTICULIER_STANDARD','Particulier standard',null,10,true),
  ('PARTICULIER_LEVEL','PARTICULIER_IMPLIQUE','Particulier impliqué',null,20,true),
  ('PARTICULIER_LEVEL','BENEVOLE_VALIDE','Bénévole validé',null,30,true),
  ('PARTICULIER_LEVEL','REFERENT_BENEVOLE','Référent bénévole',null,40,true),
  ('PRIORITY','LOW','Basse',null,10,true),
  ('PRIORITY','NORMAL','Normale',null,20,true),
  ('PRIORITY','HIGH','Haute',null,30,true),
  ('PRIORITY','URGENT','Urgente',null,40,true),
  ('LOYALTY_RULE','BALADE_1_TAMPON','1 tampon par balade','Règle par défaut appliquée aux balades éducatives',10,false),
  ('LOYALTY_RULE','ATELIER_2_TAMPONS','2 tampons par atelier',null,20,false),
  ('LOYALTY_RULE','CARTE_10_TAMPONS','Carte complète à 10 tampons','Seuil de récompense de la carte de fidélité',30,false)
ON CONFLICT (family, code) DO NOTHING;