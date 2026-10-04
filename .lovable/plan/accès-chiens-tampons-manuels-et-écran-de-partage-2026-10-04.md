# Accès chiens, tampons manuels et écran de partage

Décisions prises en compte (enregistrées). Une seule évolution de la base, additive, puis les écrans, puis tests réels avec les comptes d'essai.

## 1. Compte démo membre
- Retirer le rôle Bureau de membre@lavoixduchien.fr ; il devient un simple membre particulier actif.

## 2. Tampons attribués à la main par un professionnel
- Nouveau bouton dans l'espace pro « Attribuer un tampon » : choisir le membre (particulier uniquement), l'activité ou l'événement concerné (facultatif), un motif, et **obligatoirement** un membre du Bureau à informer.
- Le membre du Bureau choisi reçoit une notification (qui, à qui, pourquoi). Le membre voit « +1 tampon — Validé par [professionnel] ».
- Réservé aux professionnels validés ; impossible de se l'attribuer à soi-même ; journalisé ; protection contre le double clic (même pro, même membre, même activité = un seul tampon).

## 3. Ce que voit le Bureau
- Tous les chiens : informations principales (nom, race, sexe, foyer).
- Dossier complet (infos, objectifs, observations, suivis) : visible par défaut.
- Le propriétaire peut marquer certaines rubriques comme privées : elles restent alors cachées au Bureau.
- Chaque membre du Bureau peut, depuis son profil, retirer lui-même sa visibilité sur les dossiers détaillés (et la rétablir).

## 4. Ce que voit un professionnel
Fiche du chien visible s'il est :
- référent du chien ;
- inscrit/intervenant sur une activité ou un événement où le chien participe ;
- sur une réservation terrain où le chien est présent, y compris les chiens amenés par les autres professionnels de la même réservation.
Dans ces cas : fiche opérationnelle (identité, caractère, besoins, à savoir), sans données de santé. Le dossier détaillé reste soumis au partage.

## 5. Écran de partage et de retrait
- Page du chien (côté propriétaire) et « Chiens accompagnés » (côté référent) : liste des accès en cours (qui, rubriques, contexte, expiration, donné par qui).
- Bouton « Partager » : choisir le professionnel, les rubriques (identité, infos, objectifs, activités, observations/commentaires/suivis), le contexte, l'expiration.
- Le référent peut partager observations, commentaires et suivis **seulement si le propriétaire l'a autorisé** (case « J'autorise mon référent à partager le suivi » sur la fiche du chien).
- Bouton « Retirer » : par le propriétaire, la personne qui a donné l'accès ou le Bureau ; les accès qui en découlent sont retirés aussi.

## 6. Tests réels (comptes d'essai)
Pro tampon + notification Bureau ; particulier ne peut pas s'attribuer de tampon ; pro hors activité ne voit pas le chien ; pro co-présent sur réservation voit la fiche opérationnelle, pas le dossier ; Bureau voit tout puis retire sa visibilité ; rubrique privée cachée au Bureau ; référent partage le suivi avec / sans accord du propriétaire ; retrait en cascade ; membre@ n'a plus accès aux pages Bureau.

## Détails techniques
- Colonnes : `dogs.private_sections text[]`, `dogs.referent_can_share_followup bool`, `profiles.hide_sensitive_dogs bool` (lu par `can_manage_dog`/`pro_dog_perm`), `loyalty_stamps.awarded_by`, `notified_bureau_id`, `reason`, index unique anti-doublon.
- Fonctions SECURITY DEFINER : `award_manual_stamp(member, bureau_member, activity, event, reason)`, `can_view_dog_operational(user, dog)` ; extension de `share_dog_access` (vérifie `referent_can_share_followup` pour la rubrique observations).
- `get_pro_dogs` étendu aux chiens vus via activité/événement/réservation.
