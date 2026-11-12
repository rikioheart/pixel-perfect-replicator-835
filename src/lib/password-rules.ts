/** Longueur minimale commune à l'inscription et à la réinitialisation. */
export const PASSWORD_MIN_LENGTH = 8;

export type NewPasswordIssue = 'empty' | 'too_short' | 'mismatch' | null;

/** Vérifie un nouveau mot de passe et sa confirmation avant l'envoi (le serveur reste juge). */
export function checkNewPassword(password: string, confirmation: string): { password: NewPasswordIssue; confirmation: NewPasswordIssue } {
  const pwd: NewPasswordIssue = password.length === 0 ? 'empty' : password.length < PASSWORD_MIN_LENGTH ? 'too_short' : null;
  const conf: NewPasswordIssue = confirmation.length === 0 ? 'empty' : confirmation !== password ? 'mismatch' : null;
  return { password: pwd, confirmation: conf };
}

/** Lit l'adresse de retour du lien e-mail : récupération demandée, ou erreur (lien expiré, déjà utilisé). */
export function readRecoveryHash(hash: string): { kind: 'recovery' | 'error' | 'none'; expired: boolean } {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (params.get('error') || params.get('error_code')) {
    return { kind: 'error', expired: /expired/i.test(`${params.get('error_code') ?? ''} ${params.get('error_description') ?? ''}`) };
  }
  if (params.get('type') === 'recovery' && params.get('access_token')) return { kind: 'recovery', expired: false };
  return { kind: 'none', expired: false };
}
