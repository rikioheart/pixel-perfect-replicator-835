/**
 * Accès au Pass Terrain (affichage seulement : la base applique les mêmes règles).
 * - Valideur : professionnel validé d'office ; membre du Bureau seulement après activation.
 * - Pass personnel : actif d'office pour un particulier ; à activer pour un pro ou un autre profil.
 * - Tampons : adhésion ACTIVE + pass personnel actif, jamais sur soi-même.
 */
export type PassAccess = {
  membership_type: string | null;
  membership_status: string | null;
  is_pro: boolean;
  is_bureau: boolean;
  personal_pass_at: string | null;
  validator_at: string | null;
  is_validator: boolean;
  can_receive_stamps: boolean;
};

export type ValidatorSource = "PRO" | "BUREAU" | null;

export function validatorSource(a: Pick<PassAccess, "is_pro" | "is_bureau" | "validator_at">): ValidatorSource {
  if (a.is_pro) return "PRO";
  if (a.is_bureau && a.validator_at) return "BUREAU";
  return null;
}

/** Le Bureau (non pro) peut activer ou suspendre son statut valideur ; un pro est valideur d'office. */
export function canToggleValidator(a: Pick<PassAccess, "is_pro" | "is_bureau">): boolean {
  return a.is_bureau && !a.is_pro;
}

export function hasPersonalPass(a: Pick<PassAccess, "membership_type" | "personal_pass_at">): boolean {
  return a.membership_type === "PARTICULIER" || Boolean(a.personal_pass_at);
}

/** Un particulier a son pass d'office : seuls les autres profils voient l'activation. */
export function needsPersonalPassActivation(a: Pick<PassAccess, "membership_type">): boolean {
  return a.membership_type !== "PARTICULIER";
}

export function canReceiveStamps(a: Pick<PassAccess, "membership_type" | "membership_status" | "personal_pass_at">): boolean {
  return a.membership_status === "ACTIVE" && hasPersonalPass(a);
}

export function canStamp(validator: Pick<PassAccess, "is_pro" | "is_bureau" | "validator_at">, validatorId: string, memberId: string): boolean {
  return validatorSource(validator) !== null && validatorId !== memberId;
}

/** Écran d'activation affiché aux comptes à casquettes multiples (Bureau ou pro). */
export function showsActivationScreen(a: Pick<PassAccess, "is_pro" | "is_bureau">): boolean {
  return a.is_pro || a.is_bureau;
}
