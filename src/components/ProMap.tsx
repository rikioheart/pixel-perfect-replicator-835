import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

type Pin = { slug: string; name: string; city: string | null; sector: string | null };

/** Carte des professionnels par ville (géocodage via la Base Adresse Nationale, aucune donnée stockée). */
export function ProMap({ pros, onSelect }: { pros: Pin[]; onSelect?: (city: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let map: import('leaflet').Map | null = null;
    let cancelled = false;
    setNote(null);
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { scrollWheelZoom: false }).setView([48.3, 2.7], 8);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 18 }).addTo(map);
      const color = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || 'currentColor';
      const cities = [...new Set(pros.map((p) => p.city).filter(Boolean) as string[])];
      const points: [number, number][] = [];
      for (const city of cities) {
        try {
          const r = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(city)}&type=municipality&limit=1`);
          const j = await r.json();
          const c = j.features?.[0]?.geometry?.coordinates;
          if (!c || cancelled || !map) continue;
          const ll: [number, number] = [c[1], c[0]];
          points.push(ll);
          const here = pros.filter((p) => p.city === city);
          const m = L.circleMarker(ll, { radius: 9 + Math.min(here.length, 5), color, fillColor: color, fillOpacity: 0.6 }).addTo(map);
          const box = document.createElement('div');
          const title = document.createElement('strong'); title.textContent = city; box.appendChild(title);
          here.forEach((p) => { const a = document.createElement('a'); a.href = `/professionnels/${encodeURIComponent(p.slug)}`; a.textContent = p.name + (p.sector ? ` · ${p.sector}` : ''); a.style.display = 'block'; box.appendChild(a); });
          m.bindPopup(box);
          m.on('click', () => onSelect?.(city));
        } catch { /* ville non localisée */ }
      }
      if (cancelled || !map) return;
      if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 11 });
      else setNote(cities.length ? 'Localisation momentanément indisponible.' : 'Les professionnels apparaîtront ici dès leur référencement public.');
    })().catch(() => { if (!cancelled) setNote('La carte est momentanément indisponible. Les fiches restent consultables ci-dessous.'); });
    return () => { cancelled = true; map?.remove(); };
  }, [pros, onSelect]);

  return (
    <div className="space-y-2">
      <div ref={ref} role="region" aria-label="Carte des professionnels référencés" className="relative z-0 h-80 w-full overflow-hidden rounded-lg border border-border sm:h-96" />
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </div>
  );
}
