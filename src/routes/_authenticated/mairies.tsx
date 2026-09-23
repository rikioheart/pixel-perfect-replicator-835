import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Mail, Phone, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BureauOnly } from "@/components/BureauOnly";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SidePanel } from "@/components/SidePanel";
import { LoadingState } from "@/components/LoadingState";

export const Route = createFileRoute("/_authenticated/mairies")({
  head: () => ({
    meta: [
      { title: "Mairies & institutions — La Voix du Chien" },
      {
        name: "description",
        content:
          "Suivi des contacts institutionnels de l'association : mairies, collectivités, statut des démarches et notes.",
      },
      { property: "og:title", content: "Mairies & institutions — La Voix du Chien" },
      {
        property: "og:description",
        content: "Contacts mairies et collectivités, statut des démarches en cours.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MairiesPage,
});

const STATUSES = [
  { code: "TO_CONTACT", label: "À contacter" },
  { code: "CONTACTED", label: "Contactée" },
  { code: "IN_PROGRESS", label: "Échange en cours" },
  { code: "PARTNER", label: "Partenaire" },
  { code: "REFUSED", label: "Sans suite" },
];

const EMPTY = {
  organization: "",
  city: "",
  contact_person: "",
  email: "",
  phone: "",
  status: "TO_CONTACT",
  notes: "",
};

function MairiesPage() {
  const { isBureau, loading } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["mairies"],
    enabled: isBureau,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mairies")
        .select("*")
        .order("organization", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (form.organization.trim().length < 2) throw new Error("Le nom de l'organisme est obligatoire.");
      const payload = {
        organization: form.organization.trim(),
        city: form.city || null,
        contact_person: form.contact_person || null,
        email: form.email || null,
        phone: form.phone || null,
        status: form.status,
        notes: form.notes || null,
      };
      const { error } = editingId
        ? await supabase.from("mairies").update(payload).eq("id", editingId)
        : await supabase.from("mairies").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editingId ? "Contact mis à jour." : "Contact ajouté.");
      setOpen(false);
      setEditingId(null);
      setForm(EMPTY);
      void queryClient.invalidateQueries({ queryKey: ["mairies"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mairies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contact supprimé.");
      void queryClient.invalidateQueries({ queryKey: ["mairies"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!loading && !isBureau) return <BureauOnly title="Mairies & institutions" />;

  const filtered = rows.filter((row) => statusFilter === "ALL" || row.status === statusFilter);
  const labelOf = (code: string) => STATUSES.find((s) => s.code === code)?.label ?? code;

  return (
    <AppShell
      title="Mairies & institutions"
      subtitle="Suivi des démarches auprès des collectivités"
      actions={
        <Button
          size="sm"
          className="gap-2"
          onClick={() => {
            setEditingId(null);
            setForm(EMPTY);
            setOpen(true);
          }}
        >
          <Plus className="size-4" /> Nouveau contact
        </Button>
      }
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {[{ code: "ALL", label: "Tous" }, ...STATUSES].map((status) => (
          <Button
            key={status.code}
            variant={statusFilter === status.code ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(status.code)}
          >
            {status.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <LoadingState label="Chargement des informations…" rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Aucun contact institutionnel"
          message="Ajoutez les mairies et collectivités avec lesquelles l'association échange."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((row) => (
            <article key={row.id} className="panel space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-2 font-medium">
                  <Building2 className="size-4 text-primary" /> {row.organization}
                </p>
                <Badge variant="outline">{labelOf(row.status)}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{row.city ?? "Ville non précisée"}</p>
              {row.contact_person ? <p className="text-sm">{row.contact_person}</p> : null}
              {row.email ? (
                <p className="flex items-center gap-2 text-sm">
                  <Mail className="size-3.5 text-muted-foreground" />
                  <a className="underline" href={`mailto:${row.email}`}>
                    {row.email}
                  </a>
                </p>
              ) : null}
              {row.phone ? (
                <p className="flex items-center gap-2 text-sm">
                  <Phone className="size-3.5 text-muted-foreground" /> {row.phone}
                </p>
              ) : null}
              {row.notes ? (
                <p className="text-sm text-muted-foreground">{row.notes}</p>
              ) : null}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingId(row.id);
                    setForm({
                      organization: row.organization,
                      city: row.city ?? "",
                      contact_person: row.contact_person ?? "",
                      email: row.email ?? "",
                      phone: row.phone ?? "",
                      status: row.status,
                      notes: row.notes ?? "",
                    });
                    setOpen(true);
                  }}
                >
                  Modifier
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Supprimer le contact"
                  className="size-9"
                  onClick={() => remove.mutate(row.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <SidePanel
        open={open}
        onOpenChange={setOpen}
        title={editingId ? "Modifier le contact" : "Nouveau contact"}
        description="Mairie, communauté de communes, service municipal…"
        footer={
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Enregistrer
          </Button>
        }
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="m-org">Organisme</Label>
            <Input
              id="m-org"
              value={form.organization}
              onChange={(e) => setForm({ ...form, organization: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="m-city">Ville</Label>
              <Input
                id="m-city"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="m-status">Statut</Label>
              <select
                id="m-status"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {STATUSES.map((status) => (
                  <option key={status.code} value={status.code}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="m-person">Interlocuteur</Label>
            <Input
              id="m-person"
              value={form.contact_person}
              onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="m-mail">E-mail</Label>
              <Input
                id="m-mail"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="m-phone">Téléphone</Label>
              <Input
                id="m-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="m-notes">Notes</Label>
            <Textarea
              id="m-notes"
              rows={4}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
      </SidePanel>
    </AppShell>
  );
}
