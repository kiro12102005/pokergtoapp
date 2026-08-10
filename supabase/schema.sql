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
