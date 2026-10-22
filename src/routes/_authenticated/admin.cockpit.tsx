import { createFileRoute, redirect } from "@tanstack/react-router";

// Ancien cockpit fusionné dans la console canonique /admin : les anciens liens et favoris restent valides.
export const Route = createFileRoute("/_authenticated/admin/cockpit")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", replace: true });
  },
});
