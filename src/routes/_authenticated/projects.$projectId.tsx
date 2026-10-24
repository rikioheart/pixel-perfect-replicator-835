import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLinks } from "@/components/ExternalLinks";
import { PlaceInfo } from "@/components/PlaceInfo";
import { LinkedMairies } from "@/components/LinkedMairies";
import { AiAssist } from "@/components/AiAssist";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { TaskCard, type TaskRow } from "@/components/TaskCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRIORITIES,
  PRIORITY_LABEL,
  PROJECT_ROLE_LABEL,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  formatDate,
} from "@/lib/domain";
import { Comments } from "@/components/Comments";
import { ProjectContribute, ProjectStorySections } from "@/components/ProjectContribute";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { EntityPeek } from "@/components/EntityPeek";
import { isPast, operationalProgress } from "@/lib/archives";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  head: () => ({
    meta: [
      { title: "Détail du projet — La Voix du Chien" },
      {
        name: "description",
        content:
          "Fiche projet : objectif, équipe, avancement et tâches à réaliser pour l'association.",
      },
      { property: "og:title", content: "Détail du projet — La Voix du Chien" },
      {
        property: "og:description",
        content: "Pilotez un projet associatif : équipe, tâches, preuves et avancement.",
      },
    ],
  }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const { user, isBureau, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () =>
      (
        await supabase
          .from("projects")
          .select("*, project_categories(name)")
          .eq("id", projectId)
          .maybeSingle()
      ).data,
  });

  const { data: members } = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: async (): Promise<MemberRow[]> => {
      const rows =
        (
          await supabase
            .from("project_members")
            .select("id, project_role, user_id")
            .eq("project_id", projectId)
        ).data ?? [];
      if (rows.length === 0) return [];
      const profiles =
        (
          await supabase
            .from("profiles")
            .select("id, display_name, first_name, last_name")
            .in(
              "id",
              rows.map((row) => row.user_id),
            )
        ).data ?? [];
      return rows.map((row) => ({
        ...row,
        profiles: profiles.find((profile) => profile.id === row.user_id) ?? null,
      }));
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["project-tasks", projectId],
    queryFn: async () =>
      ((
        await supabase
          .from("tasks")
          .select(
            "id, title, description, status, priority, deadline, assigned_user_id, rejection_reason",
          )
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
      ).data ?? []) as TaskRow[],
  });

  const { data: related } = useQuery({
    queryKey: ["project-related", projectId, project?.parent_project_id ?? null],
    enabled: !!project,
    queryFn: async () => {
      const [acts, evts, children, siblings] = await Promise.all([
        supabase.from("activities").select("id, title, date, status").eq("project_id", projectId).order("date", { ascending: false }),
        supabase.from("events").select("id, title, start_date, end_date, status").eq("project_id", projectId).order("start_date", { ascending: false }),
        supabase.from("projects").select("id, title, status, start_date").eq("parent_project_id", projectId).order("start_date", { ascending: false }),
        project?.parent_project_id
          ? supabase.from("projects").select("id, title, status, start_date").eq("parent_project_id", project.parent_project_id).neq("id", projectId).order("start_date", { ascending: false })
          : Promise.resolve({ data: [] as { id: string; title: string; status: string; start_date: string | null }[] }),
      ]);
      return {
        activities: acts.data ?? [],
        events: evts.data ?? [],
        editions: [...(children.data ?? []), ...(siblings.data ?? [])],
      };
    },
  });

  if (!project) {
    return (
      <AppShell title="Projet" subtitle="Chargement…">
        <p className="text-sm text-muted-foreground">Projet introuvable ou accès restreint.</p>
      </AppShell>
    );
  }

  const updateProject = async (patch: Record<string, string | number | null>) => {
    const { error } = await supabase.from("projects").update(patch as never).eq("id", projectId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["project", projectId] });
  };

  return (
    <AppShell
      title={project.title}
      subtitle={project.project_categories?.name ?? "Projet associatif"}
      actions={
        <>
          <AiAssist type="project" id={projectId} actions={["SUMMARY", "INCONSISTENCIES", "MINUTES"]} />
          <ShareLinkButton entityType="project" entityId={projectId} defaultLabel={project.title} />
          {isBureau || profile?.membership_status === "ACTIVE" ? (
            <NewTaskDialog
              projectId={projectId}
              members={members ?? []}
              userId={user?.id ?? ""}
              onCreated={() =>
                queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] })
              }
            />
          ) : null}
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="panel space-y-4 p-5 lg:col-span-2">
          <p className="text-sm text-muted-foreground">
            {project.description || "Aucun objectif renseigné."}
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">
              {PROJECT_STATUS_LABEL[project.status] ?? project.status}
            </Badge>
            <Badge variant="secondary">
              {PRIORITY_LABEL[project.priority] ?? project.priority}
            </Badge>
            <Badge variant="outline">Échéance {formatDate(project.deadline)}</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Avancement opérationnel</span>
                <span>{progress === null ? "—" : `${progress}%`}</span>
              </div>
              <Progress value={progress ?? 0} aria-label="Avancement opérationnel" />
              <p className="mt-1 text-xs text-muted-foreground">
                {progress === null
                  ? "Calculé automatiquement dès qu'une tâche existe."
                  : `Calculé à partir des tâches validées (${doneCount} sur ${eligibleCount}, annulées exclues).`}
              </p>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Estimation du coordinateur</span>
                <span>{project.progress_percent ?? 0}%</span>
              </div>
              <Progress value={project.progress_percent ?? 0} aria-label="Estimation du coordinateur" />
              <p className="mt-1 text-xs text-muted-foreground">Valeur déclarée, conservée à part du calcul.</p>
            </div>
          </div>
          {related && (related.activities.length > 0 || related.events.length > 0 || related.editions.length > 0) ? (
            <div className="space-y-3 border-t border-border pt-4 text-sm">
              {related.activities.length + related.events.length > 0 ? (
                <div>
                  <h3 className="mb-1 font-medium">Activités et événements rattachés</h3>
                  <ul className="space-y-1">
                    {related.activities.map((a) => (
                      <li key={a.id}>
                        <Link to="/activities/$activityId" params={{ activityId: a.id }} className="hover:underline">{a.title}</Link>
                        <span className="text-muted-foreground"> · activité · {formatDate(a.date)}{isPast(a) ? " · terminée" : ""}</span>
                      </li>
                    ))}
                    {related.events.map((e) => (
                      <li key={e.id}>
                        <Link to="/events/$eventId" params={{ eventId: e.id }} className="hover:underline">{e.title}</Link>
                        <span className="text-muted-foreground"> · événement · {formatDate(e.start_date)}{isPast(e) ? " · passé" : ""}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {related.editions.length > 0 ? (
                <details>
                  <summary className="cursor-pointer font-medium">Éditions précédentes et associées ({related.editions.length})</summary>
                  <ul className="mt-2 space-y-1">
                    {related.editions.map((ed) => (
                      <li key={ed.id}>
                        <Link to="/projects/$projectId" params={{ projectId: ed.id }} className="hover:underline">{ed.title}</Link>
                        <span className="text-muted-foreground"> · {PROJECT_STATUS_LABEL[ed.status] ?? ed.status}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}

          {canManage ? (
            <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
              <div className="space-y-1">
                <Label className="text-xs">Statut</Label>
                <Select value={project.status} onValueChange={changeStatus}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {PROJECT_STATUS_LABEL[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="progress">
                  Estimation (%)
                </Label>
                <Input
                  id="progress"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={project.progress_percent ?? 0}
                  className="w-28"
                  onBlur={(e) =>
                    updateProject({
                      progress_percent: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                    })
                  }
                />
              </div>
            </div>
          ) : null}
          <AlertDialog open={closing !== null} onOpenChange={(o) => !o && setClosing(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Des tâches ne sont pas terminées</AlertDialogTitle>
                <AlertDialogDescription>
                  {openTasks.length === 1
                    ? "Une tâche est encore ouverte."
                    : `${openTasks.length} tâches sont encore ouvertes.`}{" "}
                  Vous pouvez quand même changer le statut du projet : elles resteront visibles et modifiables.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                {openTasks.map((t) => (
                  <li key={t.id} className="flex justify-between gap-2">
                    <span className="truncate">{t.title}</span>
                    <span className="shrink-0 text-muted-foreground">{TASK_STATUS_LABEL[t.status] ?? t.status}</span>
                  </li>
                ))}
              </ul>
              <AlertDialogFooter>
                <AlertDialogCancel>Revenir au projet</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (closing) void updateProject({ status: closing });
                    setClosing(null);
                  }}
                >
                  Confirmer quand même
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {isBureau ? (
            <details className="border-t border-border pt-4">
              <summary className="cursor-pointer text-sm font-medium">Modifier la présentation du projet</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {([
                  ["why", "Pourquoi ce projet existe"],
                  ["for_whom", "Pour qui"],
                  ["objective", "Objectif"],
                  ["done_steps", "Étapes réalisées"],
                  ["next_steps", "Prochaines étapes"],
                  ["current_needs", "Besoins actuels"],
                  ["how_to_contribute", "Comment contribuer"],
                ] as const).map(([k, l]) => (
                  <div key={k}>
                    <Label htmlFor={`pj-${k}`} className="text-xs">{l}</Label>
                    <Textarea id={`pj-${k}`} rows={2} defaultValue={project[k] ?? ""} onBlur={(e) => { if (e.target.value !== (project[k] ?? "")) updateProject({ [k]: e.target.value.trim() || null }); }} />
                  </div>
                ))}
                <div>
                  <Label htmlFor="pj-address" className="text-xs">Lieu ou adresse (facultatif)</Label>
                  <Input id="pj-address" defaultValue={project.address ?? ""} onBlur={(e) => { if (e.target.value !== (project.address ?? "")) updateProject({ address: e.target.value.trim() || null }); }} />
                </div>
                <div>
                  <Label htmlFor="pj-email" className="text-xs">E-mail de contact (facultatif)</Label>
                  <Input id="pj-email" type="email" placeholder="ex. référent ou association" defaultValue={project.contact_email ?? ""} onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { toast.error("E-mail invalide"); return; }
                    if (v !== (project.contact_email ?? "")) updateProject({ contact_email: v || null });
                  }} />
                </div>
              </div>
            </details>
          ) : null}
        </div>

        <div className="panel p-5">
          <h2 className="mb-4 text-lg">Équipe</h2>
          {(members ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun membre affecté.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {members?.map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-2">
                  <EntityPeek type="person" id={member.user_id}>
                    <span className="truncate">
                      {member.profiles?.display_name ||
                        `${member.profiles?.first_name ?? ""} ${member.profiles?.last_name ?? ""}`.trim() ||
                        "Membre"}
                    </span>
                  </EntityPeek>
                  <Badge variant="secondary">
                    {PROJECT_ROLE_LABEL[member.project_role] ?? member.project_role}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <ProjectStorySections project={project} />
        <ProjectContribute projectId={projectId} />
      </div>

      <div className="mt-6">
        <h2 className="mb-4 text-lg">Actions du projet</h2>
        {(tasks ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune tâche créée pour ce projet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {tasks?.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                currentUserId={user?.id ?? ""}
                isBureau={isBureau}
                showProject={false}
                onChanged={() =>
                  queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] })
                }
              />
            ))}
          </div>
        )}
      </div>

      {project.address || project.contact_email ? (
        <div className="panel mt-6 space-y-3 p-4 text-sm">
          <PlaceInfo address={project.address} />
          {project.contact_email ? <p>Contact : <a className="underline" href={`mailto:${project.contact_email}`}>{project.contact_email}</a></p> : null}
        </div>
      ) : null}
      <div className="panel mt-6 p-4"><LinkedMairies type="project" id={projectId} /></div>
      <div className="mt-6"><ExternalLinks contextType="PROJECT" contextId={projectId} /></div>
      <div className="mt-6">
        <Comments
          entityType="project"
          entityId={projectId}
          entityTitle={project.title}
          participants={(members ?? []).map((member) => member.user_id)}
          linkUrl={`/projects/${projectId}`}
        />
      </div>
    </AppShell>
  );
}

type MemberRow = {
  id: string;
  project_role: string;
  user_id: string;
  profiles: { display_name: string | null; first_name: string | null; last_name: string | null } | null;
};

function NewTaskDialog({
  projectId,
  members,
  userId,
  onCreated,
}: {
  projectId: string;
  members: MemberRow[];
  userId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "NORMAL",
    deadline: "",
    assigned_user_id: "",
  });

  const submit = async () => {
    if (!form.title.trim()) {
      toast.error("Le titre est obligatoire.");
      return;
    }
    const { error } = await supabase.from("tasks").insert({
      project_id: projectId,
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      deadline: form.deadline || null,
      assigned_user_id: form.assigned_user_id || null,
      created_by: userId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Tâche créée.");
    setOpen(false);
    setForm({ title: "", description: "", priority: "NORMAL", deadline: "", assigned_user_id: "" });
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nouvelle tâche</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle tâche</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Titre</Label>
            <Input
              id="task-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Priorité</Label>
              <Select
                value={form.priority}
                onValueChange={(value) => setForm({ ...form, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {PRIORITY_LABEL[priority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-deadline">Échéance</Label>
              <Input
                id="task-deadline"
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </div>
          </div>
          {members.length > 0 ? (
            <div className="space-y-2">
              <Label>Assignée à</Label>
              <Select
                value={form.assigned_user_id}
                onValueChange={(value) => setForm({ ...form, assigned_user_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un membre" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.profiles?.display_name ||
                        `${member.profiles?.first_name ?? ""} ${member.profiles?.last_name ?? ""}`.trim() ||
                        "Membre"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={submit}>Créer la tâche</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
