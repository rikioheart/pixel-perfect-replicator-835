import { createFileRoute, redirect } from "@tanstack/react-router";

/** Ancien onglet « Historique » : fusionné dans « Mon parcours » ; l'audit technique reste au Bureau (Paramètres). */
export const Route = createFileRoute("/_authenticated/my-history")({
  beforeLoad: () => {
    throw redirect({ to: "/parcours", replace: true });
  },
});
