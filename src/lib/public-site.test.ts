import { describe, expect, it } from 'vitest';
import { spotsLeft } from './public-site.functions';

describe('spotsLeft', () => {
  it('renvoie null sans capacité limitée', () => {
    expect(spotsLeft({ capacity: null, occupied: 5 })).toBeNull();
  });
  it('calcule les places restantes', () => {
    expect(spotsLeft({ capacity: 10, occupied: 4 })).toBe(6);
  });
  it('affiche complet sans négatif', () => {
    expect(spotsLeft({ capacity: 3, occupied: 7 })).toBe(0);
  });
});
