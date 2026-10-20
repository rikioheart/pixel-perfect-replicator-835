# Roadmap — Refonte collaborative (style Monday/ClickUp)

## Liens des partenaires — demande actuelle
- [x] Examiner les profils existants et leurs choix de publication
- [x] Afficher site et réseaux publiés sur les fiches compactes, sans données privées ni doublons
- [ ] Vérifier les tests et la page publique ; préciser l’absence de profils disponibles

## Simplification publique — 19 octobre
- [x] Partenaires compacts sans description, depuis les profils publiés uniquement
- [x] Page Professionnels renommée Partenaires sans changement d’adresse
- [x] Accueil : description des activités sans cartes ; Agenda conservé
- [x] Vérification des pages et conseil sur le retrait de l’onglet Activités

  - 9 tests publics réussis ; accueil, association et partenaires vérifiés à 1280 et 390 px, sans débordement ni erreur JavaScript. Accès membre vérifié. Aucun profil public disponible : publication/modification réelle d’une fiche non testée. Onglet Activités conservé en attendant décision explicite.

## Lot 22 — Site public inspiré de paws-places
- [x] Comparer le ZIP et le dépôt public, sans importer accès ni données
- [x] Harmoniser accueil, association, activités, agenda, articles et annuaire ; préserver intégralement la connexion
- [x] Améliorer navigation mobile, référencement et repères interactifs
- [x] Vérifier pages, filtres, lecture et connexion sur téléphone et ordinateur
  - 37 tests réussis, aperçu compilé sans erreur, six pages publiques contrôlées à 1280px et 390px sans débordement ni erreur JavaScript. Menu mobile, fiches partenaires, guides et onglets connexion/inscription vérifiés. Canonicals uniques, sitemap public et présentation structurée de l’association ajoutés.
  - Connexion, codes, administration, données et permissions inchangés. Aucun import des accès, migrations ou sauvegardes de l’autre projet.
  - Limites : carte sans professionnels publiés et agenda sans activité publique lors du contrôle ; ni réservation ni nouvelle authentification testées dans ce lot visuel. Aucun ajout Google Business. Mise en ligne et effets SEO publics attendent une publication.

## Lot 21 — Site internet unifié : vitrine, carte et agenda
- [x] Page d'accueil transformée en vraie vitrine : en-tête et pied de page communs à toutes les pages publiques, réseau (77/45/89/91), bloc « Nos activités » repris du WordPress
- [x] Page /services : contenus Bilan, Éducation, Rééducation, Sport, Ateliers, Balades repris du site lavoixduchien.fr (src/lib/site-content.ts) avant sa suppression
- [x] Carte interactive sur /professionnels (Leaflet, géocodage par ville via Base Adresse Nationale, clic = filtre de localisation, fiches liées dans les repères)
- [x] Page /agenda : activités publiques des 12 prochains mois via RPC list_public_activities (migration 0026), mois groupés, filtre par catégorie, places restantes, prix ; bouton Réserver connecté, « Se connecter pour réserver » sinon
- [x] 37 tests réussis, pages publiques vérifiées sans erreur JavaScript
  - Limites : agenda et carte vides tant qu'aucune activité publique ni professionnel validé n'existe ; réservation non vérifiée (pas de session) ; contenus détaillés par page (Education, Rééducation…) résumés, les longs textes WP restent à reprendre si souhaité.

## Lot 20 — Annuaire public, prototype et WordPress
- [x] Vérifier le prototype disponible, les sources WordPress et les annuaires existants
- [x] Réutiliser la vitrine et les fiches publiques ; recherche et filtres sans répétitions
- [x] Intégrer les informations publiques vérifiées sans créer de comptes ni modifier les droits
- [x] Tester les liens, les filtres et l’affichage téléphone/ordinateur ; documenter les limites
  - 28 partenaires WordPress et visuels officiels, lecture publique serveur sans copie en base ; fusion avec le RPC public existant. Aucune migration ni modification RLS.
  - 33 tests réussis ; 28 dialogues, liens sûrs, recherche, filtre commercial (7 résultats), absence de résultats et navigation depuis la vitrine vérifiés. Affichage téléphone et ordinateur sans débordement ni erreur JavaScript.
  - Limites : disponibilité des données WordPress requise, lien officiel de secours ; aucune vérification exhaustive de la disponibilité des sites externes ni des profils authentifiés dans ce lot public. Les réductions et codes privés restent exclus. Les fiches plateforme publiées seront utilisées lorsqu’un professionnel y consent ; le RPC public était vide lors du contrôle.

## Lot 19 — Nettoyage visuel validé
- [x] Alléger accueil membre, préférences, profil et gestion des chiens sans retirer les fonctions
- [x] Épurer espace pro et Bureau ; supprimer les raccourcis et bandeaux redondants
- [x] Vérifier liens, tests et affichage ordinateur/téléphone ; documenter les profils non vérifiables
  - 28 tests réussis ; pages modifiées vérifiées avec particulier, professionnel et Bureau. Liens statiques contrôlés dans l’audit précédent.
  - Limite : aucun compte dédié bénévole/référent ou coordinateur identifié pour une vérification exhaustive ; les dossiers et parcours contextuels non vides restent à tester.

## Harmonisation et hors réseau — demande actuelle
- [ ] Alléger les onglets personnels sans supprimer les pages, barre mobile et confort de lecture
- [ ] Vitrine publique vivante, activités publiques du mois, partenaires et accès 2/3 + 1/3
- [ ] Préparation hors réseau : vitrine publique, pass personnel et tampons en attente sécurisés
- [ ] Tests automatiques et vérifications ordinateur/téléphone ; préciser les limites hors réseau

## Lot 1 — Création rapide "panneau latéral" partout
- [ ] Bouton + / onglet "Nouveau" avec panneau latéral (Sheet) sur : Activités, Événements, Partenaires (+ avantages), Professionnels
- [ ] Idem sur Projets et Tâches (création + édition au clic sur une carte)
- [ ] Ajout direct de membres concernés (bureau / pro / partenaire / particulier) sur projet et tâche
- [ ] Notification aux participants lors d'une modification

## Lot 2 — Navigation & visibilité par rôle
- [ ] Mindmap déplacé sous "Cockpit Bureau" (en haut)
- [ ] Notifications en haut du cockpit bureau
- [ ] Fidélité → "Engagement" pour le bureau ; retrait Finances pour les particuliers
- [ ] Particuliers : masquer Documents et Mindmap ; préférences "quoi voir / ne pas voir"
- [ ] Règles de fidélité / Paramétrage / Permissions / Rôles en bas de la nav

## Lot 3 — Espace professionnel qualifié
- [ ] Champs légaux : entreprise, SIRET, formations (multiples), codes promo / avantages
- [ ] Documents contrat / clause de partenariat (upload ou lien)
- [ ] Liens site web + réseaux sociaux + description sur partenaires et pros
- [ ] Liste des pros synchronisée avec les rôles (représentant pro, professionnel, bienfaiteur)

## Lot 4 — Calendrier & réservations terrain
- [ ] Calendrier partagé (événements, activités, réservations) pour les 3 espaces
- [ ] Réservation terrain par le pro : ressource, date, horaires, objet, tarif horaire
- [ ] Automatisation financière + validation bureau + notification
- [ ] Intégration Google Calendar (export/abonnement iCal)

## Lot 5 — Cockpit bureau actionnable
- [ ] Cases du tableau de bord cliquables → onglet concerné ou récap latéral avec actions
- [ ] Inventaire : catégories (mastication, jeux, olfaction, sport, événement, produits partenaires, documents/flyers, autre), vue kanban/tableau, liaison à un projet ou une tâche
- [ ] Rôles & habilitations : lignes repliables (nom seul + entreprise si pro)
- [ ] "Notre façon de travailler" : textes éditables
- [ ] Paramétrage : édition en place de toutes les entrées existantes

## Lot 6 — Mindmap avancée
- [ ] Retrait de la minimap (carré gris)
- [ ] Réagencement automatique des liens Asso → projets → tâches → sous-tâches au déplacement
- [ ] Détacher / rattacher un nœud avec requalification auto (projet / tâche / sous-tâche), réservé au bureau
- [ ] Tri par catégorie + notification bureau à chaque ajout

## Lot 7 — Participation & fidélité
- [ ] Demander à rejoindre / proposer son aide sur un projet ou une tâche (hors mindmap)
- [ ] "Mon espace" particulier : récap des activités/événements rejoints
- [ ] Page fidélité : historique présentiel + quel pro / quelle activité a tamponné
- [ ] Historique de tampons visible sur chaque profil particulier
- [ ] Éligibilité carte de fidélité à la création d'événement
- [ ] Événements/activités : lien Google Maps, visio/distanciel, participants, visibilité (tous / pros+bureau / bureau)
- [ ] Documents : kanban par catégorie + visibilité "bureau & professionnels"
- [ ] Profil : plus de catégories et de types modifiables

## Lot 8 — Migration Pilot-Asso (page par page, sans écraser l'existant)
- [x] Statistiques stratégiques
- [x] Mes participations
- [x] Mon espace personnel (récap + préférences d'affichage)
- [x] Centre d'aide + demandes d'aide
- [x] Annuaire complet (Directory) + import CSV d'adhérents
- [x] Mon historique (journal de mes actions)
- [x] Calendrier partagé (activités, événements, formations, réservations)
- [x] Formations & lives (inscriptions)
- [x] Avantages adhérents & codes promo
- [x] Concours, calendrier de l'Avent, animations membres
- [x] Paiements, remboursements
- [x] Stock / inventaire détaillé (recherche, filtres, alertes)
- [x] Page publique de l'association + carte pro publique

## Lot 9 — Intégrations externes (demandé 18/09)
- [ ] Google Calendar (synchronisation agenda)
- [ ] Météo (activités terrain)
- [ ] Google Drive (documents et photos)
- [ ] Liens Google Forms (questionnaires / formulaires)

## Corrections post-test (19/09)
- [x] Liaison Centre d'aide / Demandes d'aide → profils (noms affichés)
- [x] Garde "réservé au Bureau" sur Import d'adhérents et Adhérents
- [ ] Test du profil particulier (compte à créer)

## Lot collaboration (22/09) — fait
- [x] Fils de discussion (projets, tâches, événements, documents)
- [x] Liens de partage externe + page publique /partage/:token
- [x] Recherche globale (Ctrl/⌘ + K) avec filtres et date
- [x] Conseiller d'équipe (recommandations priorisées)
- [x] Écrans Mairies & institutions et Propositions
- [x] Menu mobile complet (pages principales incluses)

## Lot 10 — Pros, QR, foyers, inscriptions (prompts 3 & 4) — fait
- [x] Modèle foyer/enfants/chiens, accès partagés, référents
- [x] Carte pro publique /professionnels/[slug], QR, espace pro, validation Bureau
- [x] Fiche activité + parcours « Je participe » (capacité, liste d'attente)
- [x] Page Mon foyer (adultes, enfants, chiens, partage, référents)
- [x] Événements : parcours d'inscription familial

## Lot 11 — Projets, contributions, parcours (prompt 5) — fait
- [x] contributions, project_memberships, tasks.contribution_id
- [x] Fiche projet enrichie + « Comment aimeriez-vous contribuer ? »
- [x] Parcours « Je veux aider » traité par le Bureau
- [x] Mur « Ce que nous construisons ensemble » + préférence show_association_updates (public = publications publiques)
- [x] Timeline « Mon parcours avec La Voix du Chien » (liens vers chiens sans détails)
- Interdit : score, classement, top contributeurs

## Lot 12 — A11→A13 gouvernance, métier, terrain
- [x] Responsabilités contextuelles, délégations, coordinateur limité
- [x] Indicateurs chien, fiche contextuelle (entity_peek)
- [x] Réservation terrain : catégories, gratuit/location, matériel, cycle de validation
- [ ] Écran Bureau « Gouvernance » et « Besoins de décision » (A14)
- [x] Action contextuelle unique « Créer » selon rôle et permissions (A14)
- [x] Navigation par intentions, recherche sécurisée, notifications et fiches contextuelles (A15–A16)

## Lot 13 — A17→A20 calendrier, documents, formulaires
- [x] Calendrier unique (agenda/semaine/mois) depuis les sources métier, conflits terrain signalés, fiches contextuelles
- [x] Documents rattachés à un contexte (activité, événement, projet, réservation…) + sensibilité
- [x] Formulaires (publics/internes, liés au contexte), soumission contrôlée, rapprochement de personne à valider
- [ ] Formulaires et documents dans la recherche globale (A21)
- [ ] Tests authentifiés par rôle et mobile des nouveaux parcours
- [ ] Liaison Google Drive (connexion à faire par l'utilisateur)

## Lot 14 — A21→A26 finances, HelloAsso, IA
- [x] Suivi financier opérationnel (Bureau + droit finances), justificatifs, statuts, journal d'audit
- [x] Locations de terrain suivies sur décision du Bureau (jamais automatiquement)
- [x] Export CSV + copie pour tableur ; import HelloAsso idempotent avec journal et validation des cas ambigus
- [x] Assistant IA sur projets et formulaires (résumé, incohérences, compte rendu), validation humaine tracée
- [ ] Google Sheets en direct (connexion Google à faire par l'utilisateur)
- [ ] Synchronisation HelloAsso automatique (identifiants API HelloAsso à fournir)
- [ ] Rattacher une adhésion « personne sans compte » à la création du compte
- [ ] Tests IA par rôle avec comptes d'essai (fuite, référent, partage)

## Lot 15 — Liens externes (niveaux 1-2)
- [x] « Ajouter une ressource » sur projets, activités, événements (coller un lien, titre facultatif, ouvrir)
- [x] Reconnaissance indicative Drive/Docs/Forms/Sheets/Agenda/Meet/Rintintin, lien générique sinon
- [x] Liens sur tâches, réservations terrain, formations (même composant, à placer)
- [ ] Connecteur Rintintin : en attente de confirmation officielle d'une API

## Lot 17 — Stabilisation
- [x] Menu : état « Tout le reste » et défilement mémorisés, tiroir mobile fermé au changement de page
- [x] Statut pro via la base (menu, création rapide, formations)
- [x] Onglets « Mon Compagnon & Moi » reliant les pages personnelles existantes
- [ ] Remplacer les détections pro restantes (statistiques, annuaire, avancées, accueil membre)
- [ ] Vérifier connecté particulier/pro sur mobile

## Lot 18 — Harmonisation et hors réseau
- [x] Vitrine deux tiers / connexion un tiers, photo, valeurs et activités publiques du mois depuis projection SQL dédiée
- [x] Site configurable via EXTERNAL_LINK / ASSOCIATION_WEBSITE (URL dans description), découverte des partenaires validés
- [x] Quatre univers personnels conservant les dix pages ; barre basse mobile par rôle ; accordéons mémorisés mobile/PC
- [x] Préférences de lecture appliquées, mouvement réduit, focus visible, cibles tactiles, fonds et cartes harmonisés
- [x] QR généré localement ; pass sauvegardé sur le téléphone ; copie vitrine publique hors réseau
- [x] Tampons locaux en attente, isolés par compte ; RPC existant pour confirmation ; demandes d’un autre jour ou refusées à vérifier sans rejeu automatique
- [x] 28 tests unitaires ; navigateur 1280px et 390px sans erreur ; menu mémorisé ; pass et file locale testés sans attribution serveur
- [ ] Vérification du service worker après publication (désactivé volontairement en aperçu)
- [ ] Synchronisation réelle avec compte professionnel validé et contrôle des notifications Bureau
- [ ] URL officielle du site à renseigner dans la configuration existante

Limites : stockage local minimal, effacé à la déconnexion ; pas de dossiers chiens privés mis en cache. Sans réseau, aucune adhésion ou attribution n’est certifiée. La synchronisation nécessite de rouvrir l’espace pro avec du réseau le jour même. Après changement de jour, vérifier avec le Bureau (RPC actuel utilise la date serveur). Aucune migration historique supprimée ou rejouée.
- [x] Lot 23 : site public pleine largeur, polices du prototype (Fraunces/Outfit), 3 activités d'exemple ; pros réels à saisir par le Bureau
