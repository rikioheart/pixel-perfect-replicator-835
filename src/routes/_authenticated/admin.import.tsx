import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { UploadCloud, CheckCircle2, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { importMembers } from "@/lib/member-import.functions";

export const Route = createFileRoute("/_authenticated/admin/import")({
  head: () => ({
    meta: [
      { title: "Import d'adhérents — La Voix du Chien" },
      {
        name: "description",
        content:
          "Charger un fichier CSV d'adhérents, vérifier les correspondances de colonnes et confirmer l'import.",
      },
      { property: "og:title", content: "Import d'adhérents — La Voix du Chien" },
      {
        property: "og:description",
        content: "Import contrôlé : rien n'est écrasé silencieusement, chaque ligne est vérifiée.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportPage,
});

const TARGET_FIELDS: [string, string][] = [
  ["first_name", "Prénom"],
  ["last_name", "Nom"],
  ["email", "E-mail"],
  ["phone", "Téléphone"],
  ["city", "Ville"],
  ["department", "Département"],
  ["membership_type", "Type d'adhésion"],
  ["membership_status", "Statut d'adhésion"],
  ["membership_date", "Date d'adhésion"],
  ["bio", "Présentation"],
];

const GUESSES: Record<string, string> = {
  prenom: "first_name",
  "prénom": "first_name",
  firstname: "first_name",
  nom: "last_name",
  lastname: "last_name",
  email: "email",
  mail: "email",
  "e-mail": "email",
  telephone: "phone",
  "téléphone": "phone",
  tel: "phone",
  phone: "phone",
  ville: "city",
  city: "city",
  departement: "department",
  "département": "department",
  role: "membership_type",
  "catégorie": "membership_type",
  categorie: "membership_type",
  type: "membership_type",
  statut: "membership_status",
  "date adhésion": "membership_date",
  "date adhesion": "membership_date",
};

function detectDelimiter(line: string) {
  const counts = [";", ",", "\t"].map((d) => [d, line.split(d).length] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0]![1] > 1 ? counts[0]![0] : ",";
}

function parseCsv(text: string) {
  const lines = text.replace(/\r/g, "").split("\n").filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { delimiter: ",", columns: [], rows: [] as string[][] };
  const delimiter = detectDelimiter(lines[0]!);
  const split = (line: string) =>
    line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""));
  const columns = split(lines[0]!);
  const rows = lines.slice(1).map(split);
  return { delimiter, columns, rows };
}

function ImportPage() {
  const queryClient = useQueryClient();
  const runImport = useServerFn(importMembers);
  const [fileName, setFileName] = useState("");
  const [analysis, setAnalysis] = useState<ReturnType<typeof parseCsv> | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [updateExisting, setUpdateExisting] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    errors: { email: string; reason: string }[];
  } | null>(null);

  const { data: history = [] } = useQuery({
    queryKey: ["member-imports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("member_imports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const onFile = async (file: File | null) => {
    setResult(null);
    setAnalysis(null);
    if (!file) return;
    setFileName(file.name);
    const parsed = parseCsv(await file.text());
    setAnalysis(parsed);
    const guessed: Record<string, string> = {};
    for (const column of parsed.columns) {
      const key = column.trim().toLowerCase();
      if (GUESSES[key]) guessed[column] = GUESSES[key]!;
    }
    setMapping(guessed);
  };

  const execute = useMutation({
    mutationFn: async () => {
      if (!analysis) throw new Error("Chargez d'abord un fichier CSV.");
      const emailColumn = Object.entries(mapping).find(([, field]) => field === "email")?.[0];
      if (!emailColumn) throw new Error("Indiquez quelle colonne contient l'adresse e-mail.");
      const rows = analysis.rows
        .map((cells) => {
          const row: Record<string, string> = {};
          analysis.columns.forEach((column, index) => {
            const field = mapping[column];
            if (field) row[field] = cells[index] ?? "";
          });
          return row;
        })
        .filter((row) => (row["email"] ?? "").includes("@"));
      if (rows.length === 0) throw new Error("Aucune ligne avec une adresse e-mail valide.");
      return runImport({ data: { fileName, updateExisting, rows: rows as never } });
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(`${data.created} créé(s), ${data.updated} mis à jour, ${data.skipped} ignoré(s).`);
      queryClient.invalidateQueries({ queryKey: ["member-imports"] });
      queryClient.invalidateQueries({ queryKey: ["directory"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!authLoading && !isBureau) return <BureauOnly title="Import d'adhérents" />;

  return (
    <AppShell
      title="Import d'adhérents"
      subtitle="Chargez un CSV, vérifiez les correspondances, puis confirmez. Rien n'est écrasé silencieusement."
    >
      <div className="space-y-6">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold">1. Fichier CSV</h2>
          <div className="mt-4 max-w-sm space-y-1">
            <Label htmlFor="csv">Fichier (.csv)</Label>
            <Input
              id="csv"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => onFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Colonnes reconnues automatiquement : Prénom, Nom, E-mail, Téléphone, Ville, Département, Type
            d'adhésion, Statut, Date d'adhésion.
          </p>
        </section>

        {analysis ? (
          <>
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-display text-lg font-bold">2. Correspondance des colonnes</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {analysis.rows.length} ligne(s) détectée(s), séparateur «&nbsp;
                {analysis.delimiter === "\t" ? "tabulation" : analysis.delimiter}&nbsp;».
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {analysis.columns.map((column) => (
                  <div key={column} className="flex items-center gap-3">
                    <span className="w-1/2 truncate text-sm font-medium" title={column}>
                      {column}
                    </span>
                    <Select
                      value={mapping[column] ?? "IGNORE"}
                      onValueChange={(value) =>
                        setMapping((previous) => {
                          const next = { ...previous };
                          if (value === "IGNORE") delete next[column];
                          else next[column] = value;
                          return next;
                        })
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IGNORE">Ignorer</SelectItem>
                        {TARGET_FIELDS.map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-display text-lg font-bold">3. Confirmation</h2>
              <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
                <Label htmlFor="update">Mettre à jour les fiches existantes (même e-mail)</Label>
                <Switch id="update" checked={updateExisting} onCheckedChange={setUpdateExisting} />
              </div>
              <Button
                className="mt-4 rounded-full"
                onClick={() => execute.mutate()}
                disabled={execute.isPending}
              >
                <UploadCloud className="mr-2 size-4" />
                {execute.isPending ? "Import en cours…" : "Lancer l'import"}
              </Button>
            </section>
          </>
        ) : null}

        {result ? (
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="inline-flex items-center gap-2 font-display text-lg font-bold">
              <CheckCircle2 className="size-5 text-primary" /> Résultat
            </h2>
            <p className="mt-2 text-sm">
              {result.created} fiche(s) créée(s), {result.updated} mise(s) à jour, {result.skipped}{" "}
              ignorée(s).
            </p>
            {result.errors.length > 0 ? (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {result.errors.map((error) => (
                  <li key={error.email} className="inline-flex items-center gap-2">
                    <AlertTriangle className="size-3.5" /> {error.email} — {error.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold">Historique des imports</h2>
          {history.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Aucun import réalisé pour l'instant.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {history.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-3 text-sm"
                >
                  <span className="font-semibold">{item.file_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleString("fr-FR")} · {item.created_count} créé(s),{" "}
                    {item.updated_count} mis à jour, {item.skipped_count} ignoré(s)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
