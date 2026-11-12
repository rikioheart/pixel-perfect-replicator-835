# Lot 6 — Plan de corrections proposé (non appliqué)

Rien n'a été modifié pendant la recette. Chaque sous-lot attend votre accord.

## Sous-lot 0 — Environnement de test (préalable au GO)
- Créer un environnement de test isolé (base séparée de la base réelle). Option à valider avant toute création : aucune copie des données des adhérents, comptes d'essai uniquement.
- Comptes d'essai à créer dans cet environnement : professionnel seul, coordinateur d'un projet, bénévole/référent, compte en attente, compte refusé, Bureau sans profil pro.
- Rejouer les flux d'écriture du rapport §8.

## Sous-lot A — Corrections simples sans risque (interface seulement)
| Réf. | Correction | Risque |
|---|---|---|
| P2-01 | Noms accessibles sur les boutons-icônes (Notifications, Aide, Mindmap, Adhérents, fiche membre, Historique, Tâches, Profil, Préférences…) et libellés des deux champs date de l'Historique | nul |
| P3-07 | Nom des barres de progression d'onboarding ; cibles tactiles ≥ 24 px sur Projets et Fidélité | nul |
| P3-06 | Libellé humain du type d'adhésion dans la barre latérale | nul |
| P2-04 | 3 types « any » remplacés ; dépendances de hooks complétées | faible |
| P2-04 | Mise en forme automatique Prettier (8 970 remarques) — gros diff purement mécanique, à faire seul dans un lot dédié | faible |
| P3-10 | Corriger la documentation technique (audience PUBLIC / PRO) | nul |

## Sous-lot B — Base de données (validation humaine requise)
| Réf. | Correction | Décision attendue |
|---|---|---|
| P1-01 | Exiger l'adhésion active (ou Bureau / propriétaire / membre du projet) pour lire projets, tâches, commentaires, membres de projet, jalons, actualités internes, annuaire, liste du Bureau, fonctions, documents, événements et fichiers du journal | Ce qu'un compte en attente doit voir (proposition : uniquement son profil, sa demande d'adhésion, l'accueil et les guides publics) |
| P2-02 | Limiter la lecture des notifications au destinataire (le Bureau garde les compteurs et le journal) | Le Bureau a-t-il besoin de lire les notifications des membres ? |
| P2-03 | Limite de fréquence par formulaire et par e-mail, contrôle des champs obligatoires côté serveur | Seuil acceptable (ex. 5 réponses / heure / e-mail) |
| P3-01 | Rappel concours réservé aux comptes actifs non clôturés | — |
| P3-02 | Rediriger les liens de notifications terrain vers l'écran en service | Quelle page remplace `/terrain` |

## Sous-lot C — Parcours et vitrine (accord requis, zones protégées)
| Réf. | Correction | Remarque |
|---|---|---|
| P3-04 | Retour à la page demandée après connexion | touche la connexion : seulement avec votre accord |
| P3-05 | Garder un seul lien vers l'espace membre sur l'accueil public | vitrine : seulement avec votre accord |
| P3-08 | Téléphone : une seule navigation, bouton d'aide qui ne recouvre plus le contenu | — |
| P3-03 | Message clair (« fiche professionnelle non complétée ») au lieu de « introuvable » | — |

## Sous-lot D — Performance et hygiène
- P3-09 : mutualiser la lecture du profil, des rôles et des préférences entre les pages.
- P3-13 : confirmer puis retirer les bibliothèques inutilisées.
- P3-11 : inspecter puis réparer l'historique des migrations avec votre approbation.
- P3-12 : `Disallow` des chemins internes dans `robots.txt`.
