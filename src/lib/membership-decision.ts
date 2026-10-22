/** Résultat renvoyé par la fonction decide_membership. */
export type MembershipDecisionResult = { ok: boolean; status?: string; reason?: "NOT_FOUND" | "ALREADY_PROCESSED" };

/** Traduit le résultat (ou l'erreur) de decide_membership en message explicite pour le Bureau. */
export function membershipDecisionMessage(
  errorMessage: string | null,
  result: MembershipDecisionResult | null,
  decision: "ACTIVE" | "REFUSED",
): { ok: boolean; message: string } {
  if (errorMessage) {
    if (/propre adhésion/.test(errorMessage)) return { ok: false, message: "Vous ne pouvez pas décider de votre propre adhésion." };
    if (/Droit de validation|permission denied/i.test(errorMessage)) return { ok: false, message: "Décision refusée : le droit « valider les adhésions » ne vous est pas attribué." };
    return { ok: false, message: "La décision n'a pas pu être enregistrée. Réessayez dans un instant." };
  }
  if (!result) return { ok: false, message: "La décision n'a pas pu être enregistrée. Réessayez dans un instant." };
  if (!result.ok) {
    if (result.reason === "ALREADY_PROCESSED") return { ok: false, message: "Cette demande a déjà été traitée par un autre membre du Bureau." };
    return { ok: false, message: "Cette demande n'existe plus." };
  }
  return { ok: true, message: decision === "ACTIVE" ? "Adhésion validée. La personne est prévenue." : "Demande refusée. La personne est prévenue." };
}
