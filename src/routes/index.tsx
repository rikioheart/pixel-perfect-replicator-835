import { publicSeo } from '@/components/PublicSeo';
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { PublicWelcome } from '@/components/PublicWelcome';
import { PublicFooter, PublicHeader } from '@/components/PublicHeader';
import { useOnline } from '@/lib/offline';
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
    scripts: [{ type: 'application/ld+json', children: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', name: 'La Voix du Chien', url: 'https://plateforme-la-voix-du-chien.lovable.app/', areaServed: ['Seine-et-Marne', 'Loiret', 'Yonne', 'Essonne'], description: 'Association pour le bien-être du chien, la coopération et l’entraide.' }) }],
    links: publicSeo('/').links,
    meta: [
      ...publicSeo('/').meta,
      { title: "La Voix du Chien — Ensemble, à leur rythme" },
      {
        name: "description",
        content:
          "Pass Terrain, prochaines activités, annuaire des partenaires et accès à l’espace membre de La Voix du Chien.",
      },
      { property: "og:title", content: "La Voix du Chien — Ensemble, à leur rythme" },
      {
        property: "og:description",
        content: "Pass Terrain, activités à venir et partenaires de l’association.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { vitrine?: 1 } => (search['vitrine'] ? { vitrine: 1 } : {}),
  component: AuthPage,
});

function AuthPage() {
  const { session, isBureau, isPro, loading, rolesReady } = useAuth();
  const navigate = useNavigate();
  const { vitrine } = Route.useSearch();

  // « Voir la vitrine » : un membre connecté consulte la page publique sans être renvoyé ni déconnecté.
  useEffect(() => {
    if (!vitrine && !loading && rolesReady && session) {
      void navigate({ to: isBureau ? "/admin" : isPro ? "/espace-pro" : "/member" });
    }
  }, [vitrine, session, isBureau, isPro, loading, rolesReady, navigate]);

  return (
    <div className="public-site min-h-screen bg-background">
      <PublicHeader />
      <main id="contenu" className="public-main">
      <PublicWelcome />
      <section id="connexion" aria-labelledby="member-title" className="public-section scroll-mt-24 grid items-start gap-8 lg:grid-cols-2">
        <div>
          <p className="public-eyebrow mb-3">Adhérents et professionnels</p>
          <h2 id="member-title">Votre espace membre</h2>
          <p className="mt-4 text-muted-foreground">Un seul accès pour suivre votre chien et participer à la vie de l’association.</p>
          <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
            <li>• Le carnet de vie de votre chien</li>
            <li>• Vos sorties, réservations et carte de fidélité</li>
            <li>• Les projets, tâches et actualités de l’association</li>
          </ul>
        </div>
        <div className="panel w-full p-5 sm:p-6">
          <GoogleSignInButton />
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
      </main>
      <PublicFooter />
    </div>
  );
}

function GoogleSignInButton() {
  const online = useOnline();
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    setBusy(false);
    if (result.error) toast.error(result.error.message);
    // If redirected, the browser navigates away; nothing else to do.
  };

  return (
    <div className="mb-5 space-y-3">
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        disabled={busy || !online}
        onClick={signIn}
      >
        <GoogleIcon />
        {busy ? "Redirection…" : "Continuer avec Google"}
      </Button>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          ou par e-mail
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function SignInForm() {
  const online = useOnline();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(/invalid login credentials/i.test(error.message) ? "E-mail ou mot de passe incorrect." : /email not confirmed/i.test(error.message) ? "Confirmez d’abord votre adresse e-mail (lien reçu par e-mail)." : error.message);
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
      <Button type="submit" className="w-full" disabled={busy || !online}>
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
  const online = useOnline();
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
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin,
        // La base crée le profil (statut PENDING imposé) à partir de ces informations.
        data: { first_name: firstName, last_name: lastName, membership_type: form.type === "PROFESSIONNEL" ? "PROFESSIONNEL" : "PARTICULIER" },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(/already registered|already exists/i.test(error.message) ? "Un compte existe déjà avec cet e-mail. Connectez-vous ou réinitialisez votre mot de passe." : error.message);
      return;
    }
    if (!data.user) {
      toast.error("Le compte n'a pas pu être créé. Réessayez dans un instant.");
      return;
    }
    toast.success(
      data.session
        ? "Compte créé. Votre adhésion est en attente de validation du Bureau."
        : "Compte créé. Confirmez votre e-mail avec le lien reçu, puis connectez-vous. Le Bureau validera ensuite votre adhésion.",
    );
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
      <Button type="submit" className="w-full" disabled={busy || !online}>
        {busy ? "Création…" : "Créer mon compte"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Après inscription, votre compte reste en attente d'approbation par le Bureau.
      </p>
    </form>
  );
}
