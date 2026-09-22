# Design Document — Inko UI/UX Overhaul

## Overview

This document describes the technical architecture for transforming Inko into a Jarvis-style academic research assistant. The overhaul spans seven areas: typography token fixes, nav redesign with persistent mascot avatar, extended mascot state machine, full-screen mascot overlay, home page session naming, a brand-new `/research` feature, and a reframed Library page. All work is additive or in-place modification of the existing Next.js 16 / React 19 / TypeScript codebase.

---

## Architecture

### Component tree after the overhaul

```
AppProviders
└── MascotProvider          ← unchanged context; now carries working/researching
    └── AppShell            ← receives mascot state from context
        ├── DesktopSidebar
        │   ├── InkoLogo
        │   ├── NavLinks (7 items)
        │   └── NavMascotAvatar    ← NEW compact avatar + state label
        ├── MobileHeader
        ├── MobileNav
        │   ├── NavLinks (7 items)
        │   └── NavMascotAvatar    ← NEW compact avatar + state label
        ├── MascotOverlay          ← NEW fixed-position overlay (working/researching)
        └── <main>{children}
```

Pages and feature folders:

```
src/app/
  page.tsx                   ← home – session naming flow replaces VoicePaletteCard
  research/
    page.tsx                 ← NEW route
  library/
    page.tsx                 ← unchanged wrapper, reframed feature

src/features/
  home/
    home-orbit.tsx           ← updated: remove VoicePaletteCard, add SessionNameForm
    session-name-form.tsx    ← NEW
    home-feedback-text.tsx   ← NEW
  mascot/
    mascot-state.ts          ← extended with working/researching + new actions
    mascot-avatar.tsx        ← NEW compact nav avatar component
    mascot-overlay.tsx       ← NEW full-screen overlay component
  research/                  ← NEW feature folder
    research-view.tsx
    research-sidebar.tsx
    research-tabs.tsx
    research-session-form.tsx
    research-repository.ts
    research-schema.ts
    use-research.ts
  library/                   ← NEW feature folder (replaces src/features/notes for this page)
    library-view.tsx         ← rewritten file/class organiser
    library-repository.ts
    library-schema.ts
    use-library.ts
    class-group.tsx
    file-upload-zone.tsx
```

---

## Component Designs

### 1. Extended Mascot State Machine (`mascot-state.ts`)

The only change is additive: two new `MascotPresence` values and two new action types.

```typescript
// Extended types
export type MascotPresence =
  | "idle" | "listening" | "thinking" | "speaking"
  | "sleeping" | "error"
  | "working"       // NEW
  | "researching";  // NEW

export type MascotAction =
  // ... existing actions unchanged ...
  | { type: "RESEARCH_STARTED" }                 // NEW
  | { type: "WORK_STARTED"; label?: string };    // NEW

// Reducer additions (new cases only):
case "RESEARCH_STARTED":
  return { ...state, presence: "researching", message: "I'm comparing the evidence." };

case "WORK_STARTED":
  return { ...state, presence: "working", message: action.label ?? "Working on it…" };

// REPLY_DONE: existing handler already returns idle; no change needed.
// Working/researching both fall through to the same idle transition.
```

The `bodyMotion` object in `inko-mascot.tsx` needs two new entries:

```typescript
working:     { y: [0, -4, 0], scale: [1, 1.02, 1], rotate: [-0.5, 0.5, -0.5] },
researching: { y: [0, -3, 0], scale: 1, rotate: [-1, 1, -1] },
```

### 2. Compact Nav Mascot Avatar (`mascot-avatar.tsx`)

A new component that reads from `useMascot()` and renders a ≤ 36 × 36 px version of Inko plus a text label. It must be non-interactive in the nav position.

```typescript
// src/features/mascot/mascot-avatar.tsx
"use client";

import { useMascot } from "./mascot-provider";
import type { MascotPresence } from "./mascot-state";
import { InkoMascot } from "./inko-mascot";

const presenceLabel: Record<MascotPresence, string> = {
  idle:        "STANDBY",
  sleeping:    "STANDBY",
  error:       "STANDBY",
  listening:   "LISTENING",
  thinking:    "THINKING",
  speaking:    "SPEAKING",
  working:     "WORKING",
  researching: "RESEARCHING",
};

export function NavMascotAvatar() {
  const { state } = useMascot();
  return (
    <div className="nav-mascot" aria-hidden="true">
      <div className="nav-mascot-sprite">
        {/* InkoMascot with forced size via className; no interaction handlers */}
        <InkoMascot state={state} className="nav-mascot-inko" />
      </div>
      <span className="nav-mascot-label" data-presence={state.presence}>
        {presenceLabel[state.presence]}
      </span>
    </div>
  );
}
```

CSS additions in `globals.css`:

```css
.nav-mascot {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 14px;
  padding: 8px 0;
}

.nav-mascot-sprite {
  height: 36px;
  overflow: hidden;
  width: 36px;
}

/* Scale down the 260px SVG into the 36px box */
.nav-mascot-inko {
  height: 36px !important;
  transform: scale(calc(36 / 260));
  transform-origin: top left;
  width: 36px !important;
}

/* Alternative: use a dedicated small wrapper class */
.inko-mascot-wrap.nav-size {
  height: 36px;
  width: 36px;
}
.inko-mascot-wrap.nav-size .inko-svg {
  height: 36px;
  width: 36px;
}

.nav-mascot-label {
  color: var(--color-text-secondary);
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.1em;
  transition: color 160ms ease;
}

.nav-mascot-label[data-presence="listening"]   { color: var(--color-accent); }
.nav-mascot-label[data-presence="thinking"]    { color: var(--color-primary); }
.nav-mascot-label[data-presence="working"]     { color: var(--color-secondary); }
.nav-mascot-label[data-presence="researching"] { color: var(--color-coral-pink); }
.nav-mascot-label[data-presence="speaking"]    { color: var(--color-primary); }
```

### 3. Updated App Shell (`app-shell.tsx`)

Navigation array is replaced with the seven required items. `NavMascotAvatar` is added to both sidebar and mobile nav. `MascotOverlay` is conditionally rendered inside `AppShell`.

```typescript
// New navigation definition
import {
  FlaskConical, Home, Library, BookMarked,
  FileText, Dumbbell, Timer
} from "lucide-react";

const navigation = [
  { href: "/",          label: "Home",     icon: Home },
  { href: "/research",  label: "Research", icon: FlaskConical },
  { href: "/library",   label: "Library",  icon: Library },
  { href: "/sources",   label: "Sources",  icon: BookMarked },
  { href: "/notes",     label: "Notes",    icon: FileText },
  { href: "/practice",  label: "Practice", icon: Dumbbell },
  { href: "/pomodoro",  label: "Pomodoro", icon: Timer },
];
```

The sidebar renders `NavMascotAvatar` after `<nav>` and before `.progress-link`. The mobile nav renders it as an additional item (visually separate from the seven nav links — positioned above the tab bar or at an end slot depending on final CSS breakpoint decisions).

`MascotOverlay` renders as a sibling to `<main>` inside `.app-frame`:

```tsx
export function AppShell({ children }: { children: React.ReactNode }) {
  // ...existing code...
  return (
    <div className="app-frame">
      {/* ...existing sidebar/header/main... */}
      <MascotOverlay />
    </div>
  );
}
```

### 4. Mascot Overlay (`mascot-overlay.tsx`)

A fixed-position full-screen component that renders only when `presence` is `working` or `researching`. Uses `AnimatePresence` from `motion/react` for the fade-out transition.

```typescript
// src/features/mascot/mascot-overlay.tsx
"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMascot } from "./mascot-provider";
import { InkoMascot } from "./inko-mascot";

const OVERLAY_PRESENCES = new Set(["working", "researching"]);

export function MascotOverlay() {
  const { state, amplitude } = useMascot();
  const visible = OVERLAY_PRESENCES.has(state.presence);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="mascot-overlay"
          className="mascot-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          aria-modal="false"
          role="status"
        >
          <div className="mascot-overlay-backdrop" aria-hidden="true" />
          <div className="mascot-overlay-stage">
            <InkoMascot
              state={state}
              amplitude={amplitude}
              className="mascot-overlay-large"
            />
            <div
              className="mascot-overlay-message"
              aria-live="polite"
              aria-atomic="true"
            >
              {state.message}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

CSS:

```css
.mascot-overlay {
  align-items: center;
  display: flex;
  inset: 0;
  justify-content: center;
  pointer-events: none;   /* let clicks pass to nav if needed */
  position: fixed;
  z-index: 60;
}

.mascot-overlay-backdrop {
  background: rgba(21, 26, 75, 0.52);  /* > 40% opacity */
  inset: 0;
  position: absolute;
}

.mascot-overlay-stage {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 18px;
  position: relative;
  z-index: 1;
}

.mascot-overlay-large {
  height: 240px !important;
  width: 240px !important;
}

.inko-mascot-wrap.mascot-overlay-large {
  height: 240px;
  width: 240px;
}

.mascot-overlay-message {
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--color-border);
  border-radius: 18px;
  box-shadow: var(--shadow-soft);
  font-size: 15px;
  font-weight: 750;
  padding: 14px 22px;
}
```

### 5. Home Page Session Naming (`session-name-form.tsx`)

A new client component that manages the session name input, validation, and navigation. It sits inside `HomeOrbit` replacing `VoicePaletteCard`.

```typescript
// src/features/home/session-name-form.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const MAX_LENGTH = 120;

export function SessionNameForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [committed, setCommitted] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Please give your session a name.");
      return;
    }
    setError(null);
    setCommitted(name.trim());
    // Store in sessionStorage so downstream pages can read it
    sessionStorage.setItem("inko:session-name", name.trim());
    router.push("/library");
  };

  return (
    <div className="session-name-wrap">
      {committed ? (
        <p className="session-name-active">
          <span>Session:</span> <strong>{committed}</strong>
        </p>
      ) : (
        <form className="session-name-form" onSubmit={handleSubmit}>
          <label className="session-name-label" htmlFor="session-name">
            Name this session
          </label>
          <div className="session-name-field">
            <input
              id="session-name"
              maxLength={MAX_LENGTH}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              placeholder="e.g. Biology 101 – Cell division"
              type="text"
              value={name}
            />
            <button className="session-name-submit" type="submit">Start</button>
          </div>
          {error && (
            <p className="form-error" role="alert">{error}</p>
          )}
        </form>
      )}
    </div>
  );
}
```

Session name is persisted to `sessionStorage` under the key `"inko:session-name"`. This is intentionally ephemeral (clears when the browser tab closes) — it provides Inko context without requiring a database round-trip.

### 6. Home Page Feedback Text (`home-feedback-text.tsx`)

A small component that reads `MascotPresence` from context and shows the correct Jarvis-style message.

```typescript
// src/features/home/home-feedback-text.tsx
"use client";

import { useMascot } from "@/features/mascot/mascot-provider";
import type { MascotPresence } from "@/features/mascot/mascot-state";

const feedbackText: Record<MascotPresence, string> = {
  idle:        "What are we studying today?",
  sleeping:    "What are we studying today?",
  error:       "What are we studying today?",
  listening:   "I'm listening…",
  thinking:    "Let me investigate that.",
  working:     "Let me investigate that.",
  researching: "I'm comparing the evidence.",
  speaking:    "Here's what I found.",
};

export function HomeFeedbackText() {
  const { state } = useMascot();
  return (
    <p
      className="home-feedback-text"
      aria-live="polite"
      aria-atomic="true"
    >
      {feedbackText[state.presence]}
    </p>
  );
}
```

The Jarvis example command prompts are rendered as a static chip list inside an updated `home-orbit.tsx`:

```tsx
const jarvisPrompts = [
  "Can you explain this?",
  "Research this topic, compare the studies, then make me a summary.",
  "What about this source?",
  "Compare it with the previous one.",
  "Open my research on AI.",
];
```

### 7. Research Feature Folder

#### Data model (`research-schema.ts`)

```typescript
export type SourceTag = "supports" | "contradicts";

export type ResearchSession = {
  id: string;
  owner_id: string;
  question: string;
  created_at: string;
  updated_at: string;
};

export type ResearchSource = {
  id: string;
  session_id: string;
  owner_id: string;
  title: string;
  url: string | null;
  type: "document" | "url" | "file";
  tag: SourceTag;
  created_at: string;
};

export type ResearchFinding = {
  id: string;
  session_id: string;
  owner_id: string;
  statement: string;
  source_id: string | null;
  created_at: string;
};

export type ResearchContradiction = {
  id: string;
  session_id: string;
  owner_id: string;
  explanation: string;
  source_ids: string[];  // references two or more ResearchSource ids
  created_at: string;
};

export type OpenQuestion = {
  id: string;
  session_id: string;
  owner_id: string;
  text: string;
  created_at: string;
};

export type CanvasNote = {
  id: string;
  session_id: string;
  owner_id: string;
  content: string;
  updated_at: string;
};
```

#### Supabase tables

Five new tables required:

| Table | Key columns |
|---|---|
| `research_sessions` | `id`, `owner_id`, `question`, `created_at`, `updated_at` |
| `research_sources` | `id`, `session_id`, `owner_id`, `title`, `url`, `type`, `tag` |
| `research_findings` | `id`, `session_id`, `owner_id`, `statement`, `source_id` |
| `research_contradictions` | `id`, `session_id`, `owner_id`, `explanation`, `source_ids` |
| `research_open_questions` | `id`, `session_id`, `owner_id`, `text` |
| `research_canvas` | `id`, `session_id`, `owner_id`, `content`, `updated_at` |
| `research_notes` | `id`, `session_id`, `owner_id`, `content_markdown`, `updated_at` |

All tables use Supabase Row Level Security scoped to `auth.uid() = owner_id`.

#### Repository (`research-repository.ts`)

```typescript
// CRUD operations following the existing pattern from notes-repository.ts
export async function listResearchSessions(userId: string): Promise<ResearchSession[]>
export async function createResearchSession(userId: string, question: string): Promise<ResearchSession>
export async function getResearchSession(userId: string, sessionId: string): Promise<ResearchSession | null>
export function subscribeToResearchSessions(userId: string, onChange: () => void): () => void

export async function listSources(userId: string, sessionId: string): Promise<ResearchSource[]>
export async function createSource(userId: string, sessionId: string, source: Omit<ResearchSource, "id" | "owner_id" | "session_id" | "created_at">): Promise<ResearchSource>
export async function deleteSource(userId: string, sourceId: string): Promise<void>

export async function listFindings(userId: string, sessionId: string): Promise<ResearchFinding[]>
export async function listContradictions(userId: string, sessionId: string): Promise<ResearchContradiction[]>
export async function listOpenQuestions(userId: string, sessionId: string): Promise<OpenQuestion[]>
export async function getCanvasNote(userId: string, sessionId: string): Promise<CanvasNote | null>
export async function upsertCanvasNote(userId: string, sessionId: string, content: string): Promise<void>
```

#### Custom hook (`use-research.ts`)

```typescript
export function useResearch() {
  // Returns:
  // sessions: ResearchSession[]
  // activeSession: ResearchSession | null
  // setActiveSession: (id: string) => void
  // sources: ResearchSource[]
  // findings: ResearchFinding[]
  // contradictions: ResearchContradiction[]
  // openQuestions: OpenQuestion[]
  // canvasContent: string
  // setCanvasContent: (content: string) => void
  // activeTab: ResearchTab
  // setActiveTab: (tab: ResearchTab) => void
  // createSession: (question: string) => Promise<void>
  // loading: boolean
  // error: string | null
}

export type ResearchTab =
  | "overview" | "sources" | "findings"
  | "contradictions" | "canvas" | "notes" | "open-questions";
```

#### Research page route (`src/app/research/page.tsx`)

```typescript
import { ResearchView } from "@/features/research/research-view";
export const metadata = { title: "Research" };
export default function ResearchPage() {
  return <ResearchView />;
}
```

#### `ResearchView` component structure

```
ResearchView
├── ResearchSidebar
│   ├── SessionList (ordered by updated_at desc)
│   └── NewSessionButton → ResearchSessionForm (dialog/inline)
└── ResearchMain (when session selected)
    ├── ResearchHeader (research question as h1)
    └── ResearchTabs
        ├── Tab: Overview      → session metadata + summary stats
        ├── Tab: Sources       → SourceCard[] (title, type indicator, Supports/Contradicts tag)
        ├── Tab: Findings      → FindingEntry[] (statement + source attribution)
        ├── Tab: Contradictions → ContradictionGroup[] (source pairs + explanation)
        ├── Tab: Canvas        → <textarea> scoped to session, auto-saved to Supabase
        ├── Tab: Notes         → structured note markdown
        └── Tab: Open Questions → OpenQuestionItem[]
```

#### New session validation

The research question must be 10–500 characters. Validation is enforced both in the UI form (via `minLength` / `maxLength` HTML attributes and inline validation message on submit) and in the repository layer (Zod schema guard before the Supabase insert).

```typescript
// research-schema.ts
import { z } from "zod";
export const researchQuestionSchema = z.string().min(10).max(500);
```

### 8. Library Page Reframe (`src/features/library/`)

The existing `src/features/notes/library-view.tsx` is **not deleted** — it backs the Notes feature. The Library page at `/library` is redirected to the new `src/features/library/library-view.tsx`.

#### Data model (`library-schema.ts`)

```typescript
export type LibraryClass = {
  id: string;
  owner_id: string;
  name: string;           // 1–80 characters
  created_at: string;
};

export type LibraryFile = {
  id: string;
  owner_id: string;
  class_id: string;
  name: string;
  type: string;           // "pdf" | "doc" | "docx" | "txt" | "md"
  size_bytes: number;
  storage_path: string;
  upload_date: string;
  created_at: string;
};
```

#### Supabase tables

| Table | Key columns |
|---|---|
| `library_classes` | `id`, `owner_id`, `name` (1–80 chars, unique per owner), `created_at` |
| `library_files` | `id`, `owner_id`, `class_id`, `name`, `type`, `size_bytes`, `storage_path`, `upload_date` |

Files are stored in Supabase Storage bucket `library-files` with path `{owner_id}/{class_id}/{file_id}/{filename}`.

#### Accepted file types

```
.pdf, .doc, .docx, .txt, .md
```

Enforced via `accept=".pdf,.doc,.docx,.txt,.md"` on the file input and via MIME type check in the upload handler.

#### Repository (`library-repository.ts`)

```typescript
export async function listClasses(userId: string): Promise<LibraryClass[]>
export async function createClass(userId: string, name: string): Promise<LibraryClass>
export async function deleteClass(userId: string, classId: string): Promise<void>

export async function listFiles(userId: string): Promise<LibraryFile[]>
export async function uploadFile(userId: string, classId: string, file: File): Promise<LibraryFile>
export async function deleteFile(userId: string, file: LibraryFile): Promise<void>
```

#### `LibraryView` component structure

```
LibraryView
├── PageHeading (eyebrow="Your files", title="Library")
├── LibraryToolbar
│   ├── NewClassButton → inline name form (1–80 chars)
│   └── FileUploadButton → triggers file input
├── ClassGroup[] (one per LibraryClass)
│   ├── ClassHeader (name + file count, or "No files yet" indicator)
│   └── FileCard[] (name, type badge, upload date, class)
│       └── DeleteButton → ConfirmDialog
└── EmptyState (when no files) "Upload your first file to get started."
```

The upload flow:
1. User clicks "Upload file" → selects class from dropdown → picks file from file picker.
2. `uploadFile()` calls Supabase Storage `upload` then inserts the `library_files` row.
3. On success, list reloads and the new `FileCard` appears under the correct `ClassGroup`.
4. On failure, an error banner appears: `"Failed to upload '{filename}': {reason}"`.

Voice-capture elements are entirely absent from this new component. The old `library-view.tsx` in `src/features/notes/` remains unchanged.

### 9. Typography Fix (Home Page `<h1>`)

The only change is to `src/app/page.tsx`:

```tsx
// Before
<h1>Hey, I&apos;m <span>Inko!</span></h1>

// After — no change needed: the text is already "Hey, I'm Inko!"
// The fix is purely CSS: remove any text-transform: uppercase from .home-copy h1
```

In `globals.css`, `.home-copy h1` must not carry `text-transform: uppercase`. A quick audit of the existing CSS confirms no such rule is present on that selector. The token fix is therefore a guard: add an explicit reset to prevent accidental inheritance.

```css
.home-copy h1 {
  /* Existing tokens preserved */
  font-size: clamp(38px, 8vw, 64px);
  letter-spacing: -0.055em;
  line-height: 0.98;
  margin: 0;
  text-transform: none;  /* ADD: explicit guard against inheritance */
}
```

The heading renders with the same `font-size` and `font-weight` (`900`, inherited from `body`) as all other `<h1>` elements produced by `PageHeading`. No token change is needed beyond the guard.

---

## State Management for Cross-Page Mascot Presence

`MascotProvider` already wraps the entire application via `AppProviders` → `AppShell`. Because it is mounted once at the root level, `MascotState` is already global and cross-page. No additional state layer is required.

The new `NavMascotAvatar` and `MascotOverlay` both call `useMascot()` and receive the current state reactively. When the voice agent dispatches `RESEARCH_STARTED` or `WORK_STARTED`, all subscribed components (`MascotStage`, `NavMascotAvatar`, `MascotOverlay`, `HomeFeedbackText`) update within the same React render pass.

### Presence-to-label mapping centralisation

The mapping from `MascotPresence` to nav label (`presenceLabel`) lives in `mascot-avatar.tsx`. The mapping from `MascotPresence` to home-page feedback text (`feedbackText`) lives in `home-feedback-text.tsx`. Both are derived from the same `MascotPresence` type, so TypeScript exhaustive checks ensure completeness.

---

## Interface Contracts

### `NavMascotAvatar` props

No props — reads entirely from `useMascot()` context.

### `MascotOverlay` props

No props — reads entirely from `useMascot()` context.

### `SessionNameForm` props

No props — writes to `sessionStorage` and calls `useRouter()`.

### `HomeFeedbackText` props

No props — reads from `useMascot()` context.

### `ResearchView` props

No props — reads `userId` via Supabase auth hook (same pattern as `useNotes`).

### `useResearch()` return shape

```typescript
type UseResearchReturn = {
  sessions:       ResearchSession[];
  activeSession:  ResearchSession | null;
  setActive:      (id: string) => void;
  sources:        ResearchSource[];
  findings:       ResearchFinding[];
  contradictions: ResearchContradiction[];
  openQuestions:  OpenQuestion[];
  canvasContent:  string;
  saveCanvas:     (content: string) => Promise<void>;
  activeTab:      ResearchTab;
  setActiveTab:   (tab: ResearchTab) => void;
  createSession:  (question: string) => Promise<void>;
  sessionError:   string | null;
  loading:        boolean;
  error:          string | null;
};
```

---

## Error Handling

| Scenario | Handling |
|---|---|
| Session name is empty/whitespace | Inline `role="alert"` paragraph below input; no navigation |
| Research question < 10 chars or > 500 chars | Inline validation message; session not created |
| File upload fails | Error banner with file name + reason string; file list unchanged |
| Class name empty or > 80 chars | Inline validation; class not created |
| Supabase error in research repo | `error` state in `useResearch()` hook; rendered as `<p className="form-error">` |
| `RESEARCH_STARTED` / `WORK_STARTED` in overlay | `MascotOverlay` renders immediately; error recovery via existing `ERROR` action |
| Overlay during navigation | `MascotOverlay` persists because it is mounted in `AppShell` outside `<main>` |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Nav active state follows pathname

*For any* navigation item in the seven-item nav array, rendering `AppShell` with `pathname` equal to that item's `href` SHALL set `aria-current="page"` on exactly that nav link and no other nav link.

**Validates: Requirements 2.4**

---

### Property 2: Mascot nav label maps presence correctly

*For any* value of `MascotPresence`, when `AppShell` renders with that presence injected through `MascotContext`, the `NavMascotAvatar` SHALL display the text string defined in the `presenceLabel` map for that presence value, and SHALL NOT display the label for any other presence value.

**Validates: Requirements 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

---

### Property 3: WORK_STARTED message follows label

*For any* string `label`, dispatching `{ type: "WORK_STARTED", label }` to `mascotReducer` SHALL produce `presence = "working"` and `message = label`. Dispatching `{ type: "WORK_STARTED" }` with no label SHALL produce `message = "Working on it…"`.

**Validates: Requirements 4.2, 4.3**

---

### Property 4: Overlay visibility matches presence

*For any* `MascotPresence` value `p`, the `MascotOverlay` SHALL be present in the DOM if and only if `p ∈ { "working", "researching" }`.

**Validates: Requirements 5.1, 5.4**

---

### Property 5: Overlay message round-trip

*For any* non-empty message string `m`, when `mascotReducer` is in state `{ presence: "working", message: m }`, the `MascotOverlay` SHALL render `m` inside the `aria-live="polite"` region.

**Validates: Requirements 5.3, 5.6**

---

### Property 6: Session name max-length constraint

*For any* string of length greater than 120 characters, the `SessionNameForm` input SHALL NOT store more than 120 characters as the active session name.

**Validates: Requirements 6.2**

---

### Property 7: Valid session name accepted and stored

*For any* non-whitespace string `s` with `1 ≤ s.trim().length ≤ 120`, submitting `s` via `SessionNameForm` SHALL persist `s.trim()` to `sessionStorage` under key `"inko:session-name"` and SHALL call `router.push("/library")`.

**Validates: Requirements 6.3, 6.4**

---

### Property 8: Whitespace session name rejected

*For any* string `s` composed entirely of whitespace characters (including the empty string), submitting `s` via `SessionNameForm` SHALL display the validation message `"Please give your session a name."` and SHALL NOT call `router.push`.

**Validates: Requirements 6.5**

---

### Property 9: Home feedback text maps presence

*For any* value of `MascotPresence`, rendering `HomeFeedbackText` with that presence SHALL display exactly the feedback string defined in the `feedbackText` map for that presence value.

**Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6**

---

### Property 10: Research session sidebar ordering

*For any* list of `ResearchSession` objects with distinct `updated_at` timestamps, the `ResearchSidebar` SHALL render them in descending `updated_at` order (most recently updated first).

**Validates: Requirements 8.2**

---

### Property 11: Research session selection shows correct question

*For any* `ResearchSession` object `s`, clicking `s` in the `ResearchSidebar` SHALL cause the main area header to display exactly `s.question`.

**Validates: Requirements 8.3**

---

### Property 12: Research question length validation

*For any* string `q`, submitting `q` as a new research question SHALL create the session if and only if `10 ≤ q.length ≤ 500`; for all strings outside that range, the form SHALL display a validation message and SHALL NOT create the session.

**Validates: Requirements 8.10, 8.12**

---

### Property 13: Research sources displayed with tag

*For any* list of `ResearchSource` objects, when the Sources tab is active, each source SHALL render its `title`, `type` indicator, and `tag` (`"supports"` or `"contradicts"`).

**Validates: Requirements 8.5**

---

### Property 14: File grouping by class

*For any* list of `LibraryFile` objects with heterogeneous `class_id` values, the `LibraryView` SHALL group and render them so that every file appears under the `ClassGroup` whose `id` matches the file's `class_id`, and no file appears under any other group.

**Validates: Requirements 9.2, 9.3**

---

### Property 15: Class name length constraint

*For any* string `n`, submitting `n` as a new class name SHALL create the class if and only if `1 ≤ n.trim().length ≤ 80`; for strings outside that range, the form SHALL display a validation message and SHALL NOT create the class.

**Validates: Requirements 9.4**

---

### Property 16: Upload failure surfaces file name and reason

*For any* file name string `f` and error reason string `r`, when `uploadFile()` rejects with reason `r`, the `LibraryView` SHALL display an error message that contains both `f` and `r`.

**Validates: Requirements 9.5**

---

### Property 17: Uploaded file card shows all metadata

*For any* `LibraryFile` object `f`, after successful upload, the `FileCard` for `f` SHALL render `f.name`, `f.type` (as a badge), `f.upload_date`, and the name of the class `f.class_id` refers to.

**Validates: Requirements 9.10**

---

### Property 18: Sequential workflow messages

*For any* starting mascot state, dispatching the sequential actions `WORK_STARTED{ label: "Planning the approach." }` → `RESEARCH_STARTED` → `WORK_STARTED{ label: "Organising the findings." }` → `AGENT_AUDIO` → `REPLY_DONE` SHALL produce the messages `"Planning the approach."` → `"I'm comparing the evidence."` → `"Organising the findings."` → (speaking, unchanged message) → `"What should we do next?"` at each respective step.

**Validates: Requirements 10.3, 10.4, 10.5, 10.6, 10.7**

---

### Property 19: Empty class shows indicator

*For any* `LibraryClass` with zero associated `LibraryFile` objects, the `ClassGroup` component SHALL render the class name AND a visible indicator communicating that no files have been added.

**Validates: Requirements 9.8**

---

### Property 20: Research new session appears in sidebar and activates

*For any* valid research question string `q` (10–500 chars), calling `createSession(q)` SHALL add a new session to the `sessions` list AND set `activeSession` to that new session.

**Validates: Requirements 8.11**
