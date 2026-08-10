import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";
import { friendlySupabaseError } from "@/lib/supabase/errorMessage";

interface AuthState {
  session: Session | null;
  /** True once the initial getSession() lookup has resolved (or immediately, when Supabase
   *  isn't configured) - lets UI avoid flashing a "signed out" state before the real session is
   *  known. */
  initialized: boolean;
  sendingLink: boolean;
  /** The email a magic link was just sent to, so the UI can show "check your inbox" - cleared on
   *  the next send attempt or sign-out. */
  linkSentTo: string | null;
  error: string | null;

  /** Subscribes to Supabase auth state once (safe to call from every page that needs session
   *  info - guarded by `initialized` so only the first call does anything). */
  init: () => void;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  initialized: false,
  sendingLink: false,
  linkSentTo: null,
  error: null,

  init: () => {
    if (get().initialized) return;
    set({ initialized: true }); // set synchronously first so concurrent init() calls don't race
    const supabase = getSupabaseClient();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => set({ session: data.session }));
    supabase.auth.onAuthStateChange((_event, session) => set({ session }));
  },

  signInWithEmail: async (email) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      set({ error: "Supabaseが設定されていません(NEXT_PUBLIC_SUPABASE_URL / ANON_KEYが未設定です)。" });
      return;
    }
    set({ sendingLink: true, error: null, linkSentTo: null });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    if (error) {
      set({ sendingLink: false, error: friendlySupabaseError(error) });
      return;
    }
    set({ sendingLink: false, linkSentTo: email });
  },

  signOut: async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ session: null, linkSentTo: null });
  },
}));
