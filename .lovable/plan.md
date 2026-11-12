# LVDC — Lot 0 : cadrage UX/UI (aucune modification)

Légende : [EXISTE] vérifié dans le dépôt · [ABSENT] cherché, non trouvé · [À VÉRIFIER] non confirmé dans ce tour.

## 1. Cartographie à réutiliser
- Thème : `src/styles.css` (331 lignes, tokens oklch, blocs clair/sombre, `.public-site` séparé). [EXISTE]
- Coquille : `AppShell.tsx` (468 l., dock mobile, raccourci Trésorier), `FloatingHelpButton`, `QuickCreateMenu`, `NotificationBell`, `OfflineStatus`. [EXISTE]
- Accueils : `lib/role-home.ts` (`homePathFor` → `/admin`, `/espace-pro`, `/member`), `member.tsx`, `espace-pro.index.tsx`, `admin.index.tsx`, `MyDogHome`, `HomeHero`, `ExperienceBits`, `EngagementCards`, `PendingActionsStrip`, `lib/home-config.ts`. [EXISTE]
- Préférences : `lib/user-preferences.ts` + table `user_preferences` + page `my-space.tsx`. [EXISTE]
- Profil : `profile.tsx` (lit `profiles`), `lib/profile-columns.ts`, vue `public_professionals` (migration 0001), compétences éditées dans `je-veux-aider.tsx` (`profiles.skills`). [EXISTE]
- États : `EmptyState` (27 fichiers, image JPG `illustration-empty.jpg`), `LoadingState` (20 fichiers), Toaster sonner dans `__root.tsx`. [EXISTE]
- Pass : `loyalty.tsx`, `ManualStampCard`, `PassScanner`. Aucune célébration de tampon. [ABSENT]

## 2. Couleurs
- Marque actuelle : `--primary` bordeaux (oklch 0.395 0.128 h12), `--navy`/`--secondary` bleu nuit, `--sage`/`--sage-soft`. [EXISTE]
- Tokens Crème, Sable, Or : [ABSENT] (aucune variable dédiée).
- Teintes à risque rose : `--accent` clair (0.93 0.025 h30, rosé pâle) et `--primary` sombre (0.72 0.12 h12, rose saumon) — à recaler vers bordeaux/sable. Aucune classe Tailwind pink/rose/fuchsia/violet trouvée dans le code.
- Codé en dur : `bg-black` ×4, `bg-white` ×2 (QR/scanner, légitimes à confirmer) ; `--success-text`/`--warning-text` en hsl hors système ; `.public-site` utilise Fraunces/Outfit.
- Sémantiques (destructive/success/warning) à garder distinctes des couleurs de marque.

## 3. Composants à contrôler WCAG AA
`components/ui` : button (6 variantes × repos/survol/focus/désactivé), badge, alert, input, textarea, select, checkbox, radio-group, switch, slider, tabs, toggle(-group), dialog, alert-dialog, sheet, drawer, popover, dropdown-menu, tooltip, card, table, progress, skeleton, calendar, sonner (richColors), sidebar, command. Plus composants métier : EmptyState, LoadingState, NotificationBell, dock AppShell, TaskCard, badges de statut. Chaque combinaison × 2 signatures × clair/sombre × contraste renforcé.

## 4. Préférences — état réel
- Apparence : `theme` (SYSTEM/LIGHT/DARK). Signature Bordeaux/Bleu nuit [ABSENT].
- Lecture : `text_size` (3 niveaux), `comfortable_spacing`. Police au choix, interlignage, largeur de ligne [ABSENT].
- Confort/concentration : `high_contrast`, `reduced_motion`. Mode épuré, mode focus [ABSENT].
- Notifications/organisation : `notify_email`, `notify_in_app`, `notify_reminders`, `notification_sound`, `show_association_updates`, `default_view`. [EXISTE]
- Migration potentielle (additive, valeurs par défaut) : `signature`, `font_choice`, `line_spacing`, `simplified_mode`, `focus_mode`, `celebrations_enabled`. Contrainte CHECK comme en 0042. Aucun diagnostic collecté.

## 5. Typographie
- Chargées aujourd'hui via Google Fonts : IBM Plex Sans, Libre Baskerville, Fraunces, Outfit (4 familles, même pour l'espace membre). [EXISTE]
- Atkinson Hyperlegible et Lexend : licence SIL OFL, compatibles. Charger à la demande (lien ajouté seulement si choisi) pour ne rien coûter par défaut. Option auto-hébergement à évaluer (fonctionne hors ligne, pas de tiers Google = point RGPD). [À VÉRIFIER : poids réel]
- Piste d'allègement : ne charger Fraunces/Outfit que sur les pages publiques.

## 6. Profil
- Colonnes `profiles` exposées : nom, display_name, avatar_path, ville, département, adhésion, involvement_level, bio, public_visibility, skills… [EXISTE]
- Disponibilités, préférences de collaboration, visibilité par champ : [ABSENT].
- Prévisualisation « vu par les autres » : [ABSENT]. Doit passer par la même source filtrée que les autres (`entity_peek` / annuaire), jamais une reconstitution côté écran.
- Politiques RLS exactes de `profiles` et de `entity_peek` : [À VÉRIFIER] avant Build 4.

## 7. Accueils par rôle (sans nouvelle route)
Particulier → `/member` (MyDogHome), pro → `/espace-pro`, Bureau → `/admin` (indicateurs agrégés). Personnalisation possible dans ces pages : salutation saisonnière, nom du chien (déjà lu par MyDogHome), bloc « première visite », jauges collectives.

## 8. DogEmptyArt
Composant unique de 3 SVG inline (assis, endormi, joueur), < 3 Ko chacun, traits en `currentColor` + tokens, `aria-hidden`, figé si `reduced_motion`. Remplace l'image JPG d'`EmptyState` via une prop `art` facultative : les 27 usages en profitent sans édition.

## 9. Microcopies à harmoniser
EmptyState (27), LoadingState (20), toasts sonner (succès/erreur), pages d'erreur (`lib/error-page.ts`), OfflineStatus, confirmations AlertDialog, onboarding. Charte : vouvoiement, ton chaleureux, toujours une prochaine action.

## 10. Intégrations et dépendances
- Conserver : Lovable AI (assistant d'aide, AiAssist, conseiller d'équipe), export calendrier `.ics` (`calendar-export.ts`), liens externes sans API (`external-links.ts`), htmlparser2 (articles/partenaires WordPress), jsqr (scanner, chargé à la demande), qrcode, recharts (2 fichiers), @xyflow (carte mentale).
- Rationaliser : composants shadcn importés une seule fois (embla, resizable, input-otp, cmdk) — garder, coût nul s'ils ne sont pas chargés.
- Différer : FCM push, Google Calendar synchronisé, HelloAsso API, n8n (décisions déjà prises).
- Connecteurs configurés/actifs côté plateforme : [À VÉRIFIER] au début du Build 1 (lecture seule).
- Aucune nouvelle dépendance npm nécessaire pour les 5 lots.

## 11. Risques
- Régression visuelle : changement de tokens touche toutes les pages → captures avant/après.
- Accessibilité : contraste de l'or et de la sauge sur crème souvent < 4,5:1 → réserver aux fonds/décor, texte sur foncé.
- Confidentialité : profil enrichi et prévisualisation = nouvelles données personnelles → finalité, visibilité par défaut « membres » ou plus restreinte, RLS testée par script.
- RGPD : polices Google (transfert IP) ; badges = traitement facultatif, désactivable.
- Gamification : rester collectif, aucun classement (règle projet).
- Migrations : uniquement additives, via l'outil de migration.

## 12. Lots Build proposés
1. **Fondations visuelles** : tokens Crème/Sable/Or, signatures Bordeaux/Bleu nuit, recalage des teintes rosées, préférence `signature`. Tests : contrastes calculés par test unitaire sur les tokens. Acceptation : aucun rose, AA sur boutons/textes.
2. **Préférences & lecture** : 4 familles dans `/my-space`, polices à la demande, modes épuré/focus. Acceptation : appliqué sans rechargement, persisté, contrôle AA de chaque composant partagé.
3. **États humanisés** : DogEmptyArt, microcopies, chargements, erreurs, confirmations. Acceptation : 27 états vides illustrés, poids ajouté < 10 Ko.
4. **Profil humain** : disponibilités, préférences de collaboration, visibilité par champ, prévisualisation réelle. Dépend de l'audit RLS. Acceptation : tests RLS par API avec comptes démo.
5. **Accueils vivants & célébration douce** : salutation saisonnière, nom du chien autorisé, jauges sauge, célébration or des tampons, badges facultatifs. Acceptation : désactivable, aucun classement, respecte `reduced_motion`.

## 13. Risque qualitatif et données
- Faible : Lots 1, 3. Moyen : Lots 2, 5. Élevé : Lot 4 (données personnelles, RLS).
- Interventions données : colonnes `user_preferences` (Lots 1–2), colonnes `profiles` ou table de visibilité (Lot 4), éventuellement table de badges (Lot 5, à évaluer : peut se calculer sans stockage).

## Proposition
Approuver ce cadrage, puis lancer le Lot 1 seul. Chaque lot se termine par tests, contrôle sécurité et captures avant de passer au suivant.
