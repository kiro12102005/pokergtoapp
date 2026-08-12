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

-- Shareable read-only hand links (/shared/[id]) - a record is only ever readable by a stranger
-- when its owner has explicitly flipped is_public to true (default false, i.e. private).
alter table public.hand_records add column if not exists is_public boolean not null default false;

create policy "hand_records_select_public"
  on public.hand_records for select
  using (is_public = true);

create policy "hand_records_update_own"
  on public.hand_records for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- "Reverse import": lets a user paste back an external chat AI's (ChatGPT/Gemini/Claude, ...)
-- reply about a hand - built from PromptCopyPanel's copied prompt - and tag it with leak
-- categories, turning a saved hand into an AI-assisted hand note. Edited after save via
-- hand_records_update_own above, same as is_public.
alter table public.hand_records add column if not exists ai_feedback text;
alter table public.hand_records add column if not exists tags text[] not null default '{}';

-- Weekly hand challenge (/challenge) - the operator posts one hand per week by hand, straight in
-- the SQL editor (see README), so there's no insert policy: it's created under the elevated
-- SQL-editor role, which bypasses RLS. Everything on this table is meant to be public content.
create table if not exists public.weekly_challenges (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  week_label text not null,
  title text not null,
  situation_summary text not null,
  choices text[] not null,
  correct_choice_index int not null,
  explanation text not null,
  is_active boolean not null default true
);

alter table public.weekly_challenges enable row level security;

create policy "weekly_challenges_select_all"
  on public.weekly_challenges for select
  using (true);

-- One response per user per challenge (see the unique constraint below) - the app upserts on
-- (challenge_id, user_id) so re-submitting just returns the original answer instead of erroring.
create table if not exists public.weekly_challenge_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  challenge_id uuid not null references public.weekly_challenges (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  choice_index int not null,
  is_correct boolean not null,
  unique (challenge_id, user_id)
);

alter table public.weekly_challenge_responses enable row level security;

create policy "weekly_challenge_responses_select_own"
  on public.weekly_challenge_responses for select
  using (auth.uid() = user_id);

create policy "weekly_challenge_responses_insert_own"
  on public.weekly_challenge_responses for insert
  with check (auth.uid() = user_id);

-- Public aggregate ("62% correct so far") without exposing who answered what or how - a Postgres
-- view runs as its owner by default (not the querying role), so this reads every row of the
-- RLS-protected table above while individual rows stay visible only to their own user via the
-- policies above. Needs an explicit grant since view privileges don't inherit from the base
-- table's RLS policies.
create or replace view public.weekly_challenge_stats as
  select challenge_id, count(*) as total, count(*) filter (where is_correct) as correct
  from public.weekly_challenge_responses
  group by challenge_id;

grant select on public.weekly_challenge_stats to anon, authenticated;
