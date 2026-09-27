# Inko

Inko is a mobile-first, voice-first AI study companion built with Next.js, Supabase, AssemblyAI Voice Agent, Gemini, and FSRS. It turns conversations and notes into structured notes, spaced-repetition flashcards, private-answer-key quizzes, persistent focus sessions, and owner-scoped progress.

## What is included

- Anonymous Supabase Auth with owner-scoped RLS and a no-credentials local demo fallback.
- Direct browser audio streaming to AssemblyAI; Inko/Supabase never persist raw audio.
- Gemini is the only reasoning model. AssemblyAI carries live audio and does not answer on its own.
- `ts-fsrs` scheduling with explicit student confirmation before a review advances.
- Multiple-choice quizzes whose hosted answer keys live in the private database schema.
- Timestamp-derived focus timers that survive reloads, pauses, and sleeping browser tabs.
- Ambient focus scenes, daily focus goal, and per-session history strip.
- Home "today so far" snapshot, streak, quiz accuracy, and mascot cycling tips.
- 7-day activity heatmap, achievements grid, flashcard flip animation, upcoming-review preview.
- Toast celebration system for milestones and completions.
- `plan_study_session` and `summarize_progress` voice tools for narrated coaching.
- Responsive desktop/mobile UI using the supplied Inko palette and animated SVG mascot.

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

Without Supabase variables the browser uses isolated localStorage demo data.

**Plan B (Gemini only):** set `GEMINI_API_KEY` (and optionally `GEMINI_API_KEY2` as backup). Browser dictation → chat, plus notes/flashcards/quizzes. If the primary key hits quota/rate limits, Inko retries with key 2 automatically. No AssemblyAI and no cron required.

**Plan A (later):** add `ASSEMBLYAI_API_KEY` + `ASSEMBLYAI_AGENT_ID` (and usually Supabase) for live voice. AssemblyAI carries the audio. Gemini answers. Ending a call deletes the provider session immediately.

## Environment variables

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Server only | Primary Gemini key — chat, dictation, notes, flashcards, quizzes, research, and live-voice reasoning. |
| `GEMINI_API_KEY2` | Server only | Optional backup Gemini key if the primary is rate-limited or exhausted. |
| `GEMINI_MODEL` | Server only | Defaults to `gemini-flash-latest`. |
| `ASSEMBLYAI_API_KEY` | Server only | **Plan A (optional)** live voice token + session deletion. |
| `ASSEMBLYAI_AGENT_ID` | Server only | **Plan A (optional)** provisioned Voice Agent ID. |
| `INKO_PUBLIC_URL` | Server only | Public https origin AssemblyAI calls for Gemini reasoning, for example `https://inko.example.com`. |
| `VOICE_BRAIN_SECRET` | Server only | Shared secret for `/api/voice/brain`. This is not the Gemini key. |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-visible | Optional Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-visible | Optional publishable/anon client key. |
| `SUPABASE_SECRET_KEY` | Server only | Optional atomic private quiz creation on hosted Supabase. Never prefix with `NEXT_PUBLIC_`. |

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

Put `ASSEMBLYAI_API_KEY` and `GEMINI_API_KEY` in `.env.local`. To keep the Gemini key on your server, also set `INKO_PUBLIC_URL` (an https origin AssemblyAI can reach) and `VOICE_BRAIN_SECRET`, then run:

```powershell
npm run voice:provision
```

The script creates an agent when `ASSEMBLYAI_AGENT_ID` is absent and updates that agent when it is present. With both public URL and brain secret set, the agent calls `/api/voice/brain` and never receives the Gemini key. Without them, the agent calls Gemini directly. Copy the emitted ID into local and Vercel environments, then rerun the command whenever tool definitions or the system prompt change.

## Deploy to Vercel

1. Import this repository into Vercel; the detected framework is Next.js and the build command is `npm run build`.
2. Add environment variables (at minimum `GEMINI_API_KEY`; add AssemblyAI, `INKO_PUBLIC_URL`, `VOICE_BRAIN_SECRET`, and Supabase when enabling live voice).
3. Apply Supabase migrations **before** deploying code that invokes new RPCs (only if using Supabase).
4. Optionally provision/update the AssemblyAI agent and set `ASSEMBLYAI_AGENT_ID`.
5. Deploy and verify Home, Library, Flashcards, Quiz, Focus, Progress, and mic fallback (or one live voice call when configured).

Deployment is one Vercel project. Without AssemblyAI, the mic uses browser dictation and Gemini chat. With AssemblyAI, browser audio goes to the agent, and Gemini writes the reply. Short authenticated API mutations run as Next.js functions. No long-running custom server is required.

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
- Audio streams directly from the browser to AssemblyAI when live voice is configured; otherwise the mic uses browser SpeechRecognition and Gemini chat.
- Ending a live voice call immediately requests deletion of the AssemblyAI provider session. Strict third-party zero-retention is not guaranteed by the Voice Agent API.
- Supabase RLS isolates records by anonymous user ID. Local demo storage is behavior simulation, not a security boundary; browser users can inspect local quiz keys.
- The in-process API rate limiter protects ordinary single-instance use, but high-scale production should add a distributed limiter or Vercel firewall rules.
- Progress streaks use UTC activity days and may continue when the latest activity was yesterday.

## Release notes and rollback

Database migrations are forward-only. Before production migration, back up the project and review SQL. If an application deploy must be rolled back, redeploy the previous Vercel build; do not reverse schema changes until dependencies and stored data have been assessed. Provider keys can be rotated independently, followed by a redeploy and voice-agent reprovision when applicable.
