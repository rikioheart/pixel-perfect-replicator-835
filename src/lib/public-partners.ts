import { parseDocument } from 'htmlparser2';
import { Element, Text, type AnyNode } from 'domhandler';

export type PublicPartner = {
  id: string; name: string; kind: 'services' | 'commercial'; description: string;
  specialties: string[]; sector: string; hours: string; links: { label: string; url: string }[];
  slug: string | null; source: 'association' | 'platform';
};

export function publicUrl(value: string): string | null {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}
function elements(node: AnyNode): Element[] {
  const children = 'children' in node ? node.children : [];
  return children.flatMap(child => child instanceof Element ? [child, ...elements(child)] : elements(child));
}
function text(node: AnyNode): string {
  if (node instanceof Text) return node.data;
  if (node instanceof Element && ['script', 'style', 'svg'].includes(node.name)) return '';
  return ('children' in node ? node.children.map(text).join(' ') : '').replace(/\s+/g, ' ').trim();
}
function hasClass(node: Element, value: string) { return (node.attribs['class'] ?? '').split(/\s+/).includes(value); }
const privateOffer = /code\s+promo|promotionn?el|réduct[iî]on|réductin/i;

/** Read only the partner blocks, never render remote HTML or member promotion codes. */
export function parseWordPressPartners(html: string): PublicPartner[] {
  const root = parseDocument(html);
  return elements(root).filter(node => hasClass(node, 'e-grid') && hasClass(node, 'e-con')).flatMap(block => {
    const nodes = elements(block);
    const editors = nodes.filter(node => hasClass(node, 'elementor-widget-text-editor'));
    const editor = editors[0];
    if (!editor || editors.length !== 1) return [];
    const paragraphs = elements(editor).filter(node => ['p', 'h2', 'h3'].includes(node.name)).map(text).filter(Boolean);
    const rawName = paragraphs[0];
    if (!rawName) return [];
    const name = rawName.replace(/^.*?fondatrice de\s+/i, '').replace(/\s*🎨/g, '').trim();
    const safe = paragraphs.slice(1).filter(value => !privateOffer.test(value));
    const sector = safe.find(value => /^Zone d[’']activité/i.test(value))?.replace(/^Zone d[’']activité\s*:\s*/i, '') ?? '';
    const hours = safe.filter(value => /^Horaires/i.test(value)).join(' ').replace(/^Horaires\s*:\s*/i, '');
    const specialties = elements(editor).filter(node => node.name === 'li').map(text).filter(value => !privateOffer.test(value));
    const description = safe.filter(value => !/^(Zone d[’']activité|Horaires|Services\s*:)/i.test(value) && !/^(Facebook|Instagram|Internet-explorer|Youtube)$/i.test(value) && !specialties.includes(value)).join('\n\n');
    const links: PublicPartner['links'] = [];
    for (const anchor of nodes.filter(node => node.name === 'a')) {
      const raw = anchor.attribs['href'] ?? '';
      const url = raw.startsWith('mailto:') || raw.startsWith('tel:') ? raw : publicUrl(raw);
      if (!url || links.some(link => link.url === url)) continue;
      const label = /instagram/.test(url) ? 'Instagram' : /facebook/.test(url) ? 'Facebook' : /tiktok/.test(url) ? 'TikTok' : /threads/.test(url) ? 'Threads' : /youtube/.test(url) ? 'YouTube' : url.startsWith('mailto:') ? 'E-mail' : url.startsWith('tel:') ? 'Téléphone' : 'Site internet';
      links.push({label, url});
    }
    const id = block.attribs['data-id'];
    if (!id) return [];
    return [{id: `wp-${id}`, name, kind: block.attribs['aria-labelledby'] === 'e-n-accordion-item-1600' ? 'commercial' as const : 'services' as const, description, specialties, sector, hours, links, slug: null, source: 'association' as const}];
  });
}
export function normalizedPartnerName(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
/** Prefer a published platform card over an identical editorial listing; no account matching. */
export function mergePublicPartners(editorial: PublicPartner[], published: PublicPartner[]) {
  const names = new Set(published.map(partner => normalizedPartnerName(partner.name)));
  return [...published, ...editorial.filter(partner => !names.has(normalizedPartnerName(partner.name)))].sort((a,b) => a.name.localeCompare(b.name, 'fr'));
}
export function filterPublicPartners(partners: PublicPartner[], term: string, kind: string, sector: string) {
  const search = normalizedPartnerName(term);
  return partners.filter(partner => (kind === 'all' || partner.kind === kind)
    && (sector === 'all' || partner.sector === sector)
    && (!search || normalizedPartnerName([partner.name, partner.description, partner.sector, ...partner.specialties].join(' ')).includes(search)));
}