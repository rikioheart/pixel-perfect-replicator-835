import { describe, expect, it } from 'vitest';
import { filterPublicPartners, mergePublicPartners, parseWordPressPartners, partnerSectors, publicUrl, type PublicPartner } from './public-partners';

const html = `<div class="e-grid e-con" data-id="one" aria-labelledby="e-n-accordion-item-1600"><div class="elementor-widget-text-editor"><p>Flair’Rita</p><p>Artisanat éthique pour animaux.</p><p>Code promotionnel ALVC, 5% de réduction</p><script>private()</script></div><a href="https://lescreaderita.fr">Site</a><a href="javascript:alert(1)">Unsafe</a></div>`;
const partner: PublicPartner = {id:'1',name:'Pensées de Chiens',kind:'services',description:'Éducation canine',specialties:['Balades'],sector:'Orléans (45)',hours:'',links:[],slug:null,source:'association'};
describe('Public partner boundaries', () => {
  it('keeps member promotion codes out of the public listing', () => {
    const rows = parseWordPressPartners(html);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.description).toBe('Artisanat éthique pour animaux.');
    expect(JSON.stringify(rows)).not.toContain('ALVC');
  });
  it('never publishes unsafe links or executable remote markup', () => {
    expect(parseWordPressPartners(html)[0]?.links).toEqual([{label:'Site internet',url:'https://lescreaderita.fr/'}]);
    expect(publicUrl('javascript:alert(1)')).toBeNull();
  });
  it('retains a single listing when an explicitly published platform card has the same name', () => {
    const published = {...partner,id:'2',slug:'pensees-de-chiens',source:'platform' as const};
    expect(mergePublicPartners([partner],[published])).toEqual([published]);
  });
  it('combines accent-insensitive needs search, type and sector filters', () => {
    expect(filterPublicPartners([partner],'education','services','Orléans (45)')).toEqual([partner]);
    expect(filterPublicPartners([partner],'education','commercial','all')).toEqual([]);
    expect(filterPublicPartners([partner],'education','all','Nemours')).toEqual([]);
  });
  it('groups declared sectors without inventing geographical coverage', () => {
    expect(partnerSectors('Loiret (45), Seine-et-Marne (77), à distance')).toEqual(['Loiret (45)','Seine-et-Marne (77)','À distance']);
    expect(filterPublicPartners([partner],'','all','Loiret (45)')).toEqual([partner]);
    expect(partnerSectors('Secteur Toucy-Auxerre')).toEqual(['Secteur Toucy-Auxerre']);
  });
});