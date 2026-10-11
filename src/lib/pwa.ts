export async function registerOfflineWorker() {
  if (!('serviceWorker' in navigator)) return;
  const host = location.hostname;
  const refused = !import.meta.env.PROD || window.self !== window.top || /^(id-preview--|preview--)/.test(host) || ['lovableproject.com','lovableproject-dev.com','beta.lovable.dev'].some(h => host === h || host.endsWith(`.${h}`)) || new URLSearchParams(location.search).get('sw') === 'off';
  if (refused) {
    for (const r of await navigator.serviceWorker.getRegistrations()) {
      if ([r.active, r.waiting, r.installing].some(w => w && new URL(w.scriptURL).pathname === '/sw.js')) await r.unregister();
    }
    return;
  }
  await navigator.serviceWorker.register('/sw.js');
}