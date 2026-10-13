import { describe, expect, it } from 'vitest';
import { firstSiteImage } from './public-articles';

describe('firstSiteImage', () => {
  it('keeps only images hosted on the association site', () => {
    expect(firstSiteImage('<img src="https://evil.test/a.png"><img src="https://lavoixduchien.fr/wp-content/uploads/2026/08/A.png">')).toBe('https://lavoixduchien.fr/wp-content/uploads/2026/08/A.png');
    expect(firstSiteImage('<p>sans image</p>')).toBeNull();
  });
});
