import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { humanizeError } from "@/lib/user-messages";
import { PROFESSIONAL_QUALITY_LABEL, professionalRequestProblem } from "@/lib/professional-quality";

export function ProfessionalQualityRequest() {
  const { user, profile, refresh } = useAuth();
  const qc = useQueryClient();
  const [company, setCompany] = useState("");
  const [activity, setActivity] = useState("");
  const [siret, setSiret] = useState("");
  const query = useQuery({
    queryKey: ["my-professional-quality", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("pro_details").select("pro_status,pro_review_note,company_name").eq("profile_id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const request = useMutation({
    mutationFn: async () => {
      if (!user || profile?.membership_status !== "ACTIVE") throw new Error("Une adhésion active est nécessaire.");
      const problem = professionalRequestProblem(company, activity, siret);
      if (problem) throw new Error(problem);
      const { error } = await supabase.from("pro_details").insert({
        profile_id: user.id, company_name: company.trim(), professional_category: activity.trim(),
        siret: siret.replace(/\s/g, "") || null, pro_status: "PENDING",
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Votre demande a été transmise au Bureau.");
      await qc.invalidateQueries({ queryKey: ["my-professional-quality"] });
      await refresh();
    },
    onError: (error: Error) => toast.error(humanizeError(error)),
  });
  if (query.isPending) return <p className="text-sm text-muted-foreground" role="status">Chargement…</p>;
  if (query.isError) return <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Réessayer</Button>;
  if (query.data) return (
    <div className="space-y-2 text-sm">
      <Badge variant="outline">{PROFESSIONAL_QUALITY_LABEL[query.data.pro_status]}</Badge>
      <p>{query.data.company_name}</p>
      {query.data.pro_review_note ? <p className="text-muted-foreground">{query.data.pro_review_note}</p> : null}
      {query.data.pro_status === "VALIDATED" && profile?.membership_status === "ACTIVE" ? <Button asChild variant="outline" size="sm"><Link to="/espace-pro">Mon espace professionnel</Link></Button> : null}
    </div>
  );
  if (profile?.membership_status !== "ACTIVE") return null;
  return (
    <form className="space-y-3 text-sm" onSubmit={(event) => { event.preventDefault(); request.mutate(); }}>
      <div><Label htmlFor="pq-company">Structure</Label><Input id="pq-company" value={company} onChange={(event) => setCompany(event.target.value)} required /></div>
      <div><Label htmlFor="pq-activity">Activité professionnelle</Label><Input id="pq-activity" value={activity} onChange={(event) => setActivity(event.target.value)} required /></div>
      <div><Label htmlFor="pq-siret">SIRET (facultatif)</Label><Input id="pq-siret" value={siret} onChange={(event) => setSiret(event.target.value)} inputMode="numeric" /></div>
      <Button type="submit" size="sm" disabled={request.isPending}>{request.isPending ? "Transmission…" : "Demander la validation"}</Button>
    </form>
  );
}