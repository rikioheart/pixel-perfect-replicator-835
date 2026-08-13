import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INVOLVEMENT_LABEL,
  INVOLVEMENT_LEVELS,
  MEMBERSHIP_STATUSES,
  MEMBERSHIP_TYPES,
  memberFormSchema,
  type MemberFormValues,
} from "@/lib/member-schema";
import { MEMBERSHIP_STATUS_LABEL, MEMBERSHIP_TYPE_LABEL } from "@/lib/members";

type Errors = Partial<Record<keyof MemberFormValues, string>>;

export function MemberForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialValues: MemberFormValues;
  submitLabel: string;
  onSubmit: (values: MemberFormValues) => Promise<void>;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<MemberFormValues>(initialValues);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof MemberFormValues>(key: K, value: MemberFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = memberFormSchema.safeParse(form);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof MemberFormValues;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setBusy(true);
    try {
      await onSubmit(parsed.data);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom *" error={errors.first_name} htmlFor="first_name">
          <Input
            id="first_name"
            value={form.first_name}
            onChange={(e) => set("first_name", e.target.value)}
          />
        </Field>
        <Field label="Nom *" error={errors.last_name} htmlFor="last_name">
          <Input
            id="last_name"
            value={form.last_name}
            onChange={(e) => set("last_name", e.target.value)}
          />
        </Field>
        <Field label="E-mail *" error={errors.email} htmlFor="email">
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <Field label="Téléphone" error={errors.phone} htmlFor="phone">
          <Input
            id="phone"
            value={form.phone ?? ""}
            onChange={(e) => set("phone", e.target.value)}
          />
        </Field>
        <Field label="Ville" error={errors.city} htmlFor="city">
          <Input id="city" value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Département" error={errors.department} htmlFor="department">
          <Input
            id="department"
            value={form.department ?? ""}
            onChange={(e) => set("department", e.target.value)}
          />
        </Field>
        <Field label="Type d'adhésion" error={errors.membership_type}>
          <Select
            value={form.membership_type}
            onValueChange={(value) =>
              set("membership_type", value as MemberFormValues["membership_type"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEMBERSHIP_TYPES.map((code) => (
                <SelectItem key={code} value={code}>
                  {MEMBERSHIP_TYPE_LABEL[code] ?? code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Statut" error={errors.membership_status}>
          <Select
            value={form.membership_status}
            onValueChange={(value) =>
              set("membership_status", value as MemberFormValues["membership_status"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEMBERSHIP_STATUSES.map((code) => (
                <SelectItem key={code} value={code}>
                  {MEMBERSHIP_STATUS_LABEL[code] ?? code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Niveau d'implication" error={errors.involvement_level}>
          <Select
            value={form.involvement_level || "NONE"}
            onValueChange={(value) =>
              set(
                "involvement_level",
                (value === "NONE" ? "" : value) as MemberFormValues["involvement_level"],
              )
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">Non renseigné</SelectItem>
              {INVOLVEMENT_LEVELS.map((code) => (
                <SelectItem key={code} value={code}>
                  {INVOLVEMENT_LABEL[code] ?? code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Date d'adhésion" error={errors.membership_date} htmlFor="membership_date">
          <Input
            id="membership_date"
            type="date"
            value={form.membership_date ?? ""}
            onChange={(e) => set("membership_date", e.target.value)}
          />
        </Field>
      </div>

      <Field label="Présentation" error={errors.bio} htmlFor="bio">
        <Textarea
          id="bio"
          rows={4}
          value={form.bio ?? ""}
          onChange={(e) => set("bio", e.target.value)}
        />
      </Field>

      <div className="flex items-center gap-3">
        <Switch
          id="public_visibility"
          checked={form.public_visibility}
          onCheckedChange={(checked) => set("public_visibility", checked)}
        />
        <Label htmlFor="public_visibility" className="text-sm font-normal">
          Visible dans l'annuaire interne des membres
        </Label>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Enregistrement…" : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
