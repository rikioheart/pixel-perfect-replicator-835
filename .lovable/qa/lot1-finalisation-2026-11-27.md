# Lot 1 — Finalisation et recette

## Livré
- Accord explicite de l’adhérent pour ses coordonnées : faux par défaut, modification par le titulaire uniquement, retrait immédiatement effectif, audit.
- Représentants : accès limité à leur catégorie et à un mandat associatif actif non expiré ; aucune coordonnée publique.
- Qualité professionnelle indépendante de l’adhésion : demande PENDING depuis le profil, validation/suspension/refus par le Bureau dans /admin/pros. Aucune auto-validation.
- Cumul particulier + professionnel sans second compte ni second foyer. Validation de qualité distincte de la publication de la carte publique.
- Droits effectifs : exceptions individuelles réellement appliquées ; REVOKE prime sur les rôles ; aucun contournement UI Bureau ; auto-modification des exceptions refusée et auditée.
- Contacts rapides : actualisation des listes de personnes et d’organisations, recherche anti-doublon littérale, arrêt sur erreur de lecture.

## Contrôles
- 377 tests Vitest réussis.
- `scripts/rls/lot1-identity-consent.py` : 18/18 contrôles initiaux et 11/11 après validation, via API réelle avec trois comptes agent-test temporaires.
- Parcours UI réel : profil fictif identifié, accord enregistré et relu après rechargement, demande professionnelle, validation Bureau, qualité relue dans le profil, accès /espace-pro et /foyer pour le même compte.
- Mobile 390 px : aucun débordement horizontal ; captures de la demande, décision et accord relues.
- Dernier signal de compilation : build OK ; aucun pageerror pendant l’essai.
- Linter : 112 avertissements d’exécution SECURITY DEFINER (6 publics intentionnels + 106 authentifiés), pas une preuve d’accès illimité ; fonctions du lot contrôlées par les essais API. Pas de certification globale de sécurité.

## Données et limites
- Tests exclusivement sur trois identités fictives ; aucune modification de membre réel pendant la recette.
- Nettoyage des alertes, demande pro, fonctions, exceptions, rôles, profils et fiches people ; trace `recette.lot1.cleanup`. Identités Auth temporaires supprimées automatiquement à la fin de session.
- L’extension de schéma conserve la validation du professionnel actif préexistant par backfill, sans modifier son adhésion ni ses coordonnées.
- La vitrine, la connexion et les codes d’accès restent inchangés. Aucune publication.
- Lot 1 finalisé ; GO global non prononcé : les autres lots et la recette prépublication restent distincts.