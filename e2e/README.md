# E2E tests (Playwright)

Run with `npm run test:e2e` (starts `npm run dev` automatically and reuses it if one is already
running on `http://localhost:3000` - see `playwright.config.ts`).

## Two specs, two trust levels

- **`public-flows.spec.ts`** - everything that works signed out, with no LLM API key saved. Runs
  anywhere, including CI with zero secrets: home page, nav, the analyze page's sample-hand ->
  GTO-block flow, the preflop trainer's exact-table quiz, the postflop trainer's "please set an
  API key" state, the dark-mode toggle, `/help`, `/updates`, `/history`'s signed-out state, and a
  nonexistent `/shared/[id]`'s not-found state.

- **`auth-flow.spec.ts`** - the one flow that needs a real Supabase session: save an analysis to
  history, turn sharing on, view the public `/shared/[id]` link from a separate unauthenticated
  browser context, then delete the record. This app only supports magic-link (OTP) sign-in - no
  password - so the spec uses the Supabase **Admin API** to generate a real magic-link for a
  disposable test user and navigates to it directly, exercising the app's actual auth callback
  handling instead of a parallel test-only login path. It creates the user in `beforeAll` and
  deletes it (cascading to whatever it saved) in `afterAll`.

## Running the auth-gated spec

It needs one thing the public spec doesn't: `SUPABASE_SERVICE_ROLE_KEY`. **Without it, the whole
spec is skipped** (not failed) - `public-flows.spec.ts` and `npm run test:e2e` both work fine on a
machine that doesn't have it.

To enable it locally:

1. Supabase dashboard -> your project -> **Settings -> API -> service_role secret**.
2. Add it to `.env.local` (or export it in your shell) as `SUPABASE_SERVICE_ROLE_KEY=...` -
   alongside the `NEXT_PUBLIC_SUPABASE_URL` the app already uses.
3. `npm run test:e2e` will now also run `auth-flow.spec.ts`.

**This key bypasses Row Level Security and can read/write/delete any row as any user - treat it
like a root password.** Never commit it, never put it in a client-exposed (`NEXT_PUBLIC_*`) env
var, and in CI store it as a masked secret. Since the spec creates and deletes its own disposable
test user (`e2e-<timestamp>-<random>@example.com`), it's safe to point this at a real project - it
doesn't touch any other user's data - but consider using a separate Supabase project for CI if
you'd rather keep test traffic fully isolated.
