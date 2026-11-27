/** Escapes dynamic text and quoted attributes in the printable card. */
export function escapePrintHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return entities[char] ?? char;
  });
}

/** Importing membership decisions requires both the role and effective permission. */
export function canImportMemberships(bureau: unknown, validate: unknown): boolean {
  return bureau === true && validate === true;
}