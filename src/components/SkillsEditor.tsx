import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeSkills, SKILLS_MAX } from "@/lib/profile-details";

/** Liste de compétences et centres d'intérêt (profiles.skills), partagée par le profil et « Je veux aider ». */
export function SkillsEditor({
  value,
  onChange,
  disabled,
  inputId,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  inputId?: string;
}) {
  const [draft, setDraft] = useState("");
  const full = value.length >= SKILLS_MAX;
  const add = () => {
    const next = normalizeSkills([...value, draft]);
    setDraft("");
    if (next.length !== value.length) onChange(next);
  };
  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Compétences et centres d'intérêt">
          {value.map((s) => (
            <li key={s}>
              <Badge variant="secondary" className="gap-1 pr-1">
                {s}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((x) => x !== s))}
                  disabled={disabled}
                  className="rounded-full p-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Retirer ${s}`}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Rien d'indiqué pour l'instant, et c'est très bien ainsi si vous préférez.</p>
      )}
      <div className="flex gap-2">
        <Input
          id={inputId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Ex. couture, conduite, photo, éducation canine…"
          aria-label={inputId ? undefined : "Nouvelle compétence ou centre d'intérêt"}
          maxLength={60}
          disabled={disabled || full}
        />
        <Button type="button" variant="outline" onClick={add} disabled={disabled || full || !draft.trim()}>
          <Plus className="size-4" aria-hidden /> Ajouter
        </Button>
      </div>
      {full ? <p className="text-xs text-muted-foreground">{SKILLS_MAX} éléments au plus.</p> : null}
    </div>
  );
}
