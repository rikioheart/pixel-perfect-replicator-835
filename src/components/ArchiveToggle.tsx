import { Button } from "@/components/ui/button";

/** Bascule « À venir / en cours » ↔ historique : les éléments passés restent consultables, jamais supprimés. */
export function ArchiveToggle({
  view,
  setView,
  counts,
  pastLabel,
}: {
  view: "current" | "past";
  setView: (v: "current" | "past") => void;
  counts: { current: unknown[]; past: unknown[] };
  pastLabel: string;
}) {
  return (
    <div role="tablist" aria-label="Période" className="mb-4 inline-flex rounded-lg border border-border bg-card p-1">
      <Button role="tab" aria-selected={view === "current"} size="sm" variant={view === "current" ? "default" : "ghost"} onClick={() => setView("current")}>
        À venir & en cours ({counts.current.length})
      </Button>
      <Button role="tab" aria-selected={view === "past"} size="sm" variant={view === "past" ? "default" : "ghost"} onClick={() => setView("past")}>
        {pastLabel} ({counts.past.length})
      </Button>
    </div>
  );
}
