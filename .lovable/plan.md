# UX finale A14–A16 — expériences par rôle, notifications et recherche

## Objectif
Rendre la plateforme simple à comprendre selon le rôle et le contexte, sans remplacer la navigation, les données, les rôles, les permissions ou les protections existantes.

## 1. Navigation par intentions et accueil adapté
- Réorganiser la navigation existante autour de : Aujourd’hui, Participer, Contribuer, Projets, Activités / événements, Communauté, Ressources, Gouvernance, Intelligence et Mon espace.
- Calculer les entrées visibles depuis les rôles et permissions déjà chargés ; conserver les contrôles de sécurité côté base.
- Orienter chaque rôle vers son accueil utile : particulier/bénévole/référent, professionnel, coordinateur, Bureau.
- Sur mobile, remplacer la longue rangée horizontale par les accès essentiels et un menu complet facilement ouvrable.

## 2. Action contextuelle unique « + Créer »
- Ajouter un seul bouton global, visible sur ordinateur et mobile.
- Proposer uniquement les créations déjà disponibles et autorisées : projet, tâche, activité, événement, proposition, demande d’aide, document, participation ou réservation.
- Réutiliser les pages et panneaux existants ; ne créer aucun flux parallèle.

## 3. Dashboards utiles par responsabilité
- Particulier : rendez-vous, participations, foyer/chiens, contributions et prochaines actions.
- Bénévole/référent/coordinateur : responsabilités contextualisées, projets, équipe, tâches, blocages et échéances.
- Professionnel : accompagnements autorisés, activités, événements, réservations, collaborations et tampons.
- Bureau : validations, demandes de terrain, gouvernance, ressources, alertes, documents et finances, avec accès direct aux objets concernés.

## 4. Fiches contextuelles et données sensibles
- Généraliser la fenêtre existante sécurisée aux personnes, chiens, professionnels, projets, activités, événements, réservations, tâches, documents et participations.
- Brancher la fenêtre dans les listes importantes sans en faire un second tableau de bord.
- Enrichir la fiche personne et les fiches chien existantes par blocs autorisés ; afficher les indicateurs VERT/JAUNE/BLEU/NOIR avec un vocabulaire neutre et contextualisé.
- Ne jamais exposer un champ sensible par simple masquage visuel : les fonctions et politiques existantes restent la source des données affichables.

## 5. Terrain opérationnel
- Conserver le cycle DRAFT → PENDING → décision Bureau et les contrôles de chevauchement existants.
- Ajouter à la réservation les personnes, chiens, professionnels et contexte métier déjà modélisés, avec sélection adaptée au rôle.
- Afficher des cartes courtes sur mobile, l’état, la prochaine action et la décision du Bureau.
- Utiliser la fenêtre contextuelle pour les détails autorisés ; aucun professionnel associé n’obtient automatiquement le dossier complet d’un chien.

## 6. Notifications A15
- Compléter les catégories : commentaire/mention, validation/refus, affectation, inscription, événement, aide, document partagé, réservation et changement personnel.
- Centraliser les libellés et destinations, garder le centre de notifications et la cloche temps réel existants.
- Générer les notifications sensibles côté base ou par une fonction authentifiée vérifiant permission et contexte ; ne pas accepter de destinataire arbitraire depuis l’interface.
- Respecter les préférences internes/e-mail existantes ; préparer le push sans l’activer tant qu’aucun canal push n’est configuré.

## 7. Recherche globale A16
- Étendre la recherche aux personnes, chiens, professionnels, projets, activités, événements, tâches, documents, ressources et participations.
- Remplacer les requêtes dispersées par une fonction de recherche filtrée en base qui ne retourne que les objets ouvrables par l’appelant.
- Ouvrir les résultats dans leur fiche ou fenêtre contextuelle, avec filtres par type et date.
- Ne jamais révéler le titre, le nombre ou l’existence d’un objet non autorisé.

## 8. Public, mobile et accessibilité
- Conserver la page publique associative et y agréger uniquement les activités, événements, projets, actualités, partenaires et appels explicitement publics.
- Ne publier un professionnel que via la validation publique existante ; aucune fiche individuelle de membre ou chien.
- Maintenir navigation clavier, focus visible, annonces de chargement, libellés explicites, cibles tactiles et contraste des jetons existants.
- Corriger les écrans d’erreur et la langue du document pour une expérience entièrement française.

## 9. Validation
- Tester par connexion réelle : particulier, professionnel, référent, coordinateur et Bureau.
- Pour chaque profil : accueil, navigation, + Créer, recherche, notifications, fiche personne, fiche chien, terrain et fenêtre contextuelle.
- Tester les refus : données sensibles, objet hors périmètre, partage révoqué/expiré, recherche sans fuite et notification sans information interdite.
- Vérifier ordinateur et mobile, clavier seul, états vide/chargement/erreur et absence d’erreur de compilation ou d’exécution.

## Ordre d’exécution
1. Navigation, rôle d’accueil et + Créer.
2. Dashboards particulier/pro/coordinateur-référent/Bureau.
3. Fiches contextuelles personne/chien et branchement transversal.
4. Terrain multi-contexte.
5. Notifications sécurisées.
6. Recherche sécurisée en base.
7. Page publique, mobile, accessibilité et tests complets.

## Points conservés
- Modèle `people` / profils / foyers / chiens existant.
- RBAC, responsabilités contextualisées, délégations, RLS et fonctions A10–A13.
- `AppShell`, tableaux de bord, `EntityPeek`, centre de notifications, recherche globale et écrans terrain existants.
- Aucun profil enfant, aucun score, classement ou réputation publique.

## Hypothèses et limites
- Le push nécessite ultérieurement un canal FCM et ses consentements ; cette phase prépare l’interface et les événements internes.
- Les créations utilisent les écrans/panneaux actuels ; si une création n’existe pas encore, le bouton mène à la page concernée plutôt que de dupliquer son formulaire.
- Toute divergence entre l’interface et une politique de sécurité bloque uniquement le flux concerné jusqu’à correction côté base.
