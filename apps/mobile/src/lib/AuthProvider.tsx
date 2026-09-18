import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { ApprovalStatus } from "@tenantpay/shared";
import { supabase } from "./supabase";
import { registerPushToken } from "./registerPushToken";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  approvalStatus: ApprovalStatus | null;
}

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true, approvalStatus: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | null>(null);

  async function loadApprovalStatus(userId: string) {
    const { data } = await supabase.from("profiles").select("approval_status").eq("id", userId).single();
    setApprovalStatus(data?.approval_status ?? null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user.id) await loadApprovalStatus(data.session.user.id);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user.id) {
        registerPushToken(newSession.user.id);
        loadApprovalStatus(newSession.user.id);
      } else {
        setApprovalStatus(null);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, approvalStatus }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
