import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, CalendarRange, ExternalLink, Package, Pencil, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useCoordinatedProjects } from "@/hooks/useCoordinatedProjects";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  INVENTORY_CONDITIONS,
  INVENTORY_TYPES,
  RESERVATION_STATUS_LABEL,
  availableQuantity,
  conditionLabel,
  movementChange,
  typeLabel,
  INVENTORY_VISIBILITY,
  visibilityLabel,
  validateItemDraft,
  validateReservationDraft,
} from "@/lib/inventory";
import { humanizeError, NOT_ALLOWED } from "@/lib/user-messages";
import { InlineLoading } from "@/components/LoadingState";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventaire — La Voix du Chien" },
      {
        name: "description",
        content:
          "Matériel, équipements, consommables et produits de l'association : stock, mouvements et réservations par projet.",
      },
      { property: "og:title", content: "Inventaire — La Voix du Chien" },
      {
        property: "og:description",
        content: "Stocks, mouvements et réservations de matériel associatif.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { projectId?: string } =>
    typeof search["projectId"] === "string" && search["projectId"] ? { projectId: search["projectId"] as string } : {},
  component: InventoryPage,
});

const SELECT = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR") : "sans fin");
const errText = (e: Error) =>
  e.message.includes("row-level") || e.message.includes("permission") ? NOT_ALLOWED : humanizeError(e);

type Item = {
  id: string; name: string; category: string | null; quantity: number; alert_threshold: number; location: string | null;
  type: string | null; condition: string | null; referent_person_id: string | null; unit_price: number | null;
  document_url: string | null; description: string | null; visibility: string;
};
const EMPTY_ITEM = {
  name: "", type: "MATERIEL", category: "", quantity: "0", alert_threshold: "0", location: "", condition: "",
  referent_person_id: "", unit_price: "", document_url: "", description: "", visibility: "BUREAU",
};

function InventoryPage() {
  const { isBureau, user } = useAuth();
  const { projectId: focusProject } = Route.useSearch();
  const coordinated = useCoordinatedProjects(user?.id);
  const qc = useQueryClient();
  const canReserve = isBureau || coordinated.size > 0;

  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");
  const [alertOnly, setAlertOnly] = useState(false);
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [form, setForm] = useState(EMPTY_ITEM);
  const [moving, setMoving] = useState<{ item: Item; kind: "IN" | "OUT" } | null>(null);
  const [move, setMove] = useState({ quantity: "1", reason: "" });
  const [reserving, setReserving] = useState<Item | null>(null);
  const [resv, setResv] = useState({ projectId: focusProject ?? "", quantity: "1", start: today(), end: "", notes: "" });

  const refresh = () => {
    for (const k of ["inventory", "inventory-availability", "inventory-reservations", "inventory-movements", "inventory-period"])
      void qc.invalidateQueries({ queryKey: [k] });
  };

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory").select("*").is("archived_at", null).order("name");
      if (error) throw error;
      return data as Item[];
    },
  });

  // Disponibilité agrégée (réservations ACTIVE en cours ou à venir), sans détail de projet.
  const { data: availability = [] } = useQuery({
    queryKey: ["inventory-availability"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("inventory_availability", {});
      if (error) throw error;
      return data ?? [];
    },
  });
  const availOf = useMemo(() => new Map(availability.map((a) => [a.inventory_id, a])), [availability]);

  const { data: reservations = [] } = useQuery({
    queryKey: ["inventory-reservations"],
    enabled: canReserve,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_reservations")
        .select("id, inventory_id, project_id, quantity, start_date, end_date, status, notes, created_at, projects(title)")
        .order("start_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["inventory-movements"],
    enabled: isBureau,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_movements")
        .select("id, inventory_id, quantity_change, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["inventory-projects", isBureau, [...coordinated].sort().join(",")],
    enabled: canReserve,
    queryFn: async () => {
      let q = supabase.from("projects").select("id, title").order("title");
      if (!isBureau) q = q.in("id", [...coordinated]);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: people = [] } = useQuery({
    queryKey: ["inventory-people"],
    enabled: isBureau,
    queryFn: async () =>
      (await supabase.from("people").select("id, display_name, first_name, last_name").order("last_name")).data ?? [],
  });
  const personName = (id: string | null) => {
    const p = people.find((x) => x.id === id);
    return p ? p.display_name || [p.first_name, p.last_name].filter(Boolean).join(" ") : null;
  };

  // Disponibilité sur la période choisie dans la fenêtre de réservation.
  const { data: periodAvail } = useQuery({
    queryKey: ["inventory-period", reserving?.id, resv.start, resv.end],
    enabled: Boolean(reserving && resv.start),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("inventory_availability", {
        _start: resv.start,
        ...(resv.end ? { _end: resv.end } : {}),
      });
      if (error) throw error;
      return (data ?? []).find((a) => a.inventory_id === reserving!.id)?.available ?? 0;
    },
  });

  const saveItem = useMutation({
    mutationFn: async () => {
      const problem = validateItemDraft(form);
      if (problem) throw new Error(problem);
      const common = {
        name: form.name.trim(),
        type: form.type,
        category: form.category.trim() || null,
        alert_threshold: Math.max(0, Number(form.alert_threshold) || 0),
        location: form.location.trim() || null,
        condition: form.condition || null,
        referent_person_id: form.referent_person_id || null,
        unit_price: form.unit_price.trim() ? Number(form.unit_price.replace(",", ".")) : null,
        document_url: form.document_url.trim() || null,
        description: form.description.trim() || null,
        visibility: form.visibility,
      };
      // La quantité d'une référence existante ne change que par un mouvement tracé.
      const { error } =
        editing === "new"
          ? await supabase.from("inventory").insert({ ...common, quantity: Number(form.quantity) })
          : await supabase.from("inventory").update(common).eq("id", (editing as Item).id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing === "new" ? "Référence ajoutée." : "Référence mise à jour.");
      setEditing(null);
      refresh();
    },
    onError: (e: Error) => toast.error(errText(e)),
  });

  const adjust = useMutation({
    mutationFn: async () => {
      const change = movementChange(moving!.kind, move.quantity);
      if (change === null) throw new Error("Indiquez une quantité entière d'au moins 1.");
      const { error } = await supabase.rpc("adjust_inventory_stock", {
        _inventory_id: moving!.item.id,
        _change: change,
        ...(move.reason.trim() ? { _reason: move.reason.trim() } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(moving?.kind === "IN" ? "Entrée enregistrée." : "Sortie enregistrée.");
      setMoving(null);
      refresh();
    },
    onError: (e: Error) => toast.error(errText(e)),
  });

  const reserve = useMutation({
    mutationFn: async () => {
      const draft = {
        projectId: resv.projectId,
        quantity: Number(resv.quantity),
        startDate: resv.start,
        endDate: resv.end || null,
      };
      const problem = validateReservationDraft(draft, periodAvail ?? 0);
      if (problem) throw new Error(problem);
      // La base revérifie sous verrou : deux demandes simultanées ne peuvent pas dépasser le stock.
      const { error } = await supabase.from("inventory_reservations").insert({
        inventory_id: reserving!.id,
        project_id: draft.projectId,
        quantity: draft.quantity,
        start_date: draft.startDate,
        end_date: draft.endDate,
        notes: resv.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Matériel réservé.");
      setReserving(null);
      refresh();
    },
    onError: (e: Error) => toast.error(errText(e)),
  });

  const setResvStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "RETURNED" | "CANCELLED" }) => {
      const { error } = await supabase.from("inventory_reservations").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error(errText(e)),
  });

  const addReason = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.from("inventory_movements").update({ reason }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error(errText(e)),
  });

  const removeItem = useMutation({
    mutationFn: async ({ item, mode }: { item: Item; mode: "retire" | "delete" }) => {
      if (mode === "retire") {
        const reason = prompt(`Sortie définitive de « ${item.name} » (don, perte, casse…). Motif facultatif :`);
        if (reason === null) throw new Error("__cancel");
        const { error } = await supabase.rpc("retire_inventory_item", { _inventory_id: item.id, ...(reason.trim() ? { _reason: reason.trim() } : {}) });
        if (error) throw error;
      } else {
        if (!confirm(`Supprimer définitivement « ${item.name} » ? Possible uniquement s'il n'a jamais servi à un projet.`)) throw new Error("__cancel");
        const { error } = await supabase.rpc("delete_inventory_item", { _inventory_id: item.id });
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      toast.success(v.mode === "retire" ? "Article sorti de l'inventaire, historique conservé." : "Article supprimé.");
      setEditing(null);
      refresh();
    },
    onError: (e: Error) => { if (e.message !== "__cancel") toast.error(errText(e)); },
  });

  const openEdit = (item: Item | "new") => {
    setForm(
      item === "new"
        ? EMPTY_ITEM
        : {
            name: item.name, type: item.type ?? "MATERIEL", category: item.category ?? "", quantity: String(item.quantity),
            alert_threshold: String(item.alert_threshold), location: item.location ?? "", condition: item.condition ?? "",
            referent_person_id: item.referent_person_id ?? "", unit_price: item.unit_price != null ? String(item.unit_price) : "",
            document_url: item.document_url ?? "", description: item.description ?? "", visibility: item.visibility ?? "BUREAU",
          },
    );
    setEditing(item);
  };
  const openReserve = (item: Item) => {
    setResv({ projectId: focusProject && projects.some((p) => p.id === focusProject) ? focusProject : "", quantity: "1", start: today(), end: "", notes: "" });
    setReserving(item);
  };

  const lowStock = items.filter((i) => i.quantity <= i.alert_threshold);
  const filtered = items.filter((i) => {
    const term = search.trim().toLowerCase();
    if (type !== "ALL" && (i.type ?? "NONE") !== type) return false;
    if (alertOnly && i.quantity > i.alert_threshold) return false;
    return !term || `${i.name} ${i.category ?? ""} ${i.location ?? ""} ${i.description ?? ""}`.toLowerCase().includes(term);
  });
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);
  const totalReserved = availability.reduce((s, a) => s + (a.reserved ?? 0), 0);
  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? "Article";
  const shownReservations = focusProject ? reservations.filter((r) => r.project_id === focusProject) : reservations;
  const focusTitle = focusProject ? projects.find((p) => p.id === focusProject)?.title : null;
  const overdue = reservations.filter((r) => r.status === "ACTIVE" && r.end_date && r.end_date < today());

  return (
    <AppShell
      title="Inventaire"
      subtitle="Matériel, équipements, consommables et produits de l'association"
      actions={
        isBureau ? (
          <Button size="sm" className="gap-2" onClick={() => openEdit("new")}>
            <Plus className="size-4" /> Nouvelle référence
          </Button>
        ) : null
      }
    >
      {lowStock.length > 0 ? (
        <div role="status" className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 text-destructive" />
          <p>
            {lowStock.length} référence{lowStock.length > 1 ? "s" : ""} sous le seuil d'alerte : {lowStock.map((i) => i.name).join(", ")}.
          </p>
        </div>
      ) : null}

      {overdue.length > 0 ? (
        <div role="status" className="mb-4 flex items-start gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm">
          <CalendarRange className="mt-0.5 size-4 text-primary" />
          <p>
            {overdue.length} prêt{overdue.length > 1 ? "s" : ""} à restituer (date de fin dépassée) :{" "}
            {overdue.map((r) => itemName(r.inventory_id)).join(", ")}. Marquez-les « rendu » ci-dessous une fois le matériel revenu.
          </p>
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <div className="panel p-3"><p className="text-xs text-muted-foreground">Références</p><p className="text-xl font-semibold">{items.length}</p></div>
        <div className="panel p-3"><p className="text-xs text-muted-foreground">Unités en stock</p><p className="text-xl font-semibold">{totalUnits}</p></div>
        <div className="panel p-3"><p className="text-xs text-muted-foreground">Réservées (en cours et à venir)</p><p className="text-xl font-semibold">{totalReserved}</p></div>
        <div className="panel p-3"><p className="text-xs text-muted-foreground">Sous le seuil</p><p className="text-xl font-semibold">{lowStock.length}</p></div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input placeholder="Rechercher une référence, une catégorie, un emplacement…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" aria-label="Rechercher" />
        <select aria-label="Type" className={`${SELECT} max-w-xs`} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="ALL">Tous les types</option>
          {INVENTORY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          <option value="NONE">Type non précisé</option>
        </select>
        <Button variant={alertOnly ? "destructive" : "outline"} size="sm" className="gap-2" onClick={() => setAlertOnly((v) => !v)} aria-pressed={alertOnly}>
          <AlertTriangle className="size-4" /> Stock bas
        </Button>
      </div>

      {isLoading ? (
        <InlineLoading label="Chargement de l'inventaire…" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{items.length === 0 ? "Aucune référence enregistrée." : "Aucune référence ne correspond à ce filtre."}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const a = availOf.get(item.id);
            const reserved = a?.reserved ?? 0;
            const available = availableQuantity(item.quantity, reserved);
            const referent = personName(item.referent_person_id);
            return (
              <Card key={item.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base"><Package className="size-4 text-primary" /> {item.name}</CardTitle>
                    <span className="flex flex-wrap justify-end gap-1">
                      <Badge variant="secondary">{typeLabel(item.type)}</Badge>
                      {isBureau ? (
                        <Badge variant={item.visibility === "BUREAU" ? "outline" : "default"} title="Qui voit cette fiche">
                          {visibilityLabel(item.visibility)}
                        </Badge>
                      ) : null}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    {[item.category, conditionLabel(item.condition), item.location ?? "Emplacement non précisé"].filter(Boolean).join(" · ")}
                  </p>
                  {item.description ? <p className="line-clamp-2">{item.description}</p> : null}
                  <dl className="grid grid-cols-3 gap-2 rounded-md bg-muted/50 p-2 text-center">
                    <div><dt className="text-xs text-muted-foreground">Stock</dt><dd className="font-semibold">{item.quantity}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Réservé</dt><dd className="font-semibold">{reserved}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Disponible</dt><dd className="font-semibold">{available}</dd></div>
                  </dl>
                  <p className="text-xs text-muted-foreground">
                    Seuil {item.alert_threshold}
                    {isBureau && item.unit_price != null ? ` · ${Number(item.unit_price).toFixed(2)} €` : ""}
                    {referent ? ` · Référent : ${referent}` : ""}
                  </p>
                  {item.document_url ? (
                    <a href={item.document_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <ExternalLink className="size-3" /> Photo ou document
                    </a>
                  ) : null}
                  {item.quantity <= item.alert_threshold ? <Badge variant="destructive">Stock bas</Badge> : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {isBureau ? (
                      <>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => { setMove({ quantity: "1", reason: "" }); setMoving({ item, kind: "IN" }); }}>
                          <ArrowDownToLine className="size-3.5" /> Entrée
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => { setMove({ quantity: "1", reason: "" }); setMoving({ item, kind: "OUT" }); }}>
                          <ArrowUpFromLine className="size-3.5" /> Sortie
                        </Button>
                        <Button size="sm" variant="ghost" className="gap-1" onClick={() => openEdit(item)}>
                          <Pencil className="size-3.5" /> Modifier
                        </Button>
                      </>
                    ) : null}
                    {canReserve ? (
                      <Button size="sm" variant="secondary" className="gap-1" onClick={() => openReserve(item)} disabled={available === 0}>
                        <CalendarRange className="size-3.5" /> Réserver
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {canReserve ? (
        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg">Réservations{focusTitle ? ` — ${focusTitle}` : ""}</h2>
            {focusProject ? <Link to="/inventory" className="text-sm text-primary hover:underline">Voir toutes les réservations</Link> : null}
          </div>
          {shownReservations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune réservation.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {shownReservations.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{r.quantity} × {itemName(r.inventory_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      <Link to="/projects/$projectId" params={{ projectId: r.project_id }} className="hover:underline">
                        {(r.projects as { title?: string } | null)?.title ?? "Projet"}
                      </Link>{" "}
                      · du {fmtDate(r.start_date)} au {fmtDate(r.end_date)}
                      {r.notes ? ` · ${r.notes}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.status === "ACTIVE" ? "default" : "outline"}>{RESERVATION_STATUS_LABEL[r.status] ?? r.status}</Badge>
                    {r.status === "ACTIVE" ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setResvStatus.mutate({ id: r.id, status: "RETURNED" })}>Marquer rendu</Button>
                        <Button size="sm" variant="ghost" onClick={() => setResvStatus.mutate({ id: r.id, status: "CANCELLED" })}>Annuler</Button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {isBureau ? (
        <section className="mt-8">
          <h2 className="mb-3 text-lg">Derniers mouvements de stock</h2>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun mouvement enregistré.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {movements.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span>
                    <span className={m.quantity_change > 0 ? "font-semibold text-primary" : "font-semibold"}>
                      {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                    </span>{" "}
                    {itemName(m.inventory_id)} · {new Date(m.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  {m.reason ? (
                    <span className="text-xs text-muted-foreground">{m.reason}</span>
                  ) : (
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => {
                      const reason = prompt("Motif du mouvement (facultatif)")?.trim();
                      if (reason) addReason.mutate({ id: m.id, reason: reason.slice(0, 500) });
                    }}>
                      Ajouter un motif
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* Création / édition */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Nouvelle référence" : "Modifier la référence"}</DialogTitle>
            <DialogDescription>Seuls la désignation, le type et la quantité sont nécessaires. Le reste peut être complété plus tard.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label htmlFor="inv-name">Désignation</Label><Input id="inv-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label htmlFor="inv-type">Type</Label>
              <select id="inv-type" className={SELECT} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {INVENTORY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select></div>
            <div className="sm:col-span-2"><Label htmlFor="inv-vis">Qui voit cette fiche ?</Label>
              <select id="inv-vis" className={SELECT} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
                {INVENTORY_VISIBILITY.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select></div>
            <div><Label htmlFor="inv-qty">Quantité</Label>
              <Input id="inv-qty" type="number" min="0" value={form.quantity} disabled={editing !== "new"} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              {editing !== "new" ? <p className="mt-1 text-xs text-muted-foreground">Modifiez le stock par une entrée ou une sortie.</p> : null}</div>
            <div><Label htmlFor="inv-cat">Catégorie précise (facultatif)</Label><Input id="inv-cat" placeholder="ex. agility, pharmacie…" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div><Label htmlFor="inv-cond">État (facultatif)</Label>
              <select id="inv-cond" className={SELECT} value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                <option value="">Non précisé</option>
                {INVENTORY_CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select></div>
            <div><Label htmlFor="inv-loc">Emplacement (facultatif)</Label><Input id="inv-loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><Label htmlFor="inv-ref">Référent ou dépositaire (facultatif)</Label>
              <select id="inv-ref" className={SELECT} value={form.referent_person_id} onChange={(e) => setForm({ ...form, referent_person_id: e.target.value })}>
                <option value="">Aucun</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.display_name || [p.first_name, p.last_name].filter(Boolean).join(" ")}</option>)}
              </select></div>
            <div><Label htmlFor="inv-alert">Seuil d'alerte (facultatif)</Label><Input id="inv-alert" type="number" min="0" value={form.alert_threshold} onChange={(e) => setForm({ ...form, alert_threshold: e.target.value })} /></div>
            <div><Label htmlFor="inv-price">Prix d'achat ou de vente € (facultatif)</Label><Input id="inv-price" inputMode="decimal" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label htmlFor="inv-doc">Lien photo ou document (facultatif)</Label><Input id="inv-doc" placeholder="https://drive.google.com/…" value={form.document_url} onChange={(e) => setForm({ ...form, document_url: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label htmlFor="inv-desc">Description (facultatif)</Label><Textarea id="inv-desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            {editing && editing !== "new" ? (
              <div className="mr-auto flex flex-wrap gap-2">
                <Button variant="outline" disabled={removeItem.isPending} onClick={() => removeItem.mutate({ item: editing, mode: "retire" })}>Sortie définitive</Button>
                <Button variant="ghost" className="text-destructive" disabled={removeItem.isPending} onClick={() => removeItem.mutate({ item: editing, mode: "delete" })}>Supprimer</Button>
              </div>
            ) : null}
            <Button onClick={() => saveItem.mutate()} disabled={saveItem.isPending}>{editing === "new" ? "Ajouter" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entrée / sortie */}
      <Dialog open={moving !== null} onOpenChange={(o) => !o && setMoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{moving?.kind === "IN" ? "Entrée de stock" : "Sortie de stock"} — {moving?.item.name}</DialogTitle>
            <DialogDescription>La date est enregistrée automatiquement. Une sortie ne peut pas entamer le matériel réservé pour un projet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label htmlFor="mv-q">Quantité</Label><Input id="mv-q" type="number" min="1" value={move.quantity} onChange={(e) => setMove({ ...move, quantity: e.target.value })} /></div>
            <div><Label htmlFor="mv-r">Motif (facultatif)</Label><Input id="mv-r" maxLength={500} value={move.reason} onChange={(e) => setMove({ ...move, reason: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => adjust.mutate()} disabled={adjust.isPending}>Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Réservation */}
      <Dialog open={reserving !== null} onOpenChange={(o) => !o && setReserving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réserver — {reserving?.name}</DialogTitle>
            <DialogDescription>
              Disponible sur la période : <strong>{periodAvail ?? "…"}</strong>. La disponibilité est revérifiée au moment de l'enregistrement.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label htmlFor="rs-p">Projet</Label>
              <select id="rs-p" className={SELECT} value={resv.projectId} onChange={(e) => setResv({ ...resv, projectId: e.target.value })}>
                <option value="">Choisir…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select></div>
            <div><Label htmlFor="rs-q">Quantité</Label><Input id="rs-q" type="number" min="1" value={resv.quantity} onChange={(e) => setResv({ ...resv, quantity: e.target.value })} /></div>
            <div />
            <div><Label htmlFor="rs-s">Du</Label><Input id="rs-s" type="date" value={resv.start} onChange={(e) => setResv({ ...resv, start: e.target.value })} /></div>
            <div><Label htmlFor="rs-e">Au (facultatif)</Label><Input id="rs-e" type="date" value={resv.end} min={resv.start} onChange={(e) => setResv({ ...resv, end: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label htmlFor="rs-n">Note (facultatif)</Label><Input id="rs-n" maxLength={1000} value={resv.notes} onChange={(e) => setResv({ ...resv, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => reserve.mutate()} disabled={reserve.isPending || periodAvail === undefined}>Réserver</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
