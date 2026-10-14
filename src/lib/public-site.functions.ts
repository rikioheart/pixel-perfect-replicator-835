import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';

export type PublicActivity = {
  id: string; title: string; description: string | null; date: string; location: string | null; image_url: string | null;
  category: string | null; price_public: number | null; price_member: number | null; capacity: number | null; occupied: number | null;
  dog_policy: string | null; for_you_if: string | null; to_bring: string | null;
};

export const getPublicAgenda = createServerFn({ method: 'GET' }).handler(async () => {
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  const url = process.env['SUPABASE_URL'];
  if (!key || !url) return { activities: [] as PublicActivity[], unavailable: true };
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
    headers.set('apikey', key); return fetch(input, { ...init, headers });
  } } });
  const { data, error } = await client.rpc('list_public_activities');
  if (error) { console.error('list_public_activities failed:', error); return { activities: [] as PublicActivity[], unavailable: true }; }
  return { activities: (data ?? []) as unknown as PublicActivity[], unavailable: false };
});

/** Places restantes ; null si la capacité n'est pas limitée. */
export function spotsLeft(a: Pick<PublicActivity, 'capacity' | 'occupied'>) {
  return a.capacity ? Math.max(0, a.capacity - (a.occupied ?? 0)) : null;
}
