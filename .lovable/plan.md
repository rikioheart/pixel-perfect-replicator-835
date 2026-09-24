# Professionnels, carte QR, activités et foyers

Point de départ : le « modèle chien/foyer/participation » mentionné n'existe pas encore (pas de foyers, pas d'enfants, chiens rattachés à une seule personne, participation sans détail des chiens). Ce plan le crée d'abord, puis construit les prompts 3 et 4 dessus, sans rien supprimer de l'existant.

## Étape 1 — Socle foyer et chiens
- Foyers : un foyer regroupe des adultes (comptes) et des enfants (simples fiches prénom et année, sans compte).
- Chaque chien appartient à un foyer. Les chiens actuels sont rattachés automatiquement au foyer de leur propriétaire.
- Accès partagé chien → professionnel : droits par rubrique (identité, informations, objectifs, activités, observations), avec date de fin et révocation possibles.
- Professionnels référents : le propriétaire choisit un ou plusieurs référents depuis la fiche du chien.
- Nouvelles données du chien : objectifs et observations (rédigées par les pros qui ont l'accès).

## Étape 2 — Professionnels (prompt 3)
- Séparation stricte : fiche publique (nom, logo, spécialités, secteur, présentation, site, réseaux, coordonnées choisies, adresse web courte) et détails internes (contrat, pourcentage, notes, infos administratives), réservés au Bureau et au professionnel lui-même.
- Statut de la fiche : Brouillon → En attente de validation → Active → Suspendue. Seules les fiches Actives sont publiques ; le Bureau valide depuis la file de validation.
- Page publique `/professionnels/[adresse-courte]` : identité, « Activités proposées », « Avantages adhérents » (actifs et publics), « Collaborations avec La Voix du Chien » (publiques), puis « X chiens accompagnés dans le réseau » sans aucun nom. L'ancienne adresse `/pro/…` redirige vers la nouvelle.
- QR code : il pointe uniquement vers l'adresse courte. Dans « Ma carte professionnelle » : aperçu de la carte, QR code, bouton Imprimer (mise en page carte), bouton Télécharger (image), adresse publique à copier.
- Espace professionnel (menu dédié) : Tableau de bord, Ma carte professionnelle, Activités, Événements, Chiens accompagnés, Collaborations, Avantages, Fidélité, Demandes.
- Chiens accompagnés : uniquement les chiens avec un accès actif, rubriques affichées selon les droits accordés.
- Parcours d'inscription pro séparé, en plusieurs petites étapes, complétable plus tard (barre de progression du profil).

## Étape 3 — Activités et événements (prompt 4)
- Nouvelles infos sur l'activité : heure, capacité, professionnel, référent associatif, règle chiens (sans chien / facultatif / plusieurs / nombre maximum), et textes « Faite pour vous si… », « À prévoir », « Avant de venir », « Avec votre chien ». Même chose pour les événements.
- Fiche activité complète avec places restantes, « Complet » ou « Liste d'attente ».
- Parcours « Je participe » : foyer → qui participe (adultes et enfants) → quel(s) chien(s) → infos complémentaires → confirmation.
- Événements familiaux : déclaration simple du groupe (adultes, enfants, chiens), sans compte pour les enfants.
- Confidentialité : chacun ne voit que sa propre inscription ; les listes publiques n'affichent que des nombres.

## Détails techniques
- Tables : households, household_members (user_id, rôle), household_children, dogs.household_id (rempli pour l'existant), dog_professional_access (permissions jsonb booléennes par rubrique, expires_at, revoked), dog_referents (unique dog/pro), dog_goals, dog_observations.
- professional_public_profile (slug unique, status DRAFT/PENDING_REVIEW/ACTIVE/SUSPENDED, lecture anon si ACTIVE) et professional_internal_details (RLS : bureau ou soi-même, jamais anon), remplies depuis pro_details ; la vue public_professionals est recréée sur la table publique. professional_collaborations (is_public). advantages.is_public + professional_id ; activities/events : champs listés + is_public.
- participations : ajout household_id, validated_at, validated_by, registered_at ; CHECK (activity_id IS NULL) <> (event_id IS NULL) ; statut WAITLIST ; index unique partiel (user_id, activity_id) et (user_id, event_id). participation_dogs (unique participation/dog) et participation_members (user_id OU household_child_id, CHECK exclusif).
- Inscription via une fonction base de données unique qui verrouille la ligne de l'activité (SELECT … FOR UPDATE), compte les places, contrôle la règle chiens, et met en liste d'attente si complet : aucun dépassement lors de deux inscriptions simultanées.
- Comptage public des chiens accompagnés via fonction SECURITY DEFINER renvoyant seulement un nombre.
- QR code généré dans le navigateur (librairie qrcode), export PNG, impression via feuille de style dédiée.
- Contrôles des données existantes avant d'ajouter les contraintes (doublons, participations sans cible) ; test Playwright des trois profils à la fin.
