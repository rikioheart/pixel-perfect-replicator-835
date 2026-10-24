import type React from "react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { readCachedRole, resolveProStatus, saveCachedRole } from "@/lib/pro-status";
import { clearPrivateOffline } from '@/lib/offline';
import { PROFILE_COLUMNS, withContacts } from "@/lib/profile-columns";

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  membership_type: string;
  membership_status: string;
  city: string | null;
  department: string | null;
  bio: string | null;
  public_visibility: boolean;
  account_choice_at?: string | null;
  deleted_at?: string | null;
};

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: string[];
  isBureau: boolean;
  isPro: boolean;
  loading: boolean;
  rolesReady: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

// Contexte unique conservé entre rechargements à chaud, sinon le fournisseur et
// les pages peuvent référencer deux contextes différents après une modification.
const globalCtx = globalThis as typeof globalThis & {
  __lvdcAuthContext?: React.Context<AuthState | undefined>;
};
const AuthContext = (globalCtx.__lvdcAuthContext ??= createContext<AuthState | undefined>(undefined));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rolesReady, setRolesReady] = useState(false);

  const loadContext = async (userId: string | undefined) => {
    setRolesReady(false);
    if (!userId) {
      setProfile(null);
      setRoles([]);
      setIsPro(false);
      setRolesReady(true);
      return;
    }
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("roles(code)").eq("user_id", userId),
    ]);
    let profile = (profileRes.data as unknown as Profile | null) ?? null;

    // Le profil est normalement créé par la base à l'inscription ; repli si absent (ancien compte OAuth).
    // Jamais en cas d'erreur de lecture (réseau coupé) : l'absence n'est alors pas certaine.
    if (!profile && !profileRes.error) {
      await supabase.from("profiles").insert({ id: userId, membership_type: "PARTICULIER", membership_status: "PENDING" });
      const again = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle();
      profile = (again.data as unknown as Profile | null) ?? null;
    }
    if (profile) profile = (await withContacts([profile]))[0] as Profile;

    setProfile(profile);
    // Statut pro décidé par la base (is_professional) ; refus par défaut si la réponse n'est pas certaine.
    const proRes = await supabase.rpc("is_professional", { _user_id: userId });
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    const cached = readCachedRole(userId);
    const codes = rolesRes.error
      ? offline && cached ? cached.roles : []
      : (rolesRes.data ?? [])
          .map((row) => (row as { roles: { code: string } | null }).roles?.code)
          .filter((code): code is string => Boolean(code));
    const pro = resolveProStatus({ rpcOk: !proRes.error, rpcValue: proRes.data, offline, cached });
    if (!proRes.error && !rolesRes.error) {
      saveCachedRole({ owner: userId, isPro: pro, roles: codes, verifiedAt: new Date().toISOString() });
    }
    setRoles(codes);
    setIsPro(pro);
    setRolesReady(true);
  };

  useEffect(() => {
    let active = true;

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setRolesReady(false); // wait for fresh roles before any role-based redirect
      setTimeout(() => {
        void loadContext(nextSession?.user.id);
      }, 0);
    });

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);
      await loadContext(data.session?.user.id);
      setLoading(false);
    })();

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    profile,
    roles,
    isBureau: roles.includes("ADMIN_BUREAU"),
    isPro,
    loading,
    rolesReady,
    refresh: async () => {
      await loadContext(session?.user.id);
    },
    signOut: async () => {
      if (session?.user.id) clearPrivateOffline(session.user.id);
      await supabase.auth.signOut();
      setProfile(null);
      setRoles([]);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
