import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, HeartHandshake, ImagePlus, Lock, Trash2, UserRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MEMBERSHIP_TYPE_LABEL } from "@/lib/members";
import { AccountDeletionCard } from "@/components/AccountDeletionCard";
import { SidePanel } from "@/components/SidePanel";
import { SkillsEditor } from "@/components/SkillsEditor";
import { UserAvatar } from "@/components/UserAvatar";
import { MemberSummary } from "@/components/MemberSummary";
import { InlineLoading } from "@/components/LoadingState";
import { humanizeError } from "@/lib/user-messages";
import {
  AVAILABILITY_OPTIONS,
  BIO_MAX,
  COLLABORATION_MODES,
  CONTRIBUTION_PREFERENCES,
  fetchDirectoryProfiles,
  normalizeSkills,
  VISIBILITY_LABEL,
  type FieldVisibility,
} from "@/lib/profile-details";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Mon profil — La Voix du Chien" },
      {
        name: "description",
        content: "Présentez-vous à votre rythme et choisissez, information par information, ce que voient les autres membres.",
      },
      { property: "og:title", content: "Mon profil — La Voix du Chien" },
      {
        property: "og:description",
        content: "Votre profil d'adhérent : présentation, compétences, envies d'aider et confidentialité.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

type FormState = {
  first_name: string;
  last_name: string;
  display_name: string;
  phone: string;
  city: string;
  department: string;
  bio: string;
  skills: string[];
  availability: string[];
  collaboration_modes: string[];
  contribution_types: string[];
  bio_visibility: FieldVisibility;
  location_visibility: FieldVisibility;
  skills_visibility: FieldVisibility;
  availability_visibility: FieldVisibility;
  public_visibility: boolean;
};

const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_MAX = 2 * 1024 * 1024;

function ProfilePage() {
  const { user, profile, refresh } = useAuth();
  const qc = useQueryClient();
  const initial = useMemo<FormState | null>(() => {
    if (!profile) return null;
    return {
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
      display_name: profile.display_name ?? "",
      phone: (profile as { phone?: string | null }).phone ?? "",
      city: profile.city ?? "",
      department: profile.department ?? "",
      bio: profile.bio ?? "",
      skills: profile.skills ?? [],
      availability: profile.availability ?? [],
      collaboration_modes: profile.collaboration_modes ?? [],
      contribution_types: profile.contribution_types ?? [],
      bio_visibility: profile.bio_visibility ?? "PRIVATE",
      location_visibility: profile.location_visibility ?? "PRIVATE",
      skills_visibility: profile.skills_visibility ?? "PRIVATE",
      availability_visibility: profile.availability_visibility ?? "PRIVATE",
      public_visibility: profile.public_visibility,
    };
  }, [profile]);
  const [form, setForm] = useState<FormState | null>(null);
  useEffect(() => setForm(initial), [initial]);
  const dirty = Boolean(form && initial && JSON.stringify(form) !== JSON.stringify(initial));
  const [previewOpen, setPreviewOpen] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      if (!user || !form) throw new Error("Connexion requise.");
      if (form.first_name.trim().length < 2) throw new Error("Le prénom est obligatoire.");
      if (form.phone && !/^[0-9+\s.-]{6,20}$/.test(form.phone)) throw new Error("Ce numéro de téléphone ne semble pas valide.");
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim() || null,
          display_name: form.display_name.trim() || null,
          phone: form.phone.trim() || null,
          city: form.city.trim() || null,
          department: form.department.trim() || null,
          bio: form.bio.trim().slice(0, BIO_MAX) || null,
          skills: normalizeSkills(form.skills),
          availability: form.availability,
          collaboration_modes: form.collaboration_modes,
          contribution_types: form.contribution_types,
          bio_visibility: form.bio_visibility,
          location_visibility: form.location_visibility,
          skills_visibility: form.skills_visibility,
          availability_visibility: form.availability_visibility,
          public_visibility: form.public_visibility,
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("C'est enregistré.");
      await refresh();
      void qc.invalidateQueries({ queryKey: ["my-skills"] });
      void qc.invalidateQueries({ queryKey: ["directory"] });
      void qc.invalidateQueries({ queryKey: ["profile-preview"] });
    },
    onError: (error: Error) => toast.error(humanizeError(error)),
  });

  if (!form || !profile) {
    return (
      <AppShell title="Mon profil">
        <InlineLoading />
      </AppShell>
    );
  }
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm({ ...form, [key]: value });
  const toggle = (key: "availability" | "collaboration_modes" | "contribution_types", code: string) =>
    set(key, form[key].includes(code) ? form[key].filter((c) => c !== code) : [...form[key], code]);

  return (
    <AppShell title="Mon profil" subtitle="Présentez-vous à votre rythme : tout est facultatif, sauf votre prénom.">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="size-4" aria-hidden /> Qui je suis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <AvatarField userId={profile.id} path={profile.avatar_path ?? null} person={form} onChanged={refresh} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="pr-first" label="Prénom" hint="Obligatoire, pour l'adhésion.">
                  <Input id="pr-first" autoComplete="given-name" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
                </Field>
                <Field id="pr-last" label="Nom" hint="Pour l'adhésion.">
                  <Input id="pr-last" autoComplete="family-name" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
                </Field>
                <Field id="pr-display" label="Nom affiché" hint="Celui que voient les autres membres. Vide : prénom et nom.">
                  <Input id="pr-display" autoComplete="nickname" value={form.display_name} onChange={(e) => set("display_name", e.target.value)} />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Me présenter</CardTitle>
              <p className="text-sm text-muted-foreground">Quelques mots suffisent. Pour chaque bloc, vous choisissez qui le voit.</p>
            </CardHeader>
            <CardContent className="space-y-5 text-sm">
              <Block
                title="Présentation"
                visibility={form.bio_visibility}
                onVisibility={(v) => set("bio_visibility", v)}
                visibilityId="vis-bio"
              >
                <Label htmlFor="pr-bio" className="sr-only">Présentation</Label>
                <Textarea
                  id="pr-bio"
                  rows={3}
                  maxLength={BIO_MAX}
                  value={form.bio}
                  placeholder="Ex. Je vis avec Uma, une border joyeuse, et j'aime les balades du dimanche."
                  aria-describedby="pr-bio-count"
                  onChange={(e) => set("bio", e.target.value)}
                />
                <p id="pr-bio-count" className="text-right text-xs text-muted-foreground">{form.bio.length} / {BIO_MAX}</p>
              </Block>

              <Block
                title="Ville et département"
                visibility={form.location_visibility}
                onVisibility={(v) => set("location_visibility", v)}
                visibilityId="vis-location"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="pr-city" label="Ville">
                    <Input id="pr-city" autoComplete="address-level2" value={form.city} onChange={(e) => set("city", e.target.value)} />
                  </Field>
                  <Field id="pr-dep" label="Département">
                    <Input id="pr-dep" value={form.department} onChange={(e) => set("department", e.target.value)} />
                  </Field>
                </div>
              </Block>

              <Block
                title="Compétences et centres d'intérêt"
                visibility={form.skills_visibility}
                onVisibility={(v) => set("skills_visibility", v)}
                visibilityId="vis-skills"
              >
                <p className="text-xs text-muted-foreground">Les mêmes que dans « Je veux aider ».</p>
                <SkillsEditor value={form.skills} onChange={(next) => set("skills", next)} inputId="pr-skill" />
                <Label htmlFor="pr-skill" className="sr-only">Nouvelle compétence ou centre d'intérêt</Label>
              </Block>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Mes envies d'aider</CardTitle>
              <p className="text-sm text-muted-foreground">
                Pour qu'on vous propose ce qui vous ressemble, jamais pour vous engager. Vous pouvez tout laisser vide.
              </p>
            </CardHeader>
            <CardContent className="space-y-5 text-sm">
              <Block
                title="Disponibilités et façons d'aider"
                visibility={form.availability_visibility}
                onVisibility={(v) => set("availability_visibility", v)}
                visibilityId="vis-availability"
              >
                <CheckGroup legend="Quand" options={AVAILABILITY_OPTIONS} value={form.availability} onToggle={(c) => toggle("availability", c)} />
                <CheckGroup legend="Comment" options={COLLABORATION_MODES} value={form.collaboration_modes} onToggle={(c) => toggle("collaboration_modes", c)} />
                <CheckGroup legend="Ce qui me tente" options={CONTRIBUTION_PREFERENCES} value={form.contribution_types} onToggle={(c) => toggle("contribution_types", c)} />
              </Block>
            </CardContent>
          </Card>

          <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
            <Button onClick={() => save.mutate()} disabled={save.isPending || !dirty}>
              {save.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {dirty ? "Des changements attendent d'être enregistrés." : "Tout est à jour."}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="size-4" aria-hidden /> Confidentialité
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <Label htmlFor="pr-listed" className="leading-snug">
                  Apparaître dans l'annuaire des membres
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    Éteint : votre fiche n'y figure pas, quels que soient les réglages ci-contre.
                  </span>
                </Label>
                <Switch id="pr-listed" checked={form.public_visibility} onCheckedChange={(v) => set("public_visibility", v)} />
              </div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li>Votre nom affiché reste visible là où vous participez (projets, commentaires).</li>
                <li>Téléphone et e-mail restent privés : seuls vous et le Bureau les voyez.</li>
                <li>Vos chiens, leur santé, leur comportement et votre foyer n'apparaissent jamais dans votre profil.</li>
              </ul>
              <Field id="pr-phone" label="Téléphone (privé)">
                <Input id="pr-phone" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </Field>
              <Button variant="outline" className="w-full gap-2" onClick={() => setPreviewOpen(true)}>
                <Eye className="size-4" aria-hidden /> Voir mon profil tel que les autres le voient
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Mon adhésion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="break-all text-muted-foreground">{profile.email}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {MEMBERSHIP_TYPE_LABEL[profile.membership_type ?? ""] ?? profile.membership_type}
                </Badge>
                <Badge variant={profile.membership_status === "ACTIVE" ? "default" : "outline"}>
                  {profile.membership_status === "ACTIVE" ? "Adhésion active" : "En attente de validation"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <section className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <h2 className="flex items-center gap-2 text-base"><HeartHandshake className="size-4" aria-hidden /> Mon foyer & mes chiens</h2>
        <Button asChild variant="outline"><Link to="/foyer">Ouvrir les fiches de mes chiens</Link></Button>
      </section>

      <div className="mt-6 max-w-xl">
        <AccountDeletionCard />
      </div>

      <ProfilePreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        userId={profile.id}
        dirty={dirty}
        status={profile.membership_status}
        listed={profile.public_visibility}
      />
    </AppShell>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Un bloc d'informations avec son propre réglage « Visible par ». */
function Block({
  title,
  visibility,
  onVisibility,
  visibilityId,
  children,
}: {
  title: string;
  visibility: FieldVisibility;
  onVisibility: (v: FieldVisibility) => void;
  visibilityId: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-2 rounded-lg border border-border p-3" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{title}</h3>
        <div className="flex items-center gap-2">
          <Label htmlFor={visibilityId} className="text-xs text-muted-foreground">Visible par</Label>
          <select
            id={visibilityId}
            value={visibility}
            onChange={(e) => onVisibility(e.target.value as FieldVisibility)}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          >
            {(Object.keys(VISIBILITY_LABEL) as FieldVisibility[]).map((v) => (
              <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>
            ))}
          </select>
        </div>
      </div>
      {children}
    </section>
  );
}

function CheckGroup({
  legend,
  options,
  value,
  onToggle,
}: {
  legend: string;
  options: [string, string][];
  value: string[];
  onToggle: (code: string) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-xs font-medium text-muted-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([code, label]) => {
          const checked = value.includes(code);
          return (
            <label
              key={code}
              className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                checked ? "border-primary-ink bg-primary-tint" : "border-border"
              }`}
            >
              <input type="checkbox" className="size-4 accent-primary" checked={checked} onChange={() => onToggle(code)} />
              {label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Photo facultative : enregistrée tout de suite dans le dossier privé de la personne. */
function AvatarField({
  userId,
  path,
  person,
  onChanged,
}: {
  userId: string;
  path: string | null;
  person: { display_name: string; first_name: string; last_name: string };
  onChanged: () => Promise<void>;
}) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const replace = async (file: File) => {
    if (!AVATAR_TYPES.includes(file.type)) return toast.error("Choisissez une image JPG, PNG ou WebP.");
    if (file.size > AVATAR_MAX) return toast.error("Cette image dépasse 2 Mo. Essayez une version plus légère.");
    setBusy(true);
    try {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const next = `${userId}/avatar-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("avatars").upload(next, file, { contentType: file.type, upsert: false });
      if (up.error) throw up.error;
      const { error } = await supabase.from("profiles").update({ avatar_path: next }).eq("id", userId);
      if (error) {
        await supabase.storage.from("avatars").remove([next]);
        throw error;
      }
      if (path?.startsWith(`${userId}/`)) await supabase.storage.from("avatars").remove([path]);
      toast.success("Votre photo est en place.");
      await onChanged();
      void qc.invalidateQueries({ queryKey: ["avatar-url"] });
    } catch (e) {
      toast.error(humanizeError(e, "La photo n'a pas pu être enregistrée. Réessayez dans un instant."));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ avatar_path: null }).eq("id", userId);
      if (error) throw error;
      if (path?.startsWith(`${userId}/`)) await supabase.storage.from("avatars").remove([path]);
      toast.success("Photo retirée : vos initiales s'affichent à la place.");
      await onChanged();
      void qc.invalidateQueries({ queryKey: ["avatar-url"] });
    } catch (e) {
      toast.error(humanizeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <UserAvatar path={path} person={person} className="size-16 text-lg" decorative={false} />
      <div className="space-y-1">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" className="gap-2" disabled={busy} onClick={() => input.current?.click()}>
            <ImagePlus className="size-4" aria-hidden /> {path ? "Changer la photo" : "Ajouter une photo"}
          </Button>
          {path ? (
            <Button type="button" size="sm" variant="ghost" className="gap-2" disabled={busy} onClick={() => void remove()}>
              <Trash2 className="size-4" aria-hidden /> Retirer
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">Facultative. Sans photo, vos initiales s'affichent. JPG, PNG ou WebP, 2 Mo au plus.</p>
        <input
          ref={input}
          type="file"
          accept={AVATAR_TYPES.join(",")}
          className="sr-only"
          aria-label="Choisir une photo de profil"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void replace(file);
          }}
        />
      </div>
    </div>
  );
}

/** Aperçu réel : la même fonction serveur que l'annuaire, en vue « membre » (jamais reconstruit ici). */
function ProfilePreview({
  open,
  onOpenChange,
  userId,
  dirty,
  status,
  listed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  dirty: boolean;
  status: string;
  listed: boolean;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["profile-preview", userId],
    enabled: open,
    staleTime: 0,
    queryFn: async () => (await fetchDirectoryProfiles({ ids: [userId], asMember: true }))[0] ?? null,
  });
  const name = data ? data.display_name || [data.first_name, data.last_name].filter(Boolean).join(" ") || "Adhérent" : "";
  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Mon profil vu par les autres membres"
      description="Exactement ce que l'annuaire leur montre, avec vos réglages enregistrés."
    >
      {dirty ? (
        <p role="note" className="rounded-md border-l-4 border-l-warning bg-muted p-2 text-xs">
          Vous avez des changements non enregistrés : l'aperçu montre la dernière version enregistrée.
        </p>
      ) : null}
      {isLoading ? (
        <InlineLoading />
      ) : isError ? (
        <p role="alert" className="text-sm text-destructive">L'aperçu n'a pas pu s'afficher. Réessayez dans un instant.</p>
      ) : data ? (
        <article className="rounded-xl border border-border bg-card p-5" aria-label="Aperçu de votre fiche">
          <div className="flex items-center gap-3">
            <UserAvatar path={data.avatar_path} person={data} className="size-11" />
            <h3 className="min-w-0 font-display text-base font-bold">{name}</h3>
          </div>
          <MemberSummary person={data} />
          {!data.city && !data.bio && !data.skills.length && !data.availability.length && !data.collaboration_modes.length && !data.contribution_types.length ? (
            <p className="mt-3 text-xs text-muted-foreground">Seuls votre nom et vos initiales (ou votre photo) apparaissent pour l'instant.</p>
          ) : null}
        </article>
      ) : status !== "ACTIVE" ? (
        <p className="text-sm text-muted-foreground">
          Votre fiche n'apparaît pas encore dans l'annuaire : elle s'y affichera une fois votre adhésion validée par le Bureau.
        </p>
      ) : !listed ? (
        <p className="text-sm text-muted-foreground">
          Vous n'apparaissez pas dans l'annuaire : les autres membres ne voient pas votre fiche. Votre nom reste visible là où vous participez.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Votre fiche n'est pas visible dans l'annuaire pour le moment.</p>
      )}
      <p className="text-xs text-muted-foreground">Téléphone, e-mail, chiens et foyer n'y figurent jamais.</p>
    </SidePanel>
  );
}
