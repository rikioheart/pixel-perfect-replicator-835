<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- `people` = personne associative (avec ou sans compte) ; `profiles.person_id` la relie au compte, et les tables de liens (memberships, household_members, project_members, participation_members) portent `person_id` rempli automatiquement depuis `user_id`. Pourquoi : séparer authentification, compte et personne sans casser l'existant.
- Schéma : uniquement via l'outil de migration (drizzle/migrations) ; supabase/migrations est un historique figé ; ne jamais écrire drizzle/schema.ts, ni rejouer/supprimer une migration sans comparer au schéma réel. Pourquoi : un seul chemin de migration.

## Sécurité (A10)
- Fonctions internes (fidélité, notifications, rappels) : EXECUTE retiré à anon/authenticated ; seuls déclencheurs et service_role les appellent. Pourquoi : empêcher l'attribution forgée de tampons ou notifications.
- Type et statut d'adhésion modifiables uniquement par le Bureau (trigger guard_profile_membership) ; is_professional exige ACTIVE. Pourquoi : aucune auto-escalade de rôle.
- Accès Bureau aux dossiers chiens = is_bureau ET permission dogs.read_sensitive. Pourquoi : Bureau ≠ accès illimité.
- Partage de dossier chien uniquement via share_dog_access/revoke_dog_access (sous-ensemble des droits du donneur, contexte obligatoire, expiration bornée, révocation en cascade via source_access_id, journal audit_logs). Pourquoi : partage traçable sans escalade.
- Sensibilité à 3 niveaux PUBLIC/INTERNE/SENSIBLE (colonne sensitivity) ; jamais de lien public sur un document BUREAU ou SENSIBLE. Pourquoi : modèle unique de confidentialité.
- Commentaires lisibles selon l'objet parent (can_view_comment_target) ; réservations terrain lisibles par les seules personnes concernées, créneaux libres/occupés via terrain_busy_slots, chevauchement refusé par la base.
- Tests RLS : script API réel avec comptes d'essai, jamais seulement l'interface.
- Chiens : la table dogs n'est lue en direct que par le propriétaire/foyer ; Bureau via bureau_dogs() (rubriques privées masquées, retrait personnel via profiles.hide_sensitive_dogs), pros via get_pro_dogs() (accès partagé + vue opérationnelle can_view_dog_operational).
- Tampons manuels uniquement via award_manual_stamp (pro validé, particulier, Bureau notifié, clé manual_key unique). Pourquoi : traçabilité et anti-doublon.

## Métier (A11–A13)
- Responsabilités contextuelles : member_functions.scope_type/scope_id, is_project_coordinator (rôle projet OWNER/COORDINATOR) et has_scoped_permission (rôle global ∪ coordination ∪ délégation active). Pourquoi : un coordinateur n'est jamais admin global.
- Délégations uniquement via create_delegation/revoke_delegation (droit possédé, périmètre précis, fin ≤ 365 j, pas de re-délégation, audit). Pourquoi : aucune auto-escalade.
- Réservation terrain : statuts DRAFT/PENDING/CHANGES_REQUESTED/APPROVED/REFUSED/CANCELLED ; triggers a_guard (seul le Bureau décide, demandeur modifie en DRAFT/CHANGES_REQUESTED) puis b_check (conflit sur PENDING/APPROVED) ; access_mode GRATUIT/LOCATION sans aucun calcul de prix. Pourquoi : réservation ≠ tarification ≠ facturation ≠ paiement.
- Indicateurs chien (dog_indicators) : 4 familles VERT/JAUNE/BLEU/NOIR, libellé obligatoire, jamais une note ; lisibles en vue opérationnelle. Pourquoi : adapter l'environnement, pas juger.
- Fiches contextuelles via entity_peek(type,id) (champs autorisés + can_open) et le composant EntityPeek. Pourquoi : une seule source filtrée pour toutes les fenêtres.
- Recherche et notifications : les fonctions de lecture filtrent côté base selon les droits, et les notifications métier sont émises par déclencheur plutôt que par l'interface. Pourquoi : ni fuite ni doublon.
- Calendrier : agrège les tables métier (RLS) sans table calendrier. Pourquoi : aucune donnée dupliquée.
- Réponses aux formulaires uniquement via submit_form_response ; un e-mail identique crée un rapprochement TO_REVIEW, jamais une personne. Pourquoi : pas de doublon ni d'identité présumée.
- Finances : finance_entries = suivi opérationnel, jamais comptabilité ; écriture Bureau + finance.update, audit par trigger. Pourquoi : préparer la compta sans la remplacer.
- HelloAsso : uniquement via import_helloasso_membership (idempotent sur source+external_id, ambiguïté ⇒ integration_events TO_REVIEW, journal systématique). Pourquoi : aucun doublon ni fusion automatique.
- IA : les serveurs IA lisent les données avec la session de l'utilisateur (RLS), jamais en admin ; propositions validées tracées dans ai_suggestions. Pourquoi : l'IA ne voit que ce que l'utilisateur voit.
- External links use documents (URL, context, sensitivity, service) and ExternalLinks; embedded mode in tasks/reservations/formations. can_add_context_resource controls additions; SENSIBLE is Bureau-only. No sync: links work without APIs.
- Navigation rules live in src/lib/nav-rules.ts; pro status comes from is_professional (label only as fallback). Why: one tested rule set; RLS stays the security boundary.
