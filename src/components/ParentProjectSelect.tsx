import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";

/** Rattachement facultatif à un projet parent (projets visibles selon les droits). */
export function ParentProjectSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-for-link"],
    queryFn: async () =>
      (await supabase.from("projects").select("id, title").is("archived_at", null).order("title")).data ?? [],
  });
  return (
    <div>
      <Label htmlFor={id}>Projet parent <span className="text-muted-foreground">(facultatif)</span></Label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
        <option value="">Aucun projet</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.title}</option>
        ))}
      </select>
    </div>
  );
}
