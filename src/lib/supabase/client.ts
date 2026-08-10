import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when this deployment has Supabase configured at all - the history/login feature is
 *  entirely optional, so callers use this to show a "not set up" message instead of crashing
 *  when the env vars are absent (e.g. a fresh clone before the user creates a project). */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Created once and reused - matches the rest of this app's pattern of long-lived singletons
// (zustand stores) rather than re-instantiating a client per call.
let client: SupabaseClient | null = null;

/** Returns the shared Supabase browser client, or null when NEXT_PUBLIC_SUPABASE_URL /
 *  NEXT_PUBLIC_SUPABASE_ANON_KEY aren't set - see isSupabaseConfigured. Auth/session state is
 *  persisted to this browser's localStorage by the Supabase SDK itself, the same "stays on this
 *  device unless the user explicitly syncs via login" posture as apiKeyStore.ts. */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  return client;
}
