import { describe, it, expect } from 'vitest';
import { canAutoSync, parisDay, type PendingStamp } from './offline';
describe('tampons en attente', () => {
  const item: PendingStamp = { id:'1', owner:'pro', member:'member', bureau:'bureau', reason:'Séance', day:'2026-10-11', state:'pending' };
  it('isole les comptes', () => expect(canAutoSync(item,'autre',item.day)).toBe(false));
  it('ne rejoue jamais automatiquement après changement de jour', () => expect(canAutoSync(item,'pro','2026-10-12')).toBe(false));
  it('synchronise le jour même uniquement', () => expect(canAutoSync(item,'pro',item.day)).toBe(true));
  it('ne rejoue pas un refus serveur', () => expect(canAutoSync({...item,state:'review'},'pro',item.day)).toBe(false));
  it('utilise le jour de Paris', () => expect(parisDay(new Date('2026-10-11T23:00:00Z'))).toBe('2026-10-12'));
});