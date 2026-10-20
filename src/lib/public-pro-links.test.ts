import { describe, expect, it } from 'vitest';
import { publicProLinks } from './public-pro-links';

describe('Published professional links', () => {
  it('preserves published website and networks', () => {
    expect(publicProLinks('https://example.org', { instagram: 'https://instagram.com/example' })).toEqual([
      { label: 'Site internet', url: 'https://example.org/' },
      { label: 'Instagram', url: 'https://instagram.com/example' },
    ]);
  });
  it('does not invent unpublished links', () => { expect(publicProLinks(null, null)).toEqual([]); });
  it('rejects unsafe URLs and credentials', () => {
    expect(publicProLinks('javascript:alert(1)', { facebook: 'data:text/html,test', instagram: 'https://user:password@example.org', linkedin: 123 })).toEqual([]);
  });
  it('does not repeat destinations', () => {
    expect(publicProLinks('https://example.org', { website: 'https://example.org/' })).toHaveLength(1);
  });
});
