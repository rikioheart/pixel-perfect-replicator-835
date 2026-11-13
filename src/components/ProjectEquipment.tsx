import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RESERVATION_STATUS_LABEL, validateReservationDraft } from "@/lib/inventory";
import { humanizeError, NOT_ALLOWED } from "@/lib/user-messages";

const SELECT = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR") : "sans fin");
const errText = (e: Error) =>
  e.message.includes("row-level") || e.message.includes("permission") ? NOT_ALLOWED : humanizeError(e);

/**
 * Matériel d'un projet, depuis sa fiche : réservations en cours et réservation rapide.
 * Bureau et coordinateurs du projet ; la base revérifie droits, visibilité et stock (anti-surréservation).
 */
export function ProjectEquipment({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ itemId: "", quantity: "1", start: today(), end: "", notes: "" });

  const { data: items = [] } = useQuery({
    queryKey: ["inventory", "project-picker"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory").select("id, name, quantity").is("archived_at", null).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ["inventory-reservations", "project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_reservations")
        .select("id, inventory_id, quantity, start_date, end_date, status, notes")
        .eq("project_id", projectId)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Disponibilité de tout l'inventaire général sur la période demandée (stock − réservations actives).
  const { data: availability } = useQuery({
    queryKey: ["inventory-period", "project", draft.start, draft.end],
    enabled: open && Boolean(draft.start) && (!draft.end || draft.end >= draft.start),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("inventory_availability", {
        _start: draft.start,
        ...(draft.end ? { _end: draft.end } : {}),
      });
      if (error) throw error;
      return new Map((data ?? []).map((a) => [a.inventory_id, a.available as number]));
    },
  });
  const available = draft.itemId && availability ? (availability.get(draft.itemId) ?? 0) : undefined;

  const refresh = () => {
    for (const k of ["inventory-reservations", "inventory-availability", "inventory-period"])
      void qc.invalidateQueries({ queryKey: [k] });
  };

  const reserve = useMutation({
    mutationFn: async () => {
      if (!draft.itemId) throw new Error("Choisissez le matériel.");
      const values = { projectId, quantity: Number(draft.quantity), startDate: draft.start, endDate: draft.end || null };
      const problem = validateReservationDraft(values, available ?? 0);
      if (problem) throw new Error(problem);
      const { error } = await supabase.from("inventory_reservations").insert({
        inventory_id: draft.itemId,
        project_id: projectId,
        quantity: values.quantity,
        start_date: values.startDate,
        end_date: values.endDate,
        notes: draft.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Matériel réservé pour le projet.");
      setDraft({ itemId: "", quantity: "1", start: today(), end: "", notes: "" });
      setOpen(false);
      refresh();
    },
    onError: (e: Error) => toast.error(errText(e)),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "RETURNED" | "CANCELLED" }) => {
      const { error } = await supabase.from("inventory_reservations").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(errText(e)),
  });

  const nameOf = (id: string) => items.find((i) => i.id === id)?.name ?? "Matériel";
  const active = reservations.filter((r) => r.status === "ACTIVE");
  const past = reservations.filter((r) => r.status !== "ACTIVE");

  return (
    <section className="panel space-y-3 p-5" aria-labelledby="project-equipment-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="project-equipment-title" className="flex items-center gap-2 text-lg">
          <Package className="size-4 text-primary" aria-hidden /> Matériel du projet
        </h2>
        <span className="flex flex-wrap items-center gap-3">
          <Link to="/inventory" search={{ projectId }} className="text-sm text-primary hover:underline">
            Ouvrir l'inventaire
          </Link>
          <Button size="sm" variant={open ? "outline" : "default"} onClick={() => setOpen((o) => !o)}>
            {open ? "Fermer" : "Réserver du matériel"}
          </Button>
        </span>
      </div>

      {open ? (
        <form
          className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            reserve.mutate();
          }}
        >
          <div className="sm:col-span-2">
            <Label htmlFor="pe-item">Matériel</Label>
            <select id="pe-item" className={SELECT} value={draft.itemId} onChange={(e) => setDraft({ ...draft, itemId: e.target.value })}>
              <option value="">Choisir…</option>
              {items.map((i) => {
                const free = availability?.get(i.id);
                return (
                  <option key={i.id} value={i.id} disabled={free === 0 && i.id !== draft.itemId}>
                    {i.name} — {free === undefined ? `stock ${i.quantity}` : free === 0 ? "indisponible sur ces dates" : `${free} disponible(s) / ${i.quantity}`}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <Label htmlFor="pe-q">Quantité</Label>
            <Input id="pe-q" type="number" min="1" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
          </div>
          <p className="self-end text-sm text-muted-foreground" aria-live="polite">
            {draft.itemId ? `Disponible sur la période : ${available ?? "…"}` : "Choisissez un matériel pour voir sa disponibilité."}
          </p>
          <div>
            <Label htmlFor="pe-s">Du</Label>
            <Input id="pe-s" type="date" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="pe-e">Au (facultatif)</Label>
            <Input id="pe-e" type="date" min={draft.start} value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="pe-n">Note (facultatif)</Label>
            <Input id="pe-n" maxLength={1000} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={reserve.isPending || (Boolean(draft.itemId) && available === undefined)}>
              Réserver pour ce projet
            </Button>
          </div>
        </form>
      ) : null}

      {active.length === 0 && past.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun matériel réservé pour ce projet.</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {[...active, ...past.slice(0, 5)].map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0">
                <span className="font-medium">
                  {r.quantity} × {nameOf(r.inventory_id)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  du {fmt(r.start_date)} au {fmt(r.end_date)}
                  {r.notes ? ` · ${r.notes}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Badge variant={r.status === "ACTIVE" ? "default" : "outline"}>{RESERVATION_STATUS_LABEL[r.status] ?? r.status}</Badge>
                {r.status === "ACTIVE" ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: r.id, status: "RETURNED" })}>
                      Rendu
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: r.id, status: "CANCELLED" })}>
                      Annuler
                    </Button>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
