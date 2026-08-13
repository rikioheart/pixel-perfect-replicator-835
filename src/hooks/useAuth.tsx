import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
};

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: string[];
  isBureau: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadContext = async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      setRoles([]);
      return;
    }
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("roles(code)").eq("user_id", userId),
    ]);
    setProfile((profileRes.data as Profile | null) ?? null);
    const codes = (rolesRes.data ?? [])
      .map((row) => (row as { roles: { code: string } | null }).roles?.code)
      .filter((code): code is string => Boolean(code));
    setRoles(codes);
  };

  useEffect(() => {
    let active = true;

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
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
    loading,
    refresh: async () => {
      await loadContext(session?.user.id);
    },
    signOut: async () => {
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
