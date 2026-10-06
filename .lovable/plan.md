# A11 → A13 — Gouvernance, modèle métier, projets, activités, terrain

Démarche : trois étapes avec un point de contrôle à la fin de chacune. Tout est ajouté à côté de l'existant : rien n'est supprimé, aucun système parallèle. On réutilise la grille de sécurité A10.

## Ce qui existe déjà (et sera réutilisé)
- Rôles et permissions : roles, user_roles, permissions, role_permissions, user_permission_overrides. Fonctions associatives : member_functions (encore liées au compte, pas à la personne).
- Projets : project_members (avec un rôle projet), project_teams, tasks, task_assignees, contributions.
- Activités : activities, avec organisateur, professionnels, consignes et chiens. Inscriptions : participations et leurs liens vers les membres et les chiens.
- Terrain : terrain_resources et terrain_reservations (catégorie d'usage, liens vers une activité, un événement, un projet ou une tâche, matériel, demandeur, décision du Bureau). Une réservation peut déjà réunir plusieurs professionnels, personnes et chiens. La base refuse déjà les chevauchements.
- Chiens : référents, accès des professionnels, partage via share_dog_access, rubriques privées.

## A11 — Gouvernance et responsabilités dans un contexte
1. member_functions : ajouter person_id, scope_type (ASSOCIATION / PROJECT / ACTIVITY / TERRAIN) et scope_id. Une fonction ne donne jamais de droit global à elle seule.
2. Nouvelle table `delegations` : qui délègue, à qui, quelle permission, sur quoi, pour quelle période, motif, révocation. Règles contrôlées par la base : on ne délègue que ce qu'on possède soi-même, la délégation porte sur un périmètre précis, et une date de fin est obligatoire (365 jours maximum).
3. Fonction `has_scoped_permission(user, code, scope_type, scope_id)` : elle combine le rôle global, les responsabilités dans le contexte et les délégations. Elle vient s'ajouter à has_permission, sans la remplacer.
4. `is_project_coordinator(user, project)` : se fonde sur project_members.project_role = COORDINATOR. Un coordinateur gère seulement son projet (équipe, tâches, réservations du projet).
5. Écran Bureau « Gouvernance » : fonctions et responsabilités par personne, délégations, historique tiré du journal d'audit.
- **Point de contrôle 1** : un coordinateur du projet X n'obtient aucun droit sur le projet Y ni sur les pages du Bureau. Une délégation expirée ou retirée ne donne plus aucun accès.

## A12 — Personnes, chiens, indicateurs
1. Indicateurs du chien : nouvelle table `dog_indicators` (dog_id, family VERT / JAUNE / BLEU / NOIR, libellé neutre obligatoire, catégorie : interaction chien/chien, interaction chien/humain, espace, approche, environnement, besoin spécifique ; note facultative). Il n'y a ni note, ni score, ni classement. Un indicateur s'affiche toujours avec une icône et son libellé, jamais par la couleur seule.
2. Qui peut voir les indicateurs : le propriétaire et son foyer, le référent, un professionnel qui a un accès opérationnel (activité, événement ou réservation terrain) et le Bureau. Ce sont des informations « opérationnelles » : elles sont visibles sans ouvrir le dossier privé.
3. Qui peut les modifier : le propriétaire, et le référent si le propriétaire l'a autorisé.
4. Vérification de la structure personne → compte → foyer → chien → participation. Le point bloquant d'A9 reste ouvert (une adhésion ou un foyer sans compte) : il n'est **pas** traité ici, il faut d'abord votre accord.
- **Point de contrôle 2** : personne sans compte, ancien membre, foyer avec plusieurs chiens, chien suivi par plusieurs professionnels.

## A13 — Projets, tâches, activités, terrain
1. Tâches : ajouter activity_id et terrain_reservation_id (facultatifs) et team_id. Les droits dépendent du projet, à travers is_project_coordinator.
2. Activités : ajouter la catégorie (collective, éducative, sportive, formation, événement, promenade, entraide, autre), le matériel et la réservation terrain liée (terrain_reservation_id).
3. Réservation terrain :
   - catégorie de travail limitée à la liste demandée (Éducation, Sport, Collectif, Formation, Accompagnement, Événement, Projet associatif, Autre) ;
   - `access_mode` GRATUIT / LOCATION et `rental_terms` (conditions fixées par le Bureau). Il n'y a **aucun** prix calculé, aucune facture et aucun paiement ;
   - matériel : on distingue le matériel demandé et le matériel accordé (`equipment_granted`) ;
   - statuts : DRAFT, PENDING, CHANGES_REQUESTED, APPROVED, REFUSED, CANCELLED. Seul le Bureau valide, refuse ou demande une modification. Le demandeur peut corriger sa demande quand une modification est demandée, puis la soumettre à nouveau. Le contrôle des chevauchements ne compte que les réservations en attente ou validées ;
   - peuvent faire une demande : un professionnel validé, le Bureau, le coordinateur du projet concerné, l'organisateur de l'activité ;
   - pour chaque chien participant, on peut indiquer le référent (`referent_professional_id`). Être présent sur une réservation ne donne pas accès au dossier privé (règle A10 inchangée).
4. Écran Terrain revu : formulaire complet, liste des demandes et décisions du Bureau. Il reste simple : l'interface finale arrive en A14.

## Socles pour A14–A16 (préparés, sans construire l'interface finale)
- `EntityPeek` : une petite fenêtre unique (personne, chien, professionnel, activité, projet, réservation, tâche, événement, document). Une fonction `entity_peek(type, id)` ne renvoie que les champs autorisés et indique si l'utilisateur peut ouvrir la fiche complète.
- `ContextualFab` : un seul bouton flottant. Chaque page déclare ses actions possibles, filtrées selon les permissions. Il remplace le « + Créer » actuel au lieu de s'y ajouter.
- Cockpit Bureau : une nouvelle section « Besoins de décision » (réservations en attente, contributions, validations de professionnels, tâches bloquées, délégations qui expirent).

## Tests (script API avec les vrais comptes d'essai)
Les 23 scénarios demandés : demande de terrain par un professionnel, réservation individuelle et collective, plusieurs chiens et plusieurs professionnels, formation, événement du Bureau, terrain lié à un projet ou à une tâche, matériel, gratuit et location, validation, refus, demande de modification, annulation, conflit d'horaire, référent, professionnel associé sans accès au dossier, partage explicite, indicateurs, personne sans compte, ancien membre, coordinateur limité à son projet.

## Détails techniques
- Une migration par étape (A11, A12, A13), uniquement des ajouts : colonnes facultatives ou avec valeur par défaut, contraintes ajoutées sans revalider les lignes existantes quand c'est nécessaire.
- Les nouvelles fonctions protégées appliquent les mêmes règles qu'en A10 : chemin de recherche fixé, identité de l'appelant vérifiée et EXECUTE retiré au public pour les fonctions internes.
- Les nouvelles règles sont ajoutées dans AGENTS.md et la grille des droits est mise à jour.
- On s'arrête si un point de contrôle échoue.
