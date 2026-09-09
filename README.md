# Inko

Inko is a mobile-first, voice-first AI study companion built with Next.js, Supabase, AssemblyAI Voice Agent, Gemini, and FSRS. It turns conversations and notes into structured notes, spaced-repetition flashcards, private-answer-key quizzes, persistent focus sessions, and owner-scoped progress.

## What is included

- Anonymous Supabase Auth with owner-scoped RLS and a no-credentials local demo fallback.
- Direct browser audio streaming to AssemblyAI; Inko/Supabase never persist raw audio.
- Gemini-only note, flashcard, semantic grading, and quiz generation.
- `ts-fsrs` scheduling with explicit student confirmation before a review advances.
- Multiple-choice quizzes whose hosted answer keys live in the private database schema.
- Timestamp-derived focus timers that survive reloads, pauses, and sleeping browser tabs.
- Ambient focus scenes, daily focus goal, and per-session history strip.
- Home "today so far" snapshot, streak, quiz accuracy, and mascot cycling tips.
- 7-day activity heatmap, achievements grid, flashcard flip animation, upcoming-review preview.
- Toast celebration system for milestones and completions.
- `plan_study_session` and `summarize_progress` voice tools for narrated coaching.
- Responsive desktop/mobile UI using the supplied Inko palette and animated SVG mascot.
- Vercel-ready protected cron retries for provider-session cleanup.

## Prerequisites

- Node.js 22.12 or newer and npm.
- A Supabase project (or Supabase CLI/Docker for local database work).
- Gemini API and AssemblyAI accounts for AI/voice features.
- A Vercel project for managed deployment.

## Run locally

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Without Supabase variables the browser uses isolated localStorage demo data. Gemini-backed generation still needs `GEMINI_API_KEY`; live voice intentionally requires Supabase because voice sessions are owner-audited and cleaned up server-side.

## Environment variables

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-visible | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-visible | Publishable/anon client key. |
| `SUPABASE_SECRET_KEY` | Server only | Atomic private quiz creation and cleanup cron administration. Never prefix with `NEXT_PUBLIC_`. |
| `ASSEMBLYAI_API_KEY` | Server only | Temporary voice token issuance, provisioning, and provider-session deletion. |
| `ASSEMBLYAI_AGENT_ID` | Server only | Provisioned Inko Voice Agent ID. |
| `GEMINI_API_KEY` | Server only | Gemini generation. The provisioning script also sends this key to AssemblyAI's agent configuration so AssemblyAI can invoke Gemini's OpenAI-compatible endpoint. |
| `GEMINI_MODEL` | Server only | Defaults to `gemini-flash-latest`. |
| `CRON_SECRET` | Server only | Random 32+ character bearer secret for the cleanup cron. |

Restart local development or redeploy Vercel after changing environment variables.

## Supabase setup

1. Enable anonymous sign-ins in Supabase Auth.
2. Set the Site URL and allowed redirect URLs for localhost, Vercel Preview, and Production.
3. Apply migrations in order:

```powershell
supabase start
supabase db reset
supabase test db
```

For a hosted project, review migrations before applying:

```powershell
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migrations create owner RLS, private quiz keys, atomic flashcard/focus RPCs, realtime publications, Storage policies, and cleanup indexes. `supabase test db` runs the pgTAP policy/privilege assertions in `supabase/tests`. The checked-in database types are hand-maintained for this MVP; regenerate and review them after schema changes if your workflow uses the Supabase type generator.

## Provision the voice agent

Put `ASSEMBLYAI_API_KEY` and `GEMINI_API_KEY` in `.env.local`, then run:

```powershell
npm run voice:provision
```

The script creates an agent when `ASSEMBLYAI_AGENT_ID` is absent and updates that agent when it is present. Copy the emitted ID into local and Vercel environments, then rerun the command whenever tool definitions or the system prompt change.

## Deploy to Vercel

1. Import this repository into Vercel; the detected framework is Next.js and the build command is `npm run build`.
2. Add all hosted environment variables to Production and the desired Preview scopes.
3. Apply Supabase migrations **before** deploying code that invokes new RPCs.
4. Provision/update the AssemblyAI agent and set `ASSEMBLYAI_AGENT_ID`.
5. Deploy. `vercel.json` schedules `/api/cron/voice-cleanup` daily at 04:00 UTC.
6. Verify Home, Library, Flashcards, Quiz, Focus, Progress, anonymous Auth, one voice call, and the cron invocation logs.

Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` when that environment variable is configured. Use a random value of at least 16 characters; this project recommends 32+. See the official [Vercel Cron management documentation](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

Deployment is straightforward as one Vercel project: browser audio goes directly to AssemblyAI, while short authenticated API mutations run as Next.js functions and data persists in Supabase. No long-running custom server is required.

## Validation

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm run test:db       # requires a running local Supabase stack
npm run validate      # lint + typecheck + unit tests + production build
npm run validate:release  # validate + Playwright
```

Set `PLAYWRIGHT_BASE_URL` to run browser tests against a deployed Preview; otherwise Playwright starts the local app. In CI, build first because Playwright uses `next start`.

## Privacy and operational behavior

- Inko stores transcripts and study artifacts, not raw microphone audio.
- Audio streams directly from the browser to AssemblyAI.
- Ending a voice call immediately requests deletion of the AssemblyAI provider session. Failed/missing-ID deletions remain `deletion_pending`; the protected cron retries them and recovers stale active rows. Strict third-party zero-retention is not guaranteed by the Voice Agent API.
- Supabase RLS isolates records by anonymous user ID. Local demo storage is behavior simulation, not a security boundary; browser users can inspect local quiz keys.
- The in-process API rate limiter protects ordinary single-instance use, but high-scale production should add a distributed limiter or Vercel firewall rules.
- Progress streaks use UTC activity days and may continue when the latest activity was yesterday.

## Release notes and rollback

Database migrations are forward-only. Before production migration, back up the project and review SQL. If an application deploy must be rolled back, redeploy the previous Vercel build; do not reverse schema changes until dependencies and stored data have been assessed. Provider keys and `CRON_SECRET` can be rotated independently, followed by a redeploy and voice-agent reprovision when applicable.
