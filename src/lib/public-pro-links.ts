export type PublicProLink = { label: string; url: string };

function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

/** Only use links from the explicitly published profile. */
export function publicProLinks(website: unknown, socials: unknown): PublicProLink[] {
  const links: PublicProLink[] = [];
  const site = safeUrl(website);
  if (site) links.push({ label: 'Site internet', url: site });
  if (!socials || typeof socials !== 'object' || Array.isArray(socials)) return links;
  const labels: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', youtube: 'YouTube', tiktok: 'TikTok', threads: 'Threads' };
  for (const [platform, value] of Object.entries(socials)) {
    const url = safeUrl(value);
    if (!url || links.some(link => link.url === url)) continue;
    links.push({ label: labels[platform.toLowerCase()] ?? platform, url });
  }
  return links;
}
