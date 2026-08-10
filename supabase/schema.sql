-- Hand analysis history. Run this once in the Supabase project's SQL editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run). See README for the full setup steps.

create table if not exists public.hand_records (
  id uuid primary key default gen_random_uuid(),
  -- Defaults to the inserting user so the client never needs to pass it explicitly (and can't
  -- accidentally insert a record under someone else's id) - see hand_records_insert_own below.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  memo text,
  -- The analyze page's input state at save time (position, stacks, board, action history, ...) -
  -- see src/domain/history/handRecord.ts's HandRecordSnapshot for the exact shape.
  snapshot jsonb not null,
  -- The AnalyzeResultDisplay[] this app computed for that snapshot.
  results jsonb not null,
  -- The buildExternalPrompt() output at save time, stored verbatim so a saved record's prompt
  -- doesn't drift if the prompt format changes later.
  external_prompt text not null
);

create index if not exists hand_records_user_id_created_at_idx
  on public.hand_records (user_id, created_at desc);

alter table public.hand_records enable row level security;

create policy "hand_records_select_own"
  on public.hand_records for select
  using (auth.uid() = user_id);

create policy "hand_records_insert_own"
  on public.hand_records for insert
  with check (auth.uid() = user_id);

create policy "hand_records_delete_own"
  on public.hand_records for delete
  using (auth.uid() = user_id);

-- Preflop trainer accuracy log (one row per solved quiz question) - powers /history/stats's
-- position-breakdown / trend view. Append-only: no update policy, and no delete policy either
-- (a user can still delete their whole account's data via Supabase support/auth if they ever
-- want to, but the app itself never needs to edit or remove individual attempts).
create table if not exists public.preflop_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  position text not null,
  effective_stack_bb numeric not null,
  action_history_key text not null,
  hand text not null,
  is_correct boolean not null
);

create index if not exists preflop_attempts_user_id_created_at_idx
  on public.preflop_attempts (user_id, created_at desc);

alter table public.preflop_attempts enable row level security;

create policy "preflop_attempts_select_own"
  on public.preflop_attempts for select
  using (auth.uid() = user_id);

create policy "preflop_attempts_insert_own"
  on public.preflop_attempts for insert
  with check (auth.uid() = user_id);
