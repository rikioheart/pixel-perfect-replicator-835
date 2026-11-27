# Sécurité — sélection du 27 novembre 2026

## Périmètre

- Sélection initiale : 21 alertes. Les protections correspondantes ont été appliquées avant le second message.
- Nouvelle sélection à 11:11 UTC : 16 alertes applicatives. Seules ces 16 alertes ont ensuite été marquées corrigées ; aucune autre alerte n’a été corrigée ou ignorée après ce recentrage.
- Aucun déploiement ni publication.

## Résultats

- Import d’adhérents : rôle Bureau et permission effective `members.validate` vérifiés avant l’utilisation du client privilégié ; un retrait individuel de permission est respecté.
- Reversements : création de son propre reversement, changement du bénéficiaire vers soi-même et modification de ses montants refusés par le déclencheur.
- Liens publics : cible, créateur et jeton immuables ; droits actuels du créateur revérifiés avant lecture privilégiée ; documents Bureau et SENSIBLE exclus.
- Chiens : un tiers du foyer ne peut pas changer le responsable ou déplacer le chien ; contrôles de gestion et d’accès opérationnel limités à la personne connectée.
- Pass : contrôle d’éligibilité réservé au titulaire et aux valideurs autorisés.
- Articles : publication réservée au Bureau ; chemins de fichiers vérifiés contre leur propriétaire ; anciens chemins non autorisés exclus de la projection publique.
- Avantages : adhésion active, période, statut et quantité vérifiés ; verrou sur l’offre pendant le contrôle de capacité.
- Impression : toutes les valeurs dynamiques échappées avant insertion dans la fenêtre imprimable.
- Assistant d’aide : historique client traité comme données citées dans un message utilisateur, jamais comme tours assistant authentifiés.
- Les deux anciennes alertes de mots de passe correspondent à des comptes démo déjà supprimés : absence confirmée dans l’authentification réelle. Les migrations historiques figées n’ont pas été modifiées ni rejouées.

## Vérifications

- 46/46 tests ciblés réussis : entrées d’impression/import, assistant d’aide, articles publics, pass et tâches.
- 76/76 vérifications réelles du script bêta existant réussies.
- 10/10 contrôles API ciblés réussis : contrôles de chiens, pass, rubrique de retour d’expérience et stockage.
- `scripts/rls/selected-security.sql` exécuté intégralement dans une transaction annulée : retargetage projet/événement/document, créateur, révocation, appropriation chien, capacity/date/statut des avantages, publication, fichier étranger, reversement propre, retour d’expérience et adhésion en attente.
- Vérification après annulation : zéro projet, chien, avantage ou article portant le préfixe des fixtures de sécurité.
- Impression réellement ouverte depuis une session du professionnel d’essai : le nom contenant une fermeture de titre et un script est affiché littéralement ; aucun script injecté exécuté ; aucune erreur navigateur.
- Dernier contrôle de compilation : succès.
- Contrôle de sécurité de base : aucune alerte retournée après les corrections initiales. Ce contrôle n’est pas une nouvelle analyse approfondie du code et ne constitue pas un test d’intrusion.

## Limites

Les essais de déclencheurs utilisent des fixtures et des identités de test dans une transaction annulée ; les droits de lecture ont aussi été vérifiés via l’API réelle. Aucun membre réel n’a été utilisé pour une mutation. Un nouvel audit approfondi reste recommandé ; ces vérifications ne garantissent pas l’absence de vulnérabilités non détectées.