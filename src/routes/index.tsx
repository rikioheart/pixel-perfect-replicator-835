import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PawPrint } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Connexion — La Voix du Chien" },
      {
        name: "description",
        content:
          "Accès réservé aux membres de La Voix du Chien : pilotage des projets, tâches et validations de l'association.",
      },
      { property: "og:title", content: "Connexion — La Voix du Chien" },
      {
        property: "og:description",
        content: "Espace interne des membres, professionnels et du Bureau de La Voix du Chien.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session, isBureau, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) {
      void navigate({ to: isBureau ? "/admin" : "/member" });
    }
  }, [session, isBureau, loading, navigate]);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="surface-night flex flex-col justify-between p-10">
        <div className="flex items-center gap-2">
          <PawPrint className="size-6" />
          <span className="font-display">La Voix du Chien</span>
        </div>
        <div className="max-w-md space-y-5 py-16">
          <h1 className="text-4xl leading-tight">
            Le cockpit opérationnel de l'association
          </h1>
          <p className="text-sm leading-relaxed opacity-80">
            Piloter les projets, suivre les tâches, apporter la preuve du travail réalisé et faire
            valider chaque avancée par le Bureau. Un outil de développement associatif, pensé pour
            les petits progrès continus.
          </p>
          <ul className="space-y-2 text-sm opacity-80">
            <li>Action → preuve → validation → historique</li>
            <li>Professionnels, particuliers et Bureau réunis</li>
            <li>Nargis, Loiret — et tout le réseau</li>
          </ul>
        </div>
        <p className="text-xs opacity-60">Plateforme interne — accès réservé aux membres.</p>
      </section>

      <section className="flex items-center justify-center bg-background p-6">
        <div className="panel w-full max-w-md p-7">
          <Tabs defaultValue="signin">
            <TabsList className="mb-6 grid w-full grid-cols-2">
              <TabsTrigger value="signin">Connexion</TabsTrigger>
              <TabsTrigger value="signup">Créer un compte</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <SignInForm />
            </TabsContent>
            <TabsContent value="signup">
              <SignUpForm />
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
  };

  const resetPassword = async () => {
    if (!email) {
      toast.error("Renseignez votre e-mail d'abord.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) toast.error(error.message);
    else toast.success("E-mail de réinitialisation envoyé.");
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Connexion…" : "Se connecter"}
      </Button>
      <button
        type="button"
        onClick={resetPassword}
        className="w-full text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        Mot de passe oublié ?
      </button>
    </form>
  );
}

function SignUpForm() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    type: "PARTICULIER",
  });
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    const userId = data.user?.id;
    if (userId && data.session) {
      await supabase.from("profiles").insert({
        id: userId,
        first_name: form.firstName,
        last_name: form.lastName,
        display_name: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        membership_type: form.type,
        membership_status: "PENDING",
      });
    }
    setBusy(false);
    toast.success("Compte créé. Votre adhésion est en attente de validation du Bureau.");
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="firstName">Prénom</Label>
          <Input
            id="firstName"
            required
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Nom</Label>
          <Input
            id="lastName"
            required
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="signupEmail">E-mail</Label>
        <Input
          id="signupEmail"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signupPassword">Mot de passe</Label>
        <Input
          id="signupPassword"
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Type d'adhésion</Label>
        <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PARTICULIER">Particulier</SelectItem>
            <SelectItem value="PROFESSIONNEL">Professionnel</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Création…" : "Créer mon compte"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Après inscription, votre compte reste en attente d'approbation par le Bureau.
      </p>
    </form>
  );
}
