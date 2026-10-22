/** Code court lisible du Pass Terrain : 8 premiers caractères hexadécimaux, format « ABCD-1234 ». */
export function passShortCode(qr: string): string {
  const hex = qr.replace(/[^0-9a-f]/gi, "").toUpperCase().slice(0, 8);
  return hex.length === 8 ? `${hex.slice(0, 4)}-${hex.slice(4)}` : hex;
}

/**
 * Normalise un texte scanné, collé ou saisi. Retourne le code complet (32 car.) ou court (8 car.),
 * ou null s'il n'est pas exploitable. Accepte aussi une URL contenant le code.
 */
export function normalizePassInput(raw: string): string | null {
  const text = raw.trim();
  const uuid = text.match(/[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/i);
  if (uuid) return uuid[0].replace(/-/g, "").toLowerCase();
  const hex = text.replace(/[\s-]/g, "");
  if (/^[0-9a-f]{8}$/i.test(hex)) return hex.toLowerCase();
  return null;
}
