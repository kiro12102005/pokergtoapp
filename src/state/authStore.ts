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
  verifyingCode: boolean;
  /** The email a magic link was just sent to, so the UI can show "check your inbox" - cleared on
   *  the next send attempt or sign-out. */
  linkSentTo: string | null;
  error: string | null;

  /** Subscribes to Supabase auth state once (safe to call from every page that needs session
   *  info - guarded by `initialized` so only the first call does anything). Also re-checks
   *  getSession() whenever the tab/PWA window regains focus - installed PWAs on Android share
   *  browser storage with the tab the emailed link actually opens in (usually the default
   *  browser, not the standalone app window itself), so a session created there only shows up
   *  here once this window re-reads storage; see verifyEmailCode() for the more reliable fix on
   *  platforms (iOS Home Screen apps) where that storage isn't shared at all. */
  init: () => void;
  signInWithEmail: (email: string) => Promise<void>;
  /** Completes sign-in from the 6-digit code Supabase's magic-link email also carries (once the
   *  project's email template includes {{ .Token }} - see AuthPanel.tsx), instead of the tapped
   *  link. Typing the code back into this already-open tab/PWA works even when the platform can't
   *  share storage with whatever browser context the link itself would open in. */
  verifyEmailCode: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  initialized: false,
  sendingLink: false,
  verifyingCode: false,
  linkSentTo: null,
  error: null,

  init: () => {
    if (get().initialized) return;
    set({ initialized: true }); // set synchronously first so concurrent init() calls don't race
    const supabase = getSupabaseClient();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => set({ session: data.session }));
    supabase.auth.onAuthStateChange((_event, session) => set({ session }));

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          supabase.auth.getSession().then(({ data }) => set({ session: data.session }));
        }
      });
    }
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

  verifyEmailCode: async (email, token) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    set({ verifyingCode: true, error: null });
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) {
      set({ verifyingCode: false, error: friendlySupabaseError(error) });
      return;
    }
    set({ verifyingCode: false, session: data.session, linkSentTo: null });
  },

  signOut: async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ session: null, linkSentTo: null });
  },
}));
