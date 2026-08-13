-- 1. PERMISSIONS CATALOG ------------------------------------------------
INSERT INTO public.permissions (code, name, description, module, action) VALUES
('members.view','Voir les adhérents','Consulter l''annuaire des adhérents','members','view'),
('members.create','Créer un adhérent',null,'members','create'),
('members.update','Modifier un adhérent',null,'members','update'),
('members.archive','Archiver un adhérent',null,'members','archive'),
('members.validate','Valider une adhésion',null,'members','validate'),
('profiles.view_own','Voir son profil',null,'profiles','view_own'),
('profiles.update_own','Modifier son profil',null,'profiles','update_own'),
('profiles.view_others','Voir les profils des autres',null,'profiles','view_others'),
('profiles.update_others','Modifier les profils des autres',null,'profiles','update_others'),
('projects.view','Voir les projets',null,'projects','view'),
('projects.create','Créer un projet',null,'projects','create'),
('projects.update','Modifier un projet',null,'projects','update'),
('projects.archive','Archiver un projet',null,'projects','archive'),
('projects.delete','Supprimer un projet',null,'projects','delete'),
('tasks.view','Voir les tâches',null,'tasks','view'),
('tasks.create','Créer une tâche',null,'tasks','create'),
('tasks.update','Modifier une tâche',null,'tasks','update'),
('tasks.assign','Attribuer une tâche',null,'tasks','assign'),
('tasks.submit','Soumettre une tâche',null,'tasks','submit'),
('tasks.validate','Valider une tâche',null,'tasks','validate'),
('tasks.archive','Archiver une tâche',null,'tasks','archive'),
('tasks.delete','Supprimer une tâche',null,'tasks','delete'),
('events.view','Voir les événements',null,'events','view'),
('events.create','Créer un événement',null,'events','create'),
('events.update','Modifier un événement',null,'events','update'),
('events.cancel','Annuler un événement',null,'events','cancel'),
('activities.view','Voir les activités',null,'activities','view'),
('activities.create','Créer une activité',null,'activities','create'),
('activities.propose','Proposer une activité',null,'activities','propose'),
('activities.validate','Valider une activité',null,'activities','validate'),
('activities.publish','Publier une activité',null,'activities','publish'),
('partners.view','Voir les partenaires',null,'partners','view'),
('partners.create','Créer un partenaire',null,'partners','create'),
('partners.update','Modifier un partenaire',null,'partners','update'),
('partners.validate','Valider un partenaire',null,'partners','validate'),
('finance.view_global','Voir la comptabilité globale',null,'finance','view_global'),
('finance.view_own','Voir ses propres montants',null,'finance','view_own'),
('finance.create','Créer une écriture',null,'finance','create'),
('finance.update','Modifier une écriture',null,'finance','update'),
('finance.validate','Valider une écriture',null,'finance','validate'),
('reimbursements.view','Voir les remboursements',null,'reimbursements','view'),
('reimbursements.create','Demander un remboursement',null,'reimbursements','create'),
('reimbursements.validate','Valider un remboursement',null,'reimbursements','validate'),
('reimbursements.mark_paid','Marquer un remboursement payé',null,'reimbursements','mark_paid'),
('loyalty.view_own','Voir sa carte de fidélité',null,'loyalty','view_own'),
('loyalty.stamp','Attribuer des tampons',null,'loyalty','stamp'),
('loyalty.manage_rules','Gérer les règles de fidélité',null,'loyalty','manage_rules'),
('terrain.view','Voir le terrain',null,'terrain','view'),
('terrain.reserve','Réserver le terrain',null,'terrain','reserve'),
('terrain.manage','Gérer le terrain',null,'terrain','manage'),
('documents.view','Voir les documents',null,'documents','view'),
('documents.upload','Déposer un document',null,'documents','upload'),
('documents.update','Modifier un document',null,'documents','update'),
('documents.delete','Supprimer un document',null,'documents','delete'),
('mindmap.view','Voir la mindmap',null,'mindmap','view'),
('mindmap.edit','Modifier la mindmap',null,'mindmap','edit'),
('settings.view','Voir le paramétrage',null,'settings','view'),
('settings.edit','Modifier le paramétrage',null,'settings','edit'),
('users.manage','Gérer les utilisateurs et rôles',null,'users','manage'),
('audit.view','Consulter le journal d''activité',null,'audit','view')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, module = EXCLUDED.module, action = EXCLUDED.action;

-- Bureau : toutes les permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.code = 'ADMIN_BUREAU'
ON CONFLICT DO NOTHING;

-- Socle commun adhérents
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.code IN (
  'profiles.view_own','profiles.update_own','profiles.view_others',
  'projects.view','tasks.view','tasks.update','tasks.submit',
  'events.view','activities.view','activities.propose','partners.view',
  'finance.view_own','reimbursements.view','reimbursements.create',
  'loyalty.view_own','terrain.view','documents.view','mindmap.view'
)
WHERE r.code IN ('PARTICULIER','PROFESSIONNEL','MEMBRE_APPRENANT','MEMBRE_SOUTIEN','MEMBRE_BIENFAITEUR','MEMBRE_FONDATEUR','REPRESENTANT_PROFESSIONNELS','REPRESENTANT_PARTICULIERS')
ON CONFLICT DO NOTHING;

-- Professionnels : réservation terrain, tampons, documents
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.code IN (
  'terrain.reserve','loyalty.stamp','documents.upload','activities.create'
)
WHERE r.code IN ('PROFESSIONNEL','REPRESENTANT_PROFESSIONNELS')
ON CONFLICT DO NOTHING;

-- Représentants et fondateurs : lecture élargie et pilotage projet
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r JOIN public.permissions p ON p.code IN (
  'members.view','projects.create','projects.update','tasks.create','tasks.assign',
  'documents.upload','mindmap.edit','audit.view','settings.view'
)
WHERE r.code IN ('MEMBRE_FONDATEUR','REPRESENTANT_PROFESSIONNELS','REPRESENTANT_PARTICULIERS')
ON CONFLICT DO NOTHING;

-- 2. TYPES DE PREUVES ----------------------------------------------------
ALTER TABLE public.task_submissions ADD COLUMN IF NOT EXISTS proof_type text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS proof_type text;

INSERT INTO public.config_options (family, code, label, description, sort_order, is_system, metadata) VALUES
('PROOF_TYPE','PHOTO','Photo','Photo prise sur le terrain',10,true,'{"task_statuses":["IN_PROGRESS","PENDING_VALIDATION"],"document_category":"SUPPORT","requires_file":true}'::jsonb),
('PROOF_TYPE','FACTURE','Facture / justificatif','Pièce comptable justifiant une dépense',20,true,'{"task_statuses":["PENDING_VALIDATION"],"document_category":"ADMINISTRATIF","requires_file":true}'::jsonb),
('PROOF_TYPE','COMPTE_RENDU','Compte-rendu','Compte-rendu écrit de l''action réalisée',30,true,'{"task_statuses":["PENDING_VALIDATION","COMPLETED"],"document_category":"COMPTE_RENDU","requires_file":false}'::jsonb),
('PROOF_TYPE','ATTESTATION','Attestation','Attestation signée par un tiers',40,true,'{"task_statuses":["PENDING_VALIDATION"],"document_category":"CONVENTION","requires_file":true}'::jsonb),
('PROOF_TYPE','LIEN','Lien externe','Lien vers une publication ou un document en ligne',50,true,'{"task_statuses":["IN_PROGRESS","PENDING_VALIDATION"],"document_category":"SUPPORT","requires_file":false}'::jsonb),
('PROOF_TYPE','DECLARATION','Déclaration sur l''honneur','Déclaration simple du membre, sans pièce jointe',60,true,'{"task_statuses":["PENDING_VALIDATION"],"document_category":null,"requires_file":false}'::jsonb)
ON CONFLICT DO NOTHING;

-- 3. MOTEUR DE RÈGLES DE FIDÉLITÉ ---------------------------------------
ALTER TABLE public.loyalty_rules
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'ACTIVITY_TYPE',
  ADD COLUMN IF NOT EXISTS match_code text,
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS eligible_membership_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tier_threshold integer,
  ADD COLUMN IF NOT EXISTS reward_label text,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_loyalty_rules_updated ON public.loyalty_rules;
CREATE TRIGGER trg_loyalty_rules_updated BEFORE UPDATE ON public.loyalty_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.loyalty_rules (code, label, description, scope, match_code, stamps_given, priority)
VALUES
 ('BALADE_1','1 tampon par balade éducative','Attribué automatiquement à la participation validée','ACTIVITY_TYPE','BALADE',1,10),
 ('ATELIER_2','2 tampons par atelier','Attribué automatiquement à la participation validée','ACTIVITY_TYPE','ATELIER',2,20),
 ('EVENEMENT_1','1 tampon par événement associatif','Présence validée sur un événement','EVENT_ANY',null,1,30)
ON CONFLICT DO NOTHING;

INSERT INTO public.loyalty_rules (code, label, description, scope, stamps_given, tier_threshold, reward_label, priority)
VALUES ('PALIER_10','Palier : carte complète','Récompense offerte à 10 tampons cumulés','TIER',0,10,'Séance offerte',900)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.apply_loyalty_rules(_user_id uuid, _activity_id uuid, _event_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  card uuid;
  member_type text;
  activity_type text;
  activity_eligible boolean;
  rule record;
  ref_note text;
  granted int := 0;
BEGIN
  IF _user_id IS NULL THEN RETURN 0; END IF;

  SELECT membership_type INTO member_type FROM public.profiles WHERE id = _user_id;

  IF _activity_id IS NOT NULL THEN
    SELECT a.type, a.eligible_for_loyalty INTO activity_type, activity_eligible
    FROM public.activities a WHERE a.id = _activity_id;
    IF COALESCE(activity_eligible, false) = false THEN RETURN 0; END IF;
  END IF;

  SELECT id INTO card FROM public.loyalty_cards WHERE member_id = _user_id;
  IF card IS NULL THEN
    INSERT INTO public.loyalty_cards (member_id) VALUES (_user_id) RETURNING id INTO card;
  END IF;

  FOR rule IN
    SELECT * FROM public.loyalty_rules
    WHERE is_active AND stamps_given > 0 AND scope <> 'TIER'
    ORDER BY priority
  LOOP
    IF cardinality(rule.eligible_membership_types) > 0
       AND NOT (member_type = ANY (rule.eligible_membership_types)) THEN
      CONTINUE;
    END IF;

    IF NOT (
      (rule.scope = 'ACTIVITY' AND rule.activity_id IS NOT NULL AND rule.activity_id = _activity_id)
      OR (rule.scope = 'ACTIVITY_TYPE' AND _activity_id IS NOT NULL AND rule.match_code = activity_type)
      OR (rule.scope = 'ACTIVITY_ANY' AND _activity_id IS NOT NULL)
      OR (rule.scope = 'EVENT' AND rule.event_id IS NOT NULL AND rule.event_id = _event_id)
      OR (rule.scope = 'EVENT_ANY' AND _event_id IS NOT NULL)
    ) THEN
      CONTINUE;
    END IF;

    ref_note := 'AUTO:' || COALESCE(rule.code, rule.id::text) || ':' || COALESCE(_activity_id::text, _event_id::text);
    IF EXISTS (SELECT 1 FROM public.loyalty_stamps s WHERE s.card_id = card AND s.note = ref_note) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.loyalty_stamps (card_id, activity_id, stamps, note)
    VALUES (card, _activity_id, rule.stamps_given, ref_note);
    granted := granted + rule.stamps_given;
  END LOOP;

  RETURN granted;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_loyalty_on_participation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.registration_status IN ('ATTENDED','VALIDATED','CONFIRMED')
     AND COALESCE(OLD.registration_status, '') IS DISTINCT FROM NEW.registration_status THEN
    PERFORM public.apply_loyalty_rules(NEW.user_id, NEW.activity_id, NEW.event_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_participations_loyalty ON public.participations;
CREATE TRIGGER trg_participations_loyalty AFTER INSERT OR UPDATE OF registration_status ON public.participations
FOR EACH ROW EXECUTE FUNCTION public.grant_loyalty_on_participation();