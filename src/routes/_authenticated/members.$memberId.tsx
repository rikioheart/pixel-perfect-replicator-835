import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, PROJECT_ROLE_LABEL, TASK_STATUS_LABEL } from "@/lib/domain";
import {
  MEMBERSHIP_STATUS_LABEL,
  MEMBERSHIP_TYPE_LABEL,
  MEMBER_FUNCTION_LABEL,
  memberFullName,
} from "@/lib/members";

export const Route = createFileRoute("/_authenticated/members/$memberId")({
  head: () => ({
    meta: [
      { title: "Fiche adhérent — La Voix du Chien" },
      {
        name: "description",
        content:
          "Fiche détaillée d'un adhérent : coordonnées, statut d'adhésion, fonctions associatives, projets et tâches.",
      },
      { property: "og:title", content: "Fiche adhérent — La Voix du Chien" },
      {
        property: "og:description",
        content: "Coordonnées, engagement et historique d'un membre de La Voix du Chien.",
      },
    ],
  }),
  component: MemberDetailPage,
});

function MemberDetailPage() {
  const { memberId } = Route.useParams();
  const { isBureau } = useAuth();
  const queryClient = useQueryClient();

  const { data: member, isLoading } = useQuery({
    queryKey: ["member", memberId],
    queryFn: async () =>
      (await supabase.from("profiles").select("*").eq("id", memberId).maybeSingle()).data,
  });

  const { data: functions } = useQuery({
    queryKey: ["member-functions", memberId],
    queryFn: async () =>
      (
        await supabase
          .from("member_functions")
          .select("*")
          .eq("user_id", memberId)
          .order("start_date", { ascending: false })
      ).data ?? [],
  });

  const { data: memberships } = useQuery({
    queryKey: ["member-projects", memberId],
    queryFn: async () =>
      (
        await supabase
          .from("project_members")
          .select("id, project_role, participation_status, projects(id, title, status)")
          .eq("user_id", memberId)
      ).data ?? [],
  });

  const { data: tasks } = useQuery({
    queryKey: ["member-tasks", memberId],
    queryFn: async () =>
      (
        await supabase
          .from("tasks")
          .select("id, title, status, deadline")
          .eq("assigned_user_id", memberId)
          .order("created_at", { ascending: false })
          .limit(20)
      ).data ?? [],
  });

  if (isLoading) {
    return (
      <AppShell title="Fiche adhérent">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </AppShell>
    );
  }

  if (!member) {
    return (
      <AppShell title="Fiche adhérent">
        <p className="text-sm text-muted-foreground">Adhérent introuvable ou non visible.</p>
        <Button asChild variant="ghost" size="sm" className="mt-4 gap-2">
          <Link to="/members">
            <ArrowLeft className="size-4" /> Retour à la liste
          </Link>
        </Button>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={memberFullName(member)}
      subtitle={`${MEMBERSHIP_TYPE_LABEL[member.membership_type] ?? member.membership_type} · ${
        MEMBERSHIP_STATUS_LABEL[member.membership_status] ?? member.membership_status
      }`}
      actions={
        <Button asChild variant="ghost" size="sm" className="gap-2">
          <Link to="/members">
            <ArrowLeft className="size-4" /> Adhérents
          </Link>
        </Button>
      }
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="panel space-y-3 p-5 lg:col-span-1">
          <h2 className="text-lg">Coordonnées</h2>
          <InfoRow label="E-mail" value={member.email} />
          <InfoRow label="Téléphone" value={member.phone} />
          <InfoRow label="Ville" value={member.city} />
          <InfoRow label="Département" value={member.department} />
          <InfoRow label="Adhésion depuis" value={formatDate(member.membership_date ?? member.created_at)} />
          <InfoRow label="Niveau d'implication" value={member.involvement_level} />
          <InfoRow
            label="Visibilité annuaire"
            value={member.public_visibility ? "Publique" : "Privée"}
          />
          {member.bio ? (
            <div className="pt-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Présentation</p>
              <p className="mt-1 text-sm leading-relaxed">{member.bio}</p>
            </div>
          ) : null}
        </div>

        <div className="space-y-5 lg:col-span-2">
          {isBureau ? (
            <BureauEditor
              member={member}
              onSaved={() => {
                void queryClient.invalidateQueries({ queryKey: ["member", memberId] });
                void queryClient.invalidateQueries({ queryKey: ["members"] });
              }}
            />
          ) : null}

          <section className="panel p-5">
            <h2 className="mb-3 text-lg">Fonctions associatives</h2>
            {(functions ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune fonction enregistrée.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(functions ?? []).map((fn) => (
                  <li key={fn.id} className="flex items-center justify-between gap-3">
                    <span>
                      {MEMBER_FUNCTION_LABEL[fn.function_type] ?? fn.function_type}
                      <span className="text-muted-foreground">
                        {" "}
                        — depuis {formatDate(fn.start_date)}
                      </span>
                    </span>
                    <Badge variant={fn.active ? "default" : "secondary"}>
                      {fn.active ? "Active" : "Terminée"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel p-5">
            <h2 className="mb-3 text-lg">Projets</h2>
            {(memberships ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune participation à un projet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(memberships ?? []).map((row) => {
                  const project = row.projects as { id: string; title: string } | null;
                  return (
                    <li key={row.id} className="flex items-center justify-between gap-3">
                      {project ? (
                        <Link
                          to="/projects/$projectId"
                          params={{ projectId: project.id }}
                          className="underline-offset-2 hover:underline"
                        >
                          {project.title}
                        </Link>
                      ) : (
                        <span>Projet</span>
                      )}
                      <Badge variant="secondary">
                        {PROJECT_ROLE_LABEL[row.project_role] ?? row.project_role}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="panel p-5">
            <h2 className="mb-3 text-lg">Tâches assignées</h2>
            {(tasks ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune tâche assignée.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(tasks ?? []).map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-3">
                    <span>{task.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {TASK_STATUS_LABEL[task.status] ?? task.status} · {formatDate(task.deadline)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right">{value || "—"}</span>
    </div>
  );
}

type MemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  phone: string | null;
  city: string | null;
  department: string | null;
  bio: string | null;
  membership_type: string;
  membership_status: string;
};

function BureauEditor({ member, onSaved }: { member: MemberRow; onSaved: () => void }) {
  const [form, setForm] = useState({
    first_name: member.first_name ?? "",
    last_name: member.last_name ?? "",
    phone: member.phone ?? "",
    city: member.city ?? "",
    department: member.department ?? "",
    bio: member.bio ?? "",
    membership_type: member.membership_type,
    membership_status: member.membership_status,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({
      first_name: member.first_name ?? "",
      last_name: member.last_name ?? "",
      phone: member.phone ?? "",
      city: member.city ?? "",
      department: member.department ?? "",
      bio: member.bio ?? "",
      membership_type: member.membership_type,
      membership_status: member.membership_status,
    });
  }, [member]);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        display_name: `${form.first_name} ${form.last_name}`.trim() || null,
        phone: form.phone || null,
        city: form.city || null,
        department: form.department || null,
        bio: form.bio || null,
        membership_type: form.membership_type,
        membership_status: form.membership_status,
      })
      .eq("id", member.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Fiche adhérent mise à jour.");
      onSaved();
    }
  };

  return (
    <section className="panel space-y-4 p-5">
      <h2 className="text-lg">Édition Bureau</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="first_name">Prénom</Label>
          <Input
            id="first_name"
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Nom</Label>
          <Input
            id="last_name"
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Téléphone</Label>
          <Input
            id="phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Ville</Label>
          <Input
            id="city"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="department">Département</Label>
          <Input
            id="department"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Type d'adhésion</Label>
          <Select
            value={form.membership_type}
            onValueChange={(value) => setForm({ ...form, membership_type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(MEMBERSHIP_TYPE_LABEL).map(([code, label]) => (
                <SelectItem key={code} value={code}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Statut</Label>
          <Select
            value={form.membership_status}
            onValueChange={(value) => setForm({ ...form, membership_status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(MEMBERSHIP_STATUS_LABEL).map(([code, label]) => (
                <SelectItem key={code} value={code}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="bio">Présentation</Label>
        <Textarea
          id="bio"
          rows={3}
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />
      </div>
      <Button onClick={save} disabled={busy}>
        {busy ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </section>
  );
}
