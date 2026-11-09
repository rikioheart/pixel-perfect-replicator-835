import { createFileRoute, redirect } from "@tanstack/react-router";

/** Ancienne liste des pros : fusionnée dans l'annuaire (vue Pros, recherche et département conservés). */
export const Route = createFileRoute("/_authenticated/professionals/")({
  beforeLoad: () => {
    throw redirect({ to: "/directory", search: { vue: "pros" }, replace: true });
  },
});
