import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { PublicFooter, PublicHeader } from '@/components/PublicHeader';
import { DogEmptyArt } from '@/components/DogEmptyArt';
import { LoadingState } from '@/components/LoadingState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOnline } from '@/lib/offline';
import { humanizeError } from '@/lib/user-messages';
import { PASSWORD_MIN_LENGTH, checkNewPassword, readRecoveryHash, tokenFromRecovery } from '@/lib/password-rules';

export const Route = createFileRoute('/reinitialiser-mot-de-passe')({
  head: () => ({
    meta: [
      { title: 'Nouveau mot de passe — La Voix du Chien' },
      { name: 'description', content: 'Choisissez un nouveau mot de passe pour votre espace membre La Voix du Chien.' },
      { name: 'robots', content: 'noindex, nofollow' },
      { property: 'og:title', content: 'Nouveau mot de passe — La Voix du Chien' },
      { property: 'og:description', content: 'Réinitialisation du mot de passe de l’espace membre.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
  component: ResetPasswordPage,
});

/** Mémorise, le temps de l'onglet, le compte arrivé par un lien de réinitialisation (survit à un rechargement). */
const RECOVERY_KEY = 'lvdc-password-recovery';

type Stage = 'checking' | 'ready' | 'invalid' | 'expired' | 'done';

function ResetPasswordPage() {
  const [stage, setStage] = useState<Stage>('checking');
  const hashRef = useRef<ReturnType<typeof readRecoveryHash> | null>(null);

  useEffect(() => {
    // Lu avant que la session ne consomme l'adresse du lien.
    hashRef.current ??= readRecoveryHash(window.location.hash);
    const hint = hashRef.current;
    if (hint.kind === 'error') {
      setStage(hint.expired ? 'expired' : 'invalid');
      return;
    }
    let settled = false;
    const accept = (userId: string) => {
      settled = true;
      sessionStorage.setItem(RECOVERY_KEY, userId);
      setStage('ready');
    };
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) return;
      if (event === 'PASSWORD_RECOVERY' || tokenFromRecovery(session.access_token)) accept(session.user.id);
      else if (sessionStorage.getItem(RECOVERY_KEY) === session.user.id) accept(session.user.id);
    });
    // Sans lien valide, on n'attend pas indéfiniment.
    const timer = window.setTimeout(() => { if (!settled) setStage('invalid'); }, hint.kind === 'recovery' ? 8000 : 2500);
    return () => {
      window.clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="public-site min-h-screen bg-background">
      <PublicHeader />
      <main id="contenu" className="public-main">
        <section aria-labelledby="reset-title" className="public-section grid items-start gap-8 lg:grid-cols-2">
          <div>
            <p className="public-eyebrow mb-3">Espace membre</p>
            <h1 id="reset-title" className="font-display text-3xl text-foreground">Choisir un nouveau mot de passe</h1>
            <p className="mt-4 text-muted-foreground">
              Ce lien vous a été envoyé parce qu’une réinitialisation a été demandée pour votre compte. Prenez le temps qu’il faut : rien ne change tant que vous n’avez pas validé.
            </p>
            <DogEmptyArt art="attentive" className="mt-6 hidden h-28 w-auto lg:block" />
          </div>
          <div className="panel w-full p-5 sm:p-6">
            {stage === 'checking' && <LoadingState label="Vérification du lien…" />}
            {stage === 'ready' && <NewPasswordForm onDone={() => setStage('done')} />}
            {(stage === 'invalid' || stage === 'expired') && <InvalidLink expired={stage === 'expired'} />}
            {stage === 'done' && <Done />}
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

const ISSUE_TEXT = {
  empty: 'Ce champ est obligatoire.',
  too_short: `Au moins ${PASSWORD_MIN_LENGTH} caractères.`,
  mismatch: 'Les deux mots de passe ne sont pas identiques.',
} as const;

function NewPasswordForm({ onDone }: { onDone: () => void }) {
  const online = useOnline();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const issues = checkNewPassword(password, confirmation);
  const showPwd = submitted && issues.password;
  const showConf = submitted && issues.confirmation;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    setServerError(null);
    if (issues.password || issues.confirmation) return;
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setServerError(humanizeError(error));
      return;
    }
    sessionStorage.removeItem(RECOVERY_KEY);
    toast.success('Votre mot de passe est modifié.');
    onDone();
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <KeyRound className="size-4" aria-hidden />
        <span>Au moins {PASSWORD_MIN_LENGTH} caractères. Une courte phrase est plus facile à retenir.</span>
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">Nouveau mot de passe</Label>
        <div className="relative">
          <Input
            id="new-password"
            type={visible ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(showPwd)}
            aria-describedby={showPwd ? 'new-password-error' : undefined}
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
        {showPwd && <p id="new-password-error" className="text-sm text-destructive">{ISSUE_TEXT[issues.password!]}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirmer le nouveau mot de passe</Label>
        <Input
          id="confirm-password"
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          aria-invalid={Boolean(showConf)}
          aria-describedby={showConf ? 'confirm-password-error' : undefined}
        />
        {showConf && <p id="confirm-password-error" className="text-sm text-destructive">{ISSUE_TEXT[issues.confirmation!]}</p>}
      </div>
      {serverError && <p role="alert" className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" className="w-full" disabled={busy || !online}>
        {busy ? 'Enregistrement…' : 'Enregistrer mon nouveau mot de passe'}
      </Button>
    </form>
  );
}

function InvalidLink({ expired }: { expired: boolean }) {
  return (
    <div role="status" className="space-y-4 text-center">
      <DogEmptyArt art="resting" className="mx-auto h-24 w-auto" />
      <h2 className="font-display text-xl text-foreground">{expired ? 'Ce lien a expiré' : 'Ce lien n’est plus valable'}</h2>
      <p className="text-sm text-muted-foreground">
        Un lien de réinitialisation ne sert qu’une fois et pour une durée limitée. Rien de grave : demandez-en un nouveau depuis l’écran de connexion, avec « Mot de passe oublié ? ».
      </p>
      <Button asChild className="w-full">
        <Link to="/" hash="connexion">Revenir à la connexion</Link>
      </Button>
    </div>
  );
}

function Done() {
  const navigate = useNavigate();
  useEffect(() => {
    const timer = window.setTimeout(() => void navigate({ to: '/' }), 2500);
    return () => window.clearTimeout(timer);
  }, [navigate]);
  return (
    <div role="status" className="space-y-4 text-center">
      <DogEmptyArt art="attentive" className="mx-auto h-24 w-auto" />
      <h2 className="font-display text-xl text-foreground">C’est enregistré</h2>
      <p className="text-sm text-muted-foreground">Votre nouveau mot de passe est actif. Nous vous emmenons vers votre espace.</p>
      <Button asChild className="w-full">
        <Link to="/">Accéder à mon espace</Link>
      </Button>
    </div>
  );
}
