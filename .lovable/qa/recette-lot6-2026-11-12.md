# LVDC — Lot 6 : recette générale prépublication (audit de release)

> Rapport interne. Aucune publication, aucun déploiement, aucune correction de code pendant la recette.
> Une case non testée ne vaut pas PASS.

## 1. Résumé exécutif

**Décision : NO-GO.**

Motifs :
1. **Pas d'environnement de test isolé (blocage de recette).** L'aperçu et le site publié utilisent la **même base réelle** (6 comptes, dont 3 personnes réelles). Conformément à la règle I, aucun test qui écrit (création de projet, tâche, inscription, tampon, réservation, remboursement, notification, changement de droits) n'a été exécuté. Tous les flux d'écriture sont **BLOCKED**.
2. **P1 confidentialité (à confirmer par le Bureau) :** toute personne qui crée un compte, même **en attente ou refusée**, peut lire les projets « Association », leurs tâches, commentaires, membres et jalons, les actualités internes, les noms de l'annuaire, la liste du Bureau, les documents non sensibles et les fichiers du journal (y compris brouillons). Constaté par lecture des règles d'accès de la base et par l'analyseur de sécurité ; non rejoué en direct faute de compte « en attente » de test.
3. **Couverture des rôles incomplète :** pas de mot de passe ni de session pour le compte professionnel seul (pro@), pas de compte bénévole/référent dédié, pas de coordinateur de projet hors Bureau, pas de compte « en attente ». Ces colonnes sont **BLOCKED**.
4. **Accessibilité :** boutons-icônes sans nom accessible sur des écrans essentiels (Notifications : 13 à 18 boutons, Centre d'aide, Mindmap, Adhérents, Historique).
5. **Lint en échec** (8 996 remarques, dont 8 970 de pure mise en forme).

Points solides mesurés : 0 erreur JavaScript sur 194 chargements de pages, 0 lien interne cassé, refus d'accès corrects pour le particulier sur les 23 pages Bureau/Pro (interface **et** base), aucune violation de contraste sur 11 variantes d'affichage × 10 écrans, 346 tests automatiques réussis, aucune fonction interne appelable sans connexion en dehors des 6 fonctions publiques prévues.

## 2. Version et environnement testés

| Élément | Valeur |
|---|---|
| Date du run | 2026-11-12, 18:48 → 19:20 UTC |
| Commit testé | `7205e8921da5650ffad5546d584bf8bd3e0e35da` (« Corrigé menu et pages », 18:47 UTC) — inclut les ajustements publics (menu réduit à Accueil, agenda, annuaire, Nous écrire) |
| Application | `tanstack_start_ts` (pas de numéro de version applicatif dans package.json) |
| Migrations | 0000 → **0073** appliquées (`0073_user_preferences_show_recognition`). Historique : 1 ligne de base sans fichier correspondant (époque 0046/0047), sans réparation possible automatiquement |
| Environnement | Aperçu local (serveur de développement) relié à la **base réelle partagée** avec le site publié |
| Navigateur | Chromium (Playwright déjà présent), axe-core déjà téléchargé ; aucune dépendance ajoutée |
| Comptes utilisés | visiteur anonyme ; membre@ (particulier ACTIVE, fonctions Référent + Coordinateur au niveau association, bénévole sur 1 projet) ; bureau@ (Bureau + professionnel + fondateur) |
| Écriture en base pendant la recette | **Aucune volontaire.** Une requête de contrôle a renvoyé au compte d'essai membre@ la **même** valeur de type d'adhésion (aucun changement de contenu ; la date de mise à jour du profil d'essai a pu changer). Les connexions de test mettent à jour la date de dernière connexion des comptes d'essai |

## 3. Inventaire des pages

| Catégorie | Nombre | Couvertes |
|---|---|---|
| Pages publiques (dont 3 redirections vers le site WordPress) | 10 fichiers (+ 404) | 10 / 10 |
| Pages internes statiques | 56 | 56 / 56 (visiteur, particulier, Bureau) |
| Pages internes à identifiant (activité, projet, membre, pro, événement) | 7 | 5 / 7 avec données réelles ; événement : **aucune donnée** (0 événement) ; foyer/chien partagé via lien : non couvert |
| Routes serveur/API (`src/routes/api`) | 0 | — |
| Traitements serveur | 11 fonctions dans 9 fichiers | lus et contrôlés (pas d'exécution des écritures) |
| Tâches planifiées | 2 (rappels quotidiens 07:00, synthèse Bureau lundi 06:00) | lues, **non exécutées** |

Pages conservées mais retirées des menus : `/terrain` (toujours visée par 5 liens de notifications), `/onboarding` (affichée même à un compte déjà configuré), `/member` (accueil particulier).

## 4. Matrice page × rôle

Légende : PASS = chargé sans erreur avec le contenu attendu (ou refus attendu affiché) ; BLOCKED = compte de test absent ; NOT TESTED = non exécuté.
| Route | Visiteur | Particulier (membre@) | Bureau + pro (bureau@) | Pro seul | Bénévole/référent dédié | Coordinateur non-Bureau | Compte en attente |
|---|---|---|---|---|---|---|---|
| `/activities` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/admin/advisor` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/admin/audit` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/admin/chiens` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/admin/communication` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/admin/contributions` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/admin/gouvernance` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/admin/import` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/admin` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/admin/loyalty-rules` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/admin/permissions` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/admin/pros` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/admin/roles` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/admin/settings` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/admin/suivi-financier` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/admin/validation` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/advantages` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/avancees` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/blog` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/calendar` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/charter` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/contests` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/directory` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/documents` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/espace-pro/carte` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/espace-pro/chiens` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/espace-pro/collaborations` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/espace-pro` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/events` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/finance` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/formations` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/forms` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/foyer` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/help-requests` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/help` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/inventory` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/je-veux-aider` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/loyalty` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/mairies` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/member` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/members` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/members/new` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/mindmap` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/my-space` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/notifications` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/onboarding` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/parcours` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/participations` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/partners` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/profile` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/projects` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/proposals` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/reimbursements` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/statistics` | PASS (renvoi accueil) | PASS (refus affiché + données refusées par la base) | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/tasks` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/terrain` | PASS (renvoi accueil) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/activities/d353ac93-92cd-470b-9074-fac3cc9ae79d` | NOT TESTED (même garde que la page parente) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/projects/11111111-1111-4111-8111-111111111105` | NOT TESTED (même garde que la page parente) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/members/b6fe6a1e-2045-42f8-b625-1571b8d10828` | NOT TESTED (même garde que la page parente) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/professionals/46a13858-d652-4aaa-a9b7-74d6c82f0a60` | NOT TESTED (même garde que la page parente) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/events/00000000-0000-4000-8000-000000000000` | NOT TESTED (même garde que la page parente) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `/projects/00000000-0000-4000-8000-000000000000` | NOT TESTED (même garde que la page parente) | PASS | PASS | BLOCKED | BLOCKED | BLOCKED | BLOCKED |

| Route publique | Visiteur | Résultat |
|---|---|---|
| `/` | PASS | La Voix du Chien |
| `/agenda` | PASS | Agenda des activités |
| `/articles` | PASS | redirection → https://lavoixduchien.fr/ |
| `/association` | PASS | redirection → https://lavoixduchien.fr/ |
| `/services` | PASS | redirection → https://lavoixduchien.fr/ |
| `/professionnels` | PASS | Nos partenaires |
| `/professionnels/sacha-pro-essai` | PASS | Carte introuvable |
| `/professionnels/inexistant` | PASS | Carte introuvable |
| `/formulaire/479f49ce-9e91-4ef4-9856-3199f832cafa` | PASS | Friandises pref ? |
| `/formulaire/902249d8-8e7b-4697-a1a6-7c4577bd7afc` | PASS | Formulaire indisponible |
| `/partage/invalidtoken12345` | PASS | Lien introuvable |
| `/page-inexistante` | PASS | Cette page est introuvable |

Bénévole/référent : le compte membre@ porte les fonctions Référent et Coordinateur **au niveau association** et un rôle bénévole sur un projet ; ses résultats valent pour ce profil partiel, mais aucun compte n'est coordinateur **d'un projet** (OWNER/COORDINATOR) hors Bureau, donc les droits de validation de tâches, de réservation de matériel et de communication projet par un coordinateur restent **BLOCKED**.

Contrôles complémentaires : session expirée, retrait/expiration d'une permission ou d'une délégation, compte clôturé : **NOT TESTED** (exigent des écritures ou un compte dédié).

## 5. Liens

| Contrôle | Résultat |
|---|---|
| Liens internes relevés dans le code (79 cibles) comparés aux 70 pages | 0 cassé (les 6 écarts détectés sont des segments relatifs ou des fichiers statiques) |
| Liens internes rendus dans les pages (78 cibles uniques, 3 rôles) | 0 cassé ; toutes les cibles existent |
| Liens contenus dans les notifications générées par la base (28 chemins) | 0 cassé ; 5 mènent à `/terrain`, page retirée des menus (P3-02) |
| Liens externes (16 uniques) | 15 répondent 200 ; Google Maps répond 403 aux robots (normal, fonctionne dans un navigateur) |
| `target="_blank"` sans `noopener` | 0 dans la plateforme ; 6 sur le site WordPress externe (hors périmètre) |
| Liens mail | `mailto:associationlavoixduchien@gmail.com` bien formé ; e-mails des membres affichés uniquement au Bureau |
| Page inexistante | page « Cette page est introuvable », statut HTTP 404 |
| Lien de partage invalide / fiche pro inconnue / formulaire PRO en visiteur | messages clairs (« Lien introuvable », « Carte introuvable », « Formulaire indisponible ») |
| Pages protégées en visiteur | renvoi vers l'accueil (connexion) sans retour à la page demandée après connexion (P3-04) |

## 6. Tests fonctionnels par page (lecture seule)

Mesuré sur 207 chargements (visiteur 68, particulier 63, Bureau 63, téléphone 13) :
- 0 erreur JavaScript, 0 échec de navigation, 0 erreur console hors la 404 volontaire.
- Requêtes interrompues (`ERR_ABORTED`) sur /member, /espace-pro, /admin/gouvernance : requêtes annulées lors du changement de page, sans effet visible.
- Formulaire de connexion : champs vides bloqués par le navigateur ; mauvais mot de passe → « E-mail ou mot de passe incorrect. » annoncé (zone d'alerte). PASS.
- Fiche pro interne `/professionals/<id>` ouverte depuis l'annuaire pour pro@ : « fiche introuvable » **même pour le Bureau**, car ce compte n'a pas de détails professionnels enregistrés (P3-03).
- Onglets (Sorties & agenda, Annuaire, Console Bureau) : rendus et état actif corrects ; navigation clavier testée seulement sur l'accueil public.
- **Non testés (écriture interdite sur base réelle)** : envoi de formulaires, double clic, sauvegarde/annulation, création « + Créer », dialogues de confirmation, inscription, scan Pass, réservation, import.
- Pagination, tris et filtres : affichés ; non exercés sur volume (base quasi vide : 5 projets, 8 tâches, 3 activités, 0 événement, 0 document).

## 7. Sécurité, confidentialité, stockage et fonctions

### Méthode
Appels directs à l'API de données avec la clé publique, sans passer par l'interface, en visiteur, particulier et Bureau (lecture seule) ; lecture des règles d'accès, des droits par colonne, des fonctions à droits élevés et des règles de stockage ; analyseur de sécurité relancé (2026-11-12 18:53) ; aucun test intrusif sur l'hébergement.

### Résultats
| Contrôle | Résultat |
|---|---|
| 59 tables en visiteur | 0 ligne lisible hors formulaires PUBLIC publiés (3) — conforme |
| Tables sans règles d'accès | aucune (la vue `public_professionals` n'est accessible à personne) |
| Données sensibles en particulier | 0 ligne : journal d'audit, rôles, permissions, finances, remboursements, gouvernance, adhésions, foyers d'autrui, chiens, dossiers pros, imports, suggestions IA |
| Tentatives d'accès croisé (IDOR) du particulier sur le compte Bureau | 0 ligne sur notifications, préférences, carte fidélité, participations, détails pro, adhésions |
| Colonnes privées du profil (téléphone, e-mail, bio, ville, compétences…) | refusées en lecture directe (403) ; servies uniquement par la projection annuaire selon les choix de visibilité (migration 0072 conforme) |
| Fonctions Bureau (console, chiens, statistiques) en particulier | refusées |
| Fonctions internes (rappels, notifications, fidélité) | refusées au particulier et au visiteur |
| Fonctions appelables sans connexion | exactement les 6 prévues (accueil public, agenda, pros publics, fiche pro, articles, réponse formulaire) |
| Fonctions à droits élevés sans `search_path` fixé | 0 |
| Avertissements du linter base | 105 (fonctions à droits élevés appelables) — conformes à la conception documentée, chaque fonction vérifiant les droits elle-même |
| Stockage | 2 espaces privés (`avatars` par dossier propriétaire, `blog-media`) ; liste anonyme vide ; liens signés de 6 h pour les articles publiés |
| Traitements serveur | tous protégés par session sauf lecture publique ; droits élevés utilisés seulement après vérification Bureau ou vérification en base |
| Liens de partage publics | jamais pour un document Bureau/Sensible (contrôlé à la création) ; 0 partage existant |
| Secrets dans le code | aucun secret privé ; seule la clé publique est présente (prévu) |

### Écarts
- **P1-01** Comptes non validés : voir §12.
- **P2-02** Le Bureau lit toutes les notifications personnelles de tous les membres (règle de lecture des notifications).
- **P2-03** Réponses anonymes aux formulaires publics sans limite de fréquence ni anti-robot ; champs obligatoires non vérifiés côté serveur.
- Analyseur de sécurité : 2 « erreurs » (actualités internes et fichiers du journal lisibles par toute personne inscrite — rattachées à P1-01) et 2 avertissements (catégories pro/projet en lecture libre : données de référence, acceptables).

## 8. Flux, synchronisations et automatisations

| Flux | Déclencheur → traitement → destination | Statut réel | Garde-fous | Test |
|---|---|---|---|---|
| Commentaire, tâche, proposition, guide, demande d'aide | déclencheurs en base → notification interne | Automatisé | anti-doublon `notify_once`, préférences, droits de lecture | Lecture du code ; **BLOCKED** (écriture) |
| Rappels J-1/J-2 (activités, événements, tâches, concours) | tâche planifiée 07:00 → notifications | Automatisé | anti-doublon ; respecte « rappels » | Lecture ; **non exécuté**. Les concours notifient **tous** les profils, y compris refusés/clôturés (P3-01) |
| Synthèse hebdomadaire Bureau | tâche planifiée lundi 06:00 | Automatisé | — | Lecture ; non exécuté |
| Adhésion | WordPress/HelloAsso → import CSV manuel par le Bureau → rapprochement | Partiellement automatisé | idempotent par identifiant externe, cas ambigus « à valider », journal | **BLOCKED** ; 0 import en base |
| Décision d'adhésion | Bureau → `decide_membership` → notification + journal | Manuel validé | verrou, journal | **BLOCKED** |
| Pass Terrain / tampon manuel | scan → `award_manual_stamp` → tampon + présence + alerte Bureau | Semi-automatique | clé unique par jour, rôle vérifié en base | **BLOCKED** (aucun tampon de test) |
| Hors ligne | pass et demandes en stockage local → médiation au retour | Partiel | jamais affiché comme confirmé | **NOT TESTED** : service hors ligne désactivé hors site publié |
| Inventaire / réservations | réservation projet → contrôle de stock en base | Automatisé | verrou anti-surréservation | **BLOCKED** |
| Agenda | export .ics et lien « Ajouter à Google Agenda » côté navigateur | Manuel (pas de synchronisation) | — | tests unitaires ; pas de compte Google connecté |
| Formulaires Google | liens externes | Manuel | — | lien 200 |
| Assistant d'aide / IA | serveur → passerelle IA avec la session de l'utilisateur | À la demande | aucune donnée sensible envoyée, guides seuls | **NOT TESTED** (appel réel facturé) |
| Préférences → affichage | préférences → classes d'affichage | Automatisé | — | 11 variantes appliquées et mesurées |
| E-mails, push, webhooks, fonctions edge, n8n | — | **Absents** | — | — |

## 9. Accessibilité, contraste, UX et responsive

| Contrôle | Résultat |
|---|---|
| axe WCAG 2.0/2.1/2.2 A-AA sur 194 pages (1280 px) | pages publiques : 0 violation ; internes : voir écarts |
| Contraste sur rendu réel : 11 variantes (défaut, sombre, Bleu nuit, Bleu nuit sombre, contraste renforcé clair/sombre, Atkinson, Lexend, texte très grand + espacements forts, focus, épuré) × 10 écrans (particulier et Bureau) | **0 violation** de contraste |
| Polices effectives | IBM Plex Sans par défaut, Atkinson Hyperlegible et Lexend appliquées |
| Débordement horizontal | 0 px à 320, 390, 820 px et à zoom 200 % (accueil, agenda, annuaire) ; 0 débordement avec texte très grand |
| Clavier (accueil public) | lien « Aller au contenu » présent, ordre logique, focus visible sur les 25 premiers éléments |
| Rose / mauve / magenta | aucun relevé par les captures et les contrôles de couleur des lots précédents ; non mesuré pixel par pixel ici |
| Lecteurs d'écran réels (NVDA, VoiceOver), appareils réels | **NOT TESTED** |

Écarts : P2-01 (boutons-icônes sans nom), P3-05 à P3-08 (détails ci-dessous). Captures : `/mnt/documents/recette-lot6/`.

## 10. Performance et robustesse

Mesures sur serveur de **développement** (non représentatives de la production) :
- Accueil public : premier octet 18 ms, contenu principal affiché 448 ms, décalage de mise en page 0,006.
- Agenda / annuaire : contenu principal en 160–170 ms, décalage 0.
- Pages internes : 2,3 s médiane (inclut connexion, chargement et 700 ms d'attente fixe), 7,2 s au maximum (première compilation).
- **Appels à la base par page interne : 25 en médiane, 51 au maximum** (fiche projet) — profil, rôles et préférences relus à chaque page (P3-09).
- Poids JS/CSS de production, LCP/INP réels : **NOT TESTED** (build de production non lancé manuellement ; voir §11).
- Bibliothèques probablement inutilisées (à confirmer, non supprimées) : `@hookform/resolvers`, `date-fns`, `@types/qrcode`.

## 11. Validation technique

| Contrôle | Résultat |
|---|---|
| Vitest (suite complète) | **PASS** — 48 fichiers, 346 tests, 2,96 s |
| Lint (`eslint .`) | **FAIL** — 8 996 remarques : 8 970 mises en forme Prettier, 3 erreurs « any » (`ai-assist.functions.ts`, `members.$memberId.tsx`, `members.index.tsx`), 6 dépendances de hooks manquantes, 17 avertissements de rechargement à chaud |
| Typecheck / build production | **non lancés manuellement** (règle de l'environnement : la vérification est faite automatiquement par la plateforme après modification). Le serveur de développement a compilé et affiché les 63 pages internes et 10 publiques sans erreur |
| Tests navigateur | 207 chargements, 3 rôles, 320/390/820/1280 px |
| Tests d'accès automatisés | script API en lecture seule (59 tables, 19 fonctions, 6 tentatives croisées, stockage) |
| Régressions lots UX 1–5 et vitrine | aucune constatée : polices, signatures, contraste renforcé, DogEmptyArt, menu public réduit, agenda et annuaire vides chaleureux |

## 12. Anomalies

### P0 — bloquant
Aucune anomalie P0 de code. **Blocage de recette** : absence d'environnement isolé (voir §13).

### P1 — critique
**P1-01 Comptes non validés trop exposés** — rôle : toute personne inscrite (en attente / refusée).
- Reproduction (lecture des règles) : les règles de lecture des projets (`can_view_project` : visibilité ASSOCIATION), tâches, commentaires, membres de projet, jalons, équipes, actualités internes (`au_select_members` = vrai), annuaire (`directory_profiles`), liste du Bureau, fonctions de membres, documents non Bureau/non Sensible, événements non Bureau et fichiers `blog-media` ne vérifient pas l'adhésion active. À l'inverse, activités, partenaires, avantages et mindmap l'exigent déjà.
- Impact : une personne refusée par le Bureau, ou un inconnu qui s'inscrit, lit les noms de membres, les projets internes et leurs échanges.
- Preuve : règles en base ; analyseur de sécurité (2 erreurs) ; aucun test direct (compte en attente indisponible).
- Recommandation : ajouter `is_active_member` (ou Bureau / propriétaire / membre du projet) à ces lectures. **Validation humaine requise** : le Bureau doit dire ce qu'un compte en attente a le droit de voir.

### P2 — majeur
- **P2-01 Boutons-icônes sans nom accessible** — Notifications (13 particulier, 18 Bureau), Centre d'aide (1 / 14), Mindmap (6 : listes déroulantes), Adhérents (2), Nouvel adhérent (3), fiche membre (3), Historique (3 + 2 champs date sans libellé), Conseiller d'équipe, Fidélité, Comptabilité, Tâches, Profil, Préférences. Un lecteur d'écran annonce « bouton » sans action. Recommandation : `aria-label` explicites.
- **P2-02 Le Bureau lit toutes les notifications personnelles** — minimisation RGPD ; décider si c'est voulu (support) ou limiter au destinataire.
- **P2-03 Formulaires publics** — réponses anonymes sans limite de fréquence ni anti-robot ; obligatoires non contrôlés côté serveur.
- **P2-04 Lint en échec** — critère de GO non rempli ; 3 vraies erreurs de typage « any ».

### P3 — mineur
- **P3-01** Rappel « concours » envoyé à tous les profils, y compris refusés ou clôturés.
- **P3-02** 5 types de notifications renvoient vers `/terrain`, page retirée des menus.
- **P3-03** Annuaire → fiche pro interne « introuvable » quand le pro n'a pas de détails professionnels (cas de pro@, visible aussi par le Bureau).
- **P3-04** Après redirection vers la connexion, retour à l'accueil au lieu de la page demandée.
- **P3-05** Accueil public : trois liens différents vers la même zone de connexion (« Espace membres », « Mon Pass Terrain », « Accès membre ») — répétition contraire à la consigne.
- **P3-06** Barre latérale : le type est affiché en code brut « PARTICULIER ».
- **P3-07** Onboarding : 2 barres de progression sans nom ; Communication : attribut `aria-controls` invalide sur un onglet ; cibles tactiles trop petites sur Projets (5) et Fidélité (2).
- **P3-08** Téléphone : menu en haut **et** barre en bas ; le bouton d'aide flottant recouvre une partie du contenu.
- **P3-09** 25 à 51 appels à la base par page interne.
- **P3-10** Documentation technique : `src/lib/AGENTS.md` parle d'audience « INTERNE » pour les formulaires alors que la base et la mémoire projet utilisent PUBLIC / PRO.
- **P3-11** Historique des migrations : 1 ligne de base sans fichier correspondant (pas de réparation sans approbation).
- **P3-12** `robots.txt` autorise tout ; les pages internes ne montrent rien sans connexion, mais un `Disallow` limiterait l'indexation des écrans de redirection.
- **P3-13** Bibliothèques probablement inutilisées (§10).

## 13. Non testé et raisons

| Élément | Statut | Raison / besoin |
|---|---|---|
| Tous les flux d'écriture (§8), formulaires, double clic, annulation | BLOCKED | base réelle partagée : **environnement de test isolé requis** |
| Professionnel seul | BLOCKED | mot de passe de pro@ inconnu ; ouverture de session à sa place impossible sans votre approbation dans ce contexte |
| Coordinateur de projet hors Bureau, bénévole/référent dédié, compte en attente, compte refusé de test | BLOCKED | comptes d'essai à créer (dans un environnement de test) |
| Bureau sans profil pro | BLOCKED | le seul autre compte Bureau est une personne réelle |
| Session expirée, retrait de permission, délégation expirée | NOT TESTED | écriture ou attente nécessaires |
| Hors ligne / application installable | NOT TESTED | service hors ligne volontairement désactivé hors site publié |
| Poids et vitesse en production | NOT TESTED | pas de build de production manuel |
| Assistant IA | NOT TESTED | appel réel facturé |
| NVDA / VoiceOver / appareils réels | NOT TESTED | contrôle humain |
| Événements, documents, chiens partagés à un pro | NOT TESTED | 0 donnée |
| Tests d'intrusion externes | hors périmètre | prestataire dédié si souhaité |

## 14. Corrections proposées

Voir `plan-corrections-lot6.md` (plan distinct, rien n'est appliqué).

## 15. Checklist de publication

- [ ] Environnement de test isolé disponible et flux d'écriture rejoués (création, notification, tampon, réservation, adhésion, remboursement)
- [ ] Décision du Bureau sur ce qu'un compte en attente peut voir, puis correction P1-01 et test avec un compte en attente
- [ ] Comptes d'essai : pro seul, coordinateur de projet, bénévole/référent, en attente, Bureau sans pro
- [ ] P2-01 à P2-04 corrigés ou acceptés par écrit
- [ ] Lint vert, typecheck et build de production verts (vérification de la plateforme)
- [ ] Hors ligne vérifié sur le site publié, avec un téléphone réel
- [ ] Contrôle manuel NVDA ou VoiceOver sur connexion, accueil membre, notifications et Pass
- [ ] Analyseur de sécurité relancé sans erreur
- [ ] Mentions légales, CGU, confidentialité validées par le Bureau (hors périmètre de ce lot)
