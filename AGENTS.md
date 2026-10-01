<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- `people` = personne associative (avec ou sans compte) ; `profiles.person_id` la relie au compte, et les tables de liens (memberships, household_members, project_members, participation_members) portent `person_id` rempli automatiquement depuis `user_id`. Pourquoi : séparer authentification, compte et personne sans casser l'existant.
- Schéma : les migrations passent par l'outil de migration de la plateforme (journal dans drizzle/migrations) ; ne jamais écrire drizzle/schema.ts à la main. Pourquoi : un seul chemin de migration.
