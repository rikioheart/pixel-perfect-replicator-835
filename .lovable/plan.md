# A10 — Sécurité, RLS, partage : audit et plan de correction

Audit fait directement sur les règles de la base (pas sur l'interface). Conformément à la consigne « STOP en cas de faille critique », rien n'est modifié tant que ce plan n'est pas validé.

## 1. Failles critiques découvertes (à corriger en premier)

| # | Faille | Impact |
|---|---|---|
| C1 | Un membre peut modifier lui-même son type d'adhésion et son statut sur sa fiche (`profiles_update_own` sans garde de colonnes) | Un particulier se déclare PROFESSIONNEL ou ACTIF → auto-escalade (espace pro, accès chiens via `is_professional`) |
| C2 | Les fonctions de fidélité `apply_loyalty_rules` et `notify_once`, `run_daily_reminders`, `run_weekly_bureau_digest` sont appelables par n'importe quel compte, avec un identifiant arbitraire | Attribution de tampons à soi-même ou à autrui ; envoi de notifications forgées |
| C3 | Lecture de **tous** les commentaires par tout membre connecté (`comments_select = true`) | Un commentaire sur un document Bureau, une tâche ou un projet privé est lisible par tous |

## 2. Failles importantes

- **I1** Toutes les réservations terrain sont lisibles par tous les membres (`terrain_resv_select = true`), y compris notes et participants.
- **I2** Le Bureau a un accès illimité aux chiens, observations, objectifs (`can_manage_dog` inclut `is_bureau`) — contraire à « Bureau ≠ accès illimité ».
- **I3** Le professionnel référent ne peut pas partager un dossier : seul le propriétaire/foyer peut créer un accès. Le partage contextualisé demandé n'existe pas.
- **I4** Pas de niveau de sensibilité PUBLIC/INTERNE/SENSIBLE homogène ; `documents.visibility` utilise BUREAU/autres.
- **I5** `member_functions` et `role_permissions` lisibles par tous — acceptable (INTERNE), à confirmer.

## 3. Points conformes (conservés)

`public_shares` (création limitée par `can_share_entity`, lecture créateur/Bureau, documents Bureau bloqués même via ancien lien, expiration/révocation contrôlées côté serveur) ; `people` ; `user_roles`, `user_permission_overrides` (seul le Bureau écrit) ; `professional_internal_details` (pro + Bureau) ; observations/objectifs côté pro via `pro_dog_perm` (révocation + expiration) ; réservations : chien associé seulement si autorisé.

## 4. Corrections proposées (une migration, sans nouveau système RBAC)

1. **C1** — déclencheur de garde sur `profiles` : hors Bureau, interdiction de changer `membership_type`, `membership_status` (sauf à la création en PENDING/PARTICULIER).
2. **C2** — `REVOKE EXECUTE ... FROM public, anon, authenticated` sur `apply_loyalty_rules`, `notify_once`, `run_daily_reminders`, `run_weekly_bureau_digest` (restent utilisés par les déclencheurs et tâches planifiées). Contrôle `auth.uid()` ajouté dans `apply_loyalty_rules`.
3. **C3** — fonction `can_view_comment_target(type, id)` qui réutilise les règles du parent (projet via `can_view_project`, tâche, événement, document hors BUREAU) ; nouvelle politique de lecture des commentaires.
4. **I1** — lecture réservation limitée à : demandeur, professionnel principal, professionnels associés, propriétaire d'un chien concerné, Bureau. Les notes restent cachées aux associés (vue opérationnelle sans champ médical).
5. **I2** — Bureau : accès chiens conditionné à la permission `dogs.read_sensitive` (créée dans `permissions`, accordée au rôle ADMIN_BUREAU par défaut, retirable). `is_bureau` seul ne suffit plus pour observations/objectifs.
6. **I3 — Partage explicite** en étendant `dog_professional_access` (pas de nouvelle table) : colonnes `granted_by`, `context`, `source_access_id`, `sensitivity`. Fonction `share_dog_access(dog, pro, rubriques, contexte, expiration)` :
   - appelant = propriétaire/foyer, ou référent disposant lui-même des rubriques ;
   - rubriques accordées ⊆ rubriques de l'appelant (jamais d'élargissement) ;
   - impossible de se l'accorder à soi-même ; journalisé dans `audit_logs` ; révocable par le donneur, le propriétaire ou le Bureau ; la révocation d'une source révoque les accès dérivés.
   - le destinataire ne peut pas modifier sa propre ligne (politique d'écriture inchangée).
7. **I4** — colonne `sensitivity` (PUBLIC/INTERNE/SENSIBLE, défaut INTERNE) sur `documents`, `comments`, `dog_observations` ; SENSIBLE exige la permission correspondante.
8. Documentation des règles dans `AGENTS.md`.

## 5. Tests réels (comptes d'essai + comptes temporaires)

Exécutés en SQL avec identité simulée (`set role authenticated` + `request.jwt.claims`), puis nettoyés :
pro A ne voit pas le chien de B ; pro associé à une réservation sans dossier ; référent partage → destinataire voit uniquement les rubriques ; destinataire ne peut pas s'auto-élargir ; révocation ; expiration ; Bureau avec/sans permission ; particulier qui tente de passer PROFESSIONNEL ; appel direct `apply_loyalty_rules` refusé ; lecture d'un commentaire de document Bureau refusée ; lien public sur document Bureau refusé.

## 6. Livrable final

Audit, règles et politiques modifiées, fonctions SECURITY DEFINER auditées (les 44), modèle de partage, matrice ACTEUR → ACTION → DONNÉE → SCOPE → VISIBILITÉ → SENSIBILITÉ → CONTEXTE → CONDITIONS pour public/membre/bénévole/pro/référent/associé/coordinateur/Bureau/admin, résultats de tests, risques restants.

## Questions à valider

- Bureau : accès aux dossiers sensibles des chiens par défaut (permission retirable) ou refusé par défaut ?
- Un professionnel référent peut-il partager la rubrique « observations » ou seulement identité/infos/objectifs ?
