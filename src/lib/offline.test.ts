import { describe, it, expect } from 'vitest';
import { canAutoSync, needsMediation, parisDay, readOfflinePass, savePublicPros, type PendingStamp } from './offline';
describe('tampons en attente', () => {
  const item: PendingStamp = { id:'1', owner:'pro', member:'member', bureau:'bureau', reason:'Séance', day:'2026-10-11', state:'pending' };
  it('isole les comptes', () => expect(canAutoSync(item,'autre',item.day)).toBe(false));
  it('ne rejoue jamais automatiquement après changement de jour', () => expect(canAutoSync(item,'pro','2026-10-12')).toBe(false));
  it('synchronise le jour même uniquement', () => expect(canAutoSync(item,'pro',item.day)).toBe(true));
  it('ne rejoue pas un refus serveur', () => expect(canAutoSync({...item,state:'review'},'pro',item.day)).toBe(false));
  it('utilise le jour de Paris', () => expect(parisDay(new Date('2026-10-11T23:00:00Z'))).toBe('2026-10-12'));
  it('propose la médiation Bureau pour une demande de la veille', () => expect(needsMediation(item,'pro','2026-10-12')).toBe(true));
  it('propose la médiation Bureau après un refus serveur', () => expect(needsMediation({...item,state:'review'},'pro',item.day)).toBe(true));
  it('pas de médiation le jour même (synchronisation normale)', () => expect(needsMediation(item,'pro',item.day)).toBe(false));
  it('pas de médiation pour la demande d’un autre compte', () => expect(needsMediation(item,'autre','2026-10-12')).toBe(false));
});

describe('copies locales', () => {
  const store = new Map<string,string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = { getItem:(k:string)=>store.get(k) ?? null, setItem:(k:string,v:string)=>{store.set(k,v)}, removeItem:(k:string)=>{store.delete(k)}, clear:()=>store.clear(), key:()=>null, length:0 } as Storage;
  it('le pass local n’est lu que par son propriétaire', () => {
    store.set('lvdc.offline.pass', JSON.stringify({ owner:'a', name:'A', qr:'data:image/png;base64,xx', code:'7B29-C4E1', total:3, savedAt:'2026-10-23T08:00:00Z' }));
    expect(readOfflinePass('a')?.code).toBe('7B29-C4E1');
    expect(readOfflinePass('b')).toBeNull();
  });
  it('refuse un pass local dont l’image n’est pas une image locale', () => {
    store.set('lvdc.offline.pass', JSON.stringify({ owner:'a', name:'A', qr:'https://exemple.test/x.png', code:'', total:0, savedAt:'' }));
    expect(readOfflinePass('a')).toBeNull();
  });
  it('les partenaires mis en cache ne gardent que nom, métiers et ville', () => {
    savePublicPros([{ name:'Educ', sector:'Éducateur', specialties:['Chiot'], city:'Lyon', email:'secret@x.fr' } as never]);
    const saved = JSON.parse(store.get('lvdc.public.pros')!);
    expect(saved).toEqual([{ display_name:'Educ', specialties:['Éducateur','Chiot'], public_city:'Lyon' }]);
  });
});
