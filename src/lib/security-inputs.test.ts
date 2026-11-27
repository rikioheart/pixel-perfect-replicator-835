import { describe, expect, it } from 'vitest';
import { canImportMemberships, escapePrintHtml } from './security-inputs';

describe('printable card input', () => {
  it('escapes a title-closing script attack', () => {
    expect(escapePrintHtml('</title><script>alert(1)</script>')).toBe('&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
  });
  it('escapes quotes and ampersands in attributes', () => {
    expect(escapePrintHtml(`" onload='attack' &`)).toBe('&quot; onload=&#39;attack&#39; &amp;');
  });
});

describe('membership import permission', () => {
  it('rejects a Bureau member with revoked validation permission', () => {
    expect(canImportMemberships(true, false)).toBe(false);
  });
  it('rejects non-Bureau members even with a validation grant', () => {
    expect(canImportMemberships(false, true)).toBe(false);
  });
  it('allows Bureau members with effective validation permission', () => {
    expect(canImportMemberships(true, true)).toBe(true);
  });
  it('fails closed when either check fails', () => {
    expect(canImportMemberships(true, null)).toBe(false);
    expect(canImportMemberships(null, true)).toBe(false);
  });
});