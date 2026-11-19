# Évolution structurante LVDC — Analyse du repo et plan d'implémentation

Statut : analyse en lecture seule. Aucun code, aucune migration et aucune donnée n'ont été modifiés.
Sources : `supabase/migrations` (historique figé), `drizzle/migrations` 0001–0073 (chemin actif selon `drizzle.config.ts`), `src/`. Toutes les conclusions décrivent le **code versionné**. Elles ne garantissent pas l'état de la base déployée (non vérifié, voir Lot 0).

Légende : V = présent et vérifié dans le code · P = partiel · A = absent · NE = non vérifié en exécution

## 1. Résumé exécutif

- Le socle est riche : `people`, rôles, fonctions à portée, délégations, `has_scoped_permission`, jalons, équipes, inventaire anti-surréservation, notifications dédupliquées et console Bureau. **Il faut l'étendre, pas le reconstruire.**
- Problèmes structurants identifiés :
  1. **Cloisonnement PENDING/REFUSED incomplet** : la lecture des projets (`visibility='ASSOCIATION'`), des tâches et des commentaires ne vérifie pas `is_active_member`. Le constat P1-01 du Lot 6 reste ouvert.
  2. **Les commentaires de tâche sont plus ouverts que la tâche elle-même** : `can_view_comment_target` accepte `ASSOCIATION/MEMBERS/PUBLIC` (0008:85-97).
  3. **Une inscription reste bloquée « en attente »** : `register_participation` écrit PENDING sans notifier personne. Aucun validateur, aucun réglage « validation requise », aucune promotion depuis la liste d'attente (0005:431-445).
  4. **Journal** : l'interface réserve la publication au Bureau, mais la base laisse l'auteur publier par l'API. L'éditeur est en texte brut.
  5. **MemberPicker** : classement exclusif par chaîne de caractères ; il ignore `user_roles` et `member_functions`.
  6. `user_permission_overrides` existe mais n'est lu par aucun évaluateur de droits.
  7. **Aucun environnement de recette isolé** : une seule base sert l'aperçu et le site publié.
- Le **NO-GO est maintenu**. Le Lot 0 est faisable tout de suite. Il est bloqué seulement par la création d'un environnement isolé, qui demande votre accord.

## 2. Tableau fonctionnalité / état / écart / recommandation

| Fonctionnalité | État actuel (preuve) | Écart | Recommandation | Prio | Dépend. |
|---|---|---|---|---|---|
| Identité unique | V `people` + `profiles.person_id` (0007) | Doublons possibles entre contacts sans compte et comptes | Rapprochement explicite d'une fiche `people` avec un compte, jamais de création automatique | P1 | L0 |
| Contexte pro séparé de l'adhésion | P `is_professional` = `membership_type='PROFESSIONNEL'` ET ACTIVE (0008:24) | Le contexte pro est lié au type d'adhésion, donc non cumulable avec particulier | Faire porter la qualité pro par `pro_details` (+ statut de validation) ; garder `membership_type` comme type d'adhésion | P1 | L0 |
| Fiche pro créable par un particulier, case « tampons » cochable par le pro | V défaut constaté le 15/11 | Faille ouverte (roadmap) | Insertion contrôlée par une fonction dédiée ; `can_grant_stamps` réservé au Bureau | P1 | — |
| MemberPicker multi-qualités | P exclusif (`MemberPicker.tsx:25-30`) | Une seule catégorie par personne ; pas de bénévole ni de mairie | Fonction de lecture `picker_people()` qui renvoie un tableau de qualités ; filtres multiples | P1 | L1 |
| Représentants particuliers/pros | P clés différentes : `REPRESENTANT_PRO` côté interface, `REPRESENTANT_PROFESSIONNELS` côté rôles | Pas d'accès annuaire dédié | Normaliser les clés ; lecture limitée nom/e-mail/téléphone si rendu visible | P2 | L1 |
| Aide sur l'administration des droits | V `/admin/permissions:465-487`, `/admin/roles` | Pas de lexique rôle/portée/visibilité/sensibilité | Panneau d'aide contextuel réutilisant `help_guides` | P2 | L1 |
| Protection du dernier administrateur et anti auto-attribution | P garde-fou d'adhésion présent ; à vérifier sur `user_roles` | NE | Déclencheur « dernier ADMIN_BUREAU » + test | P1 | L0 |
| Contacts rapides via « Créer » | P `QuickCreateMenu` : 8 liens, aucun contact | Absent | Fenêtre contextuelle Particulier/Pro/Partenaire/Mairie & institution | P1 | L1 |
| Organisations ↔ interlocuteurs | P `mairies`, `partners`, `entity_mairies` séparés | Pas de lien vers une personne | Table de liaison organisation ↔ `people` | P2 | L1 |
| Jalons | V `project_milestones` (0053) | Les tâches ne sont pas liées aux jalons | `tasks.milestone_id` facultatif | P1 | L2 |
| Catégories thématiques de projet | A (`project_categories` = type de projet global) | Ne pas confondre | Nouvelle table `project_task_groups` par projet ; `tasks.group_id` facultatif | P1 | L2 |
| Rôles d'équipe | P `domain.ts:50-66` : 6 rôles ; `task_assignees` en texte libre ; `project_members` et `project_teams` font doublon | Hors périmètre approuvé | COORDINATOR / RESPONSABLE / CONTRIBUTOR + correspondance des anciens rôles | P1 | L2 |
| Progression | P deux sources : calcul (`archives.ts:22-37`) et `progress_percent` manuel affiché sur les cartes et la mindmap | Incohérence | Une seule formule calculée (§4) ; l'estimation manuelle devient secondaire | P1 | L2 |
| Panneau latéral universel | P `SidePanel`, `ProjectPanel`, `TaskPanel` ; panneau mindmap séparé | Pas de jalon, pas de catégorie, pas d'ouverture par adresse | Panneau ouvert par paramètre d'adresse `?panel=task:id` | P1 | L2 |
| Duplication / modèles | A | — | Fonction `duplicate_project/task` → brouillon | P2 | L2 |
| Avatars sur les cartes | A (`TaskCard.tsx:193-207`) | — | Pile d'avatars avec « +N », sans coordonnées | P2 | L2 |
| Mindmap 2 modes | P vue projets ou projets + tâches | Pas de jalons | Modes Classique (jalons) / Détaillé (jalons + tâches, filtre catégorie) | P2 | L2 |
| Inscriptions | P PENDING/WAITLIST, statut en texte libre, 2 chemins d'insertion | Pas de validateurs, notification, promotion ni statut normalisé | Statuts normalisés, `requires_validation`, validateurs désignés, déclencheur de notification | **P0** | L0 |
| Annulation d'événement | A (« annuler » supprime l'inscription) | — | Action dédiée avec motif, notifications aux inscrits, historique | P1 | L3 |
| Google Calendar | P export .ics et lien seulement | Pas de synchronisation | Envoi unidirectionnel par connecteur, `external_id`, idempotence | P3 | L3 |
| Inventaire contextuel | V réservations Bureau/coordinateur, verrou, visibilité (0054, 0062, 0063) | Pas de demande ni de décision ; réservation liée au projet seulement | Statuts REQUESTED / INFO_REQUESTED / ACTIVE… ; liens activité/événement/tâche | P2 | L3 |
| Notifications : lu ≠ traité | P seulement `is_read` | Pas d'état « traité » | Le traitement se calcule sur l'objet métier ; `is_read` reste un simple état de lecture | P1 | L3 |
| Point jaune Console | A (`AppShell.tsx:267`) | — | Indicateur alimenté par `bureau_console_summary` (+ inscriptions) | P2 | L3 |
| Journal : cycle éditorial | P DRAFT/PUBLISHED ; publication par l'auteur possible via l'API | Faille et cycle trop court | Statuts complets + garde-fou en base ; libellé « Résumé » | P1 | L4 |
| Éditeur riche | A (Textarea) | — | Markdown limité + prévisualisation (pas de nouvelle dépendance lourde) | P2 | L4 |
| Médiathèque | P buckets `blog-media` et `avatars`, documents par URL | Pas d'envoi de documents, d'aperçu PDF ni d'optimisation | Table de liens média ↔ objet ; règle « la plus restrictive » | P2 | L4 |
| Commentaires : modifier | P droit en base pour l'auteur, rien dans l'interface ; pas d'historique | — | `edited_at` + historique ; décisions non modifiables | P2 | L4 |
| Navigation | V `NAV_GROUPS`, `DirectoryTabs` | Ordre et libellés | Journal en tête, « Gestion des adhésions » en tête, « Réglages visuels » | P3 | L5 |
| Carte Journal à l'accueil | A (seulement `UpdatesWall`) | — | Carte à droite du bonjour, articles visibles seulement | P3 | L4/L5 |
| Recette isolée | A | Bloquant pour le GO | Brouillon Lovable avec sa propre base isolée | **P0** | — |

## 3. Modèle cible (extensions, sans refonte)

```text
people (personne) ──1:0..1── profiles (compte) ── user_roles (rôle système)
   │                            │── membership_status / membership_type (adhésion)
   │                            │── pro_details (+ pro_status : DRAFT/PENDING/VALIDATED/SUSPENDED/CLOSED)
   │                            └── member_functions (fonction asso, portée, révocable)
   ├── organization_contacts ──► mairies | partners (organisations)
   └── qualités calculées : PARTICULIER, PRO, BUREAU, BENEVOLE, PARTENAIRE, MAIRIE_INSTITUTION
projects ─< project_milestones
         ─< project_task_groups (catégorie thématique, NOUVELLE)
         ─< tasks (milestone_id?, group_id?, project_id? ≤ 1)
              ─< task_assignees (role : RESPONSABLE ≤1 | CONTRIBUTOR)
         ─< project_members (role : COORDINATOR | RESPONSABLE | CONTRIBUTOR)
         ─< entity_organizations (organisation liée, pas un assigné)
media_assets ─< media_links (objet_type, objet_id)      [Lot 4]
in_app_notifications (+ dedup_key unique)                [Lot 3]
```

Règles :
- `tasks.category` / classification : **absente aujourd'hui**. La seule classification d'une tâche sera donc la catégorie thématique du projet. Pour une tâche hors projet : aucune catégorie.
- `project_teams` fait doublon avec `project_members`. À confirmer en base (Lot 0), puis on gèle `project_teams` sans supprimer de données.
- Aucune suppression de colonne ; les anciennes valeurs de rôle sont converties par correspondance.

## 4. Progression (formule proposée, testable)

- Tâches retenues = tâches du projet dont le statut n'est pas CANCELLED, ARCHIVED ou REJECTED.
- Terminées = COMPLETED ou VALIDATED seulement. PENDING_VALIDATION ne compte pas comme terminée.
- Progression projet = arrondi(100 × terminées / retenues). Aucune tâche retenue : affichage « — ».
- Progression d'un jalon (ou d'une catégorie) = même formule sur ses tâches. Chaque tâche a au plus un jalon et une catégorie, donc il n'y a **aucun double comptage** dans le projet.
- Les tâches BLOCKED sont comptées dans les retenues et affichées à part (« 2 bloquées »).
- L'estimation manuelle `progress_percent` reste affichée sous le libellé « Estimation », jamais sur la barre principale.

## 5. Visibilité projet/tâche et cloisonnement (règle exacte proposée)

- Lecture interne (projet, tâche, commentaires, documents) = Bureau OU membre de l'équipe OU (`is_active_member` ET visibilité ∈ {ASSOCIATION, HELP_OPEN}).
- `HELP_OPEN` (nouvelle valeur) : un particulier actif voit la fiche et peut proposer son aide par `contributions`.
- PENDING/REFUSED : rien d'interne. Un appel à l'aide public éventuel passe par une fonction de lecture qui renvoie seulement le titre, le besoin et la manière de proposer son aide (pas de commentaires, pièces ou coordonnées).
- `can_view_comment_target` est aligné strictement sur la lecture de l'objet parent.

## 6. Parcours clés (résumé)

- **Contact rapide** : « Créer » → choix du type → fenêtre (nom minimal, le reste facultatif) → enregistrement → disponible tout de suite dans le sélecteur ouvert. Aucun compte créé.
- **Panneau** : clic depuis une liste, la mindmap ou une carte → le panneau s'ouvre (`?panel=`), les filtres sont conservés ; fermeture avec Échap ; pleine largeur sur mobile.
- **Inscription** : demande → (validation requise ? PENDING + notification aux validateurs désignés : CONFIRMED) → liste d'attente → promotion. Une file « À traiter » est visible dans la console.
- **Annulation d'événement** : bouton dédié → motif facultatif → statut CANCELLED → notification à chaque inscrit → mise à jour du calendrier.
- **Journal** : brouillon → à relire → à corriger / validé → programmé → publié → archivé ; publication réservée à la permission `blog.publish`.

## 7. Médias et documents

- Un fichier stocké une seule fois (`media_assets`), relié N fois (`media_links`).
- Droit effectif = intersection (fichier, objet parent, utilisateur).
- Bucket privé, liens signés de courte durée, miniature générée à l'envoi (navigateur, sans nouvelle dépendance), limite de taille, chargement différé, aperçu PDF par le lecteur du navigateur.
- Liens Drive/Canva : signalés comme « hors protection LVDC », classification obligatoire, jamais SENSIBLE en partage.
- À corriger : la fonction publique des articles signe encore des médias réservés aux membres.

## 8. Migrations prévues (toutes additives)

- L0 : aucune.
- L1 : `pro_details.pro_status` ; garde-fous de la fiche pro ; fonction `picker_people()` ; normalisation des clés de représentants ; `organization_contacts` ; garde-fou du dernier administrateur.
- L2 : `tasks.milestone_id` et `group_id` ; `project_task_groups` ; correspondance des rôles ; durcissement RLS PENDING/REFUSED + valeur `HELP_OPEN` ; `duplicate_project` et `duplicate_task`.
- L3 : `activities/events.requires_validation`, table des validateurs, normalisation des statuts d'inscription, notification et promotion depuis la liste d'attente, annulation, `dedup_key`, statuts des demandes de matériel, `external_calendar_id`.
- L4 : statuts du journal + garde-fou, `comments.edited_at` + historique, `media_assets` / `media_links`, statut d'information demandée sur les remboursements.

Chaque migration : comparaison préalable au schéma réel, test d'abord dans l'environnement isolé, aucune suppression.

## 9. Lots

- **Lot 0 — Audit et recette isolée** (entrée : votre accord).
  - Lecture seule du registre des migrations, de `pg_policies` et des fonctions déployées, comparée au repo.
  - Diagnostic des inscriptions bloquées sur les lignes réelles, en lecture seule.
  - Création d'un **brouillon Lovable avec base isolée** et de comptes fictifs (public, pending, refused, particulier, pro, coordinateur, représentant, Bureau).
  - Rejeu de `scripts/rls/*` contre ce brouillon.
  - Sortie : rapport d'écarts + environnement prêt.
- **Lot 1 — Identité, qualités, droits et contacts.** Sortie : MemberPicker multi-filtres, contacts rapides, failles de la fiche pro fermées, tests de rôle verts.
- **Lot 2 — Projets.** RLS durcie en premier (critère GO n° 1), puis jalons, catégories, rôles, progression, panneaux, mindmap et duplication.
- **Lot 3 — Inscriptions** (P0 avancé si possible), annulation, inventaire contextuel, notifications ciblées, point Console, Google Calendar (en dernier).
- **Lot 4 — Journal**, commentaires, médiathèque, guides et fiches de poste (actions sur la fiche, archivage par défaut).
- **Lot 5 — Navigation et réglages visuels** : réordonnancements, « Réglages visuels », carte Journal. Ce lot est léger et peut être livré tôt si vous le souhaitez.
- **Lot 6 — Recette sécurité finale et GO/NO-GO.** Des contrôles de sécurité ont aussi lieu à chaque lot (linter, scripts RLS, Playwright par rôle).

Tests à chaque lot : vitest pour les règles (progression, qualités, statuts), scripts API par rôle sur la base isolée, accès direct par adresse, mobile et clavier.

## 10. Arbitrages (recommandation par défaut, marquée PROPOSITION)

1. Recette = brouillon Lovable avec base isolée (PROPOSITION) — **validation requise**.
2. Qualité pro portée par `pro_details.pro_status`, adhésion inchangée (PROPOSITION).
3. Catégories thématiques : nouvelle table par projet, distincte de `project_categories` (PROPOSITION).
4. Anciens rôles VOLUNTEER/EXPERT/REVIEWER → CONTRIBUTOR, OWNER → COORDINATOR (PROPOSITION) — validation requise.
5. Ouverture publique de l'aide aux non-membres : oui ou non — **décision humaine**.
6. Éditeur : Markdown limité plutôt qu'un éditeur visuel complet (PROPOSITION).
7. Google Calendar : quel agenda associatif connecter — **décision humaine** (Lot 3).
8. Bénévole : qualité calculée à partir de quelle source (fonction asso BENEVOLE ou contribution acceptée ?) — à confirmer.

## 11. Première action après validation

Lancer le **Lot 0** : audit en lecture seule de la base déployée par rapport au repo, puis création du brouillon isolé.

- **État du Lot 0** : prêt à démarrer. Il est bloqué uniquement par votre accord sur l'arbitrage n° 1.
- **Lot suivant** : Lot 3 partiel (inscriptions bloquées, P0) en parallèle du Lot 1.
