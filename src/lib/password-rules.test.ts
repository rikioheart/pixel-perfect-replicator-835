import { describe, expect, it } from 'vitest';
import { checkNewPassword, readRecoveryHash } from './password-rules';

describe('nouveau mot de passe', () => {
  it('refuse moins de 8 caractères', () => {
    expect(checkNewPassword('abc1234', 'abc1234').password).toBe('too_short');
  });
  it('accepte 8 caractères identiques à la confirmation', () => {
    expect(checkNewPassword('abcd1234', 'abcd1234')).toEqual({ password: null, confirmation: null });
  });
  it('refuse une confirmation différente', () => {
    expect(checkNewPassword('abcd1234', 'abcd1235').confirmation).toBe('mismatch');
  });
});

describe('lien reçu par e-mail', () => {
  it('reconnaît un lien de réinitialisation', () => {
    expect(readRecoveryHash('#access_token=x&refresh_token=y&type=recovery').kind).toBe('recovery');
  });
  it('signale un lien expiré', () => {
    expect(readRecoveryHash('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')).toEqual({ kind: 'error', expired: true });
  });
  it('ignore une adresse sans lien', () => {
    expect(readRecoveryHash('').kind).toBe('none');
  });
});
