import { useEffect, useState } from "react";
import { Copy, MapPin, Navigation } from "lucide-react";
import { toast } from "sonner";
import { mapsUrl } from "@/lib/places";

/** Lieu + adresse avec « Ouvrir dans Google Maps » et « Copier l'adresse ». */
export function PlaceInfo({ location, address }: { location?: string | null; address?: string | null }) {
  const target = (address || location || "").trim();
  if (!target) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(target);
      toast.success("Adresse copiée");
    } catch {
      toast.error("Copie impossible sur cet appareil");
    }
  };
  return (
    <div className="space-y-1.5">
      <p className="flex items-start gap-2">
        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>
          {location ? <span className="font-medium">{location}</span> : null}
          {address && address !== location ? <span className="block text-muted-foreground">{address}</span> : null}
        </span>
      </p>
      <div className="flex flex-wrap gap-2 pl-6">
        <a href={mapsUrl(target)} target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs hover:bg-accent">
          <Navigation className="size-3.5" aria-hidden /> Ouvrir dans Google Maps
        </a>
        <button type="button" onClick={copy}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs hover:bg-accent">
          <Copy className="size-3.5" aria-hidden /> Copier l'adresse
        </button>
      </div>
    </div>
  );
}

const WMO: Record<number, string> = {
  0: "Ciel dégagé", 1: "Plutôt dégagé", 2: "Partiellement nuageux", 3: "Couvert", 45: "Brouillard", 48: "Brouillard givrant",
  51: "Bruine légère", 53: "Bruine", 55: "Bruine forte", 61: "Pluie faible", 63: "Pluie", 65: "Forte pluie",
  71: "Neige faible", 73: "Neige", 75: "Forte neige", 80: "Averses", 81: "Averses", 82: "Fortes averses",
  95: "Orage", 96: "Orage et grêle", 99: "Orage et grêle",
};

type Forecast = { tmin: number; tmax: number; label: string; rain: number } | null;

/** Indication météo Open-Meteo (gratuit, sans clé) pour le jour prévu : aide à s'habiller ou adapter le terrain. */
export function WeatherHint({ place, date }: { place?: string | null; date?: string | null }) {
  const [state, setState] = useState<Forecast | "loading" | "none">("loading");
  const day = date ? new Date(date).toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }) : null;
  useEffect(() => {
    const q = (place ?? "").trim();
    if (!q || !day) { setState("none"); return; }
    const diff = (new Date(`${day}T12:00:00Z`).getTime() - Date.now()) / 86400000;
    if (diff < -1 || diff > 15) { setState("none"); return; }
    let alive = true;
    (async () => {
      try {
        const term = q.split(",").map((s) => s.trim()).filter(Boolean).pop() ?? q;
        const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(term.replace(/^\d{5}\s*/, ""))}&count=1&language=fr&countryCode=FR`).then((r) => r.json());
        const g = geo?.results?.[0];
        if (!g) { if (alive) setState("none"); return; }
        const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FParis&start_date=${day}&end_date=${day}`).then((r) => r.json());
        const d = w?.daily;
        if (!alive) return;
        if (!d?.time?.length) { setState("none"); return; }
        setState({ tmin: Math.round(d.temperature_2m_min[0]), tmax: Math.round(d.temperature_2m_max[0]), label: WMO[d.weather_code[0]] ?? "Temps variable", rain: d.precipitation_probability_max?.[0] ?? 0 });
      } catch { if (alive) setState("none"); }
    })();
    return () => { alive = false; };
  }, [place, day]);
  if (!state || state === "none" || state === "loading") return null;
  return (
    <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground" aria-live="polite">
      Météo prévue : <span className="font-medium text-foreground">{state.label}</span>, {state.tmin}° à {state.tmax}°
      {state.rain >= 30 ? ` · pluie ${state.rain} %` : ""}. Simple indication, à revérifier le jour même.
    </p>
  );
}
