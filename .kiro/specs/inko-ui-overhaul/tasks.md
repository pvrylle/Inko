# Implementation Plan: Inko UI/UX Overhaul

## Overview

Transform Inko into a Jarvis-style academic research assistant through eight sequential areas: typography fix, extended mascot state machine, nav redesign with persistent avatar, mascot overlay, home page session naming + feedback text, a new `/research` feature, a reframed Library page, and finally wiring everything together. All work targets the existing Next.js / React 19 / TypeScript codebase and Supabase data layer.

---

## Tasks

- [x] 1. Extend mascot state machine with `working` and `researching` presence states
  - [x] 1.1 Add `working` and `researching` to the `MascotPresence` union in `mascot-state.ts`
    - Extend `MascotPresence` type with `"working" | "researching"`
    - Add `RESEARCH_STARTED` and `WORK_STARTED` action types to `MascotAction`
    - Add reducer cases: `RESEARCH_STARTED` → `presence: "researching", message: "I'm comparing the evidence."`; `WORK_STARTED` → `presence: "working", message: action.label ?? "Working on it…"`
    - Update `REPLY_DONE` handler to also return from `working`/`researching` (already falls through to idle; verify no guard prevents it)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 1.2 Write property test for mascot state machine — `WORK_STARTED` label propagation (Property 3)
    - **Property 3: WORK_STARTED message follows label**
    - **Validates: Requirements 4.2, 4.3**

  - [x] 1.3 Write property test for mascot state machine — overlay visibility predicate (Property 4)
    - **Property 4: Overlay visibility matches presence**
    - **Validates: Requirements 5.1, 5.4**

  - [x] 1.4 Add `working` and `researching` body-motion variants to `inko-mascot.tsx`
    - Add `working: { y: [0, -4, 0], scale: [1, 1.02, 1], rotate: [-0.5, 0.5, -0.5] }` and `researching: { y: [0, -3, 0], scale: 1, rotate: [-1, 1, -1] }` to the `bodyMotion` object
    - _Requirements: 4.1_

- [x] 2. Checkpoint — Ensure mascot state machine tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement `NavMascotAvatar` compact nav component
  - [x] 3.1 Create `src/features/mascot/mascot-avatar.tsx`
    - Implement `NavMascotAvatar` that reads from `useMascot()`, renders a 36 × 36 px `InkoMascot`, and shows the correct Nav State Label beneath it (`presenceLabel` map covers all 8 `MascotPresence` values including the new two)
    - Component must be `aria-hidden="true"` and carry no click/keyboard handlers
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [x] 3.2 Write property test for `NavMascotAvatar` — label mapping (Property 2)
    - **Property 2: Mascot nav label maps presence correctly**
    - **Validates: Requirements 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

  - [x] 3.3 Add CSS for `.nav-mascot`, `.nav-mascot-sprite`, `.nav-mascot-inko`, `.nav-mascot-label` and presence-keyed colour overrides to `globals.css`
    - Scale the 260 px SVG down to 36 × 36 via `transform: scale(calc(36 / 260)); transform-origin: top left`
    - Add colour tokens for `[data-presence="listening"]`, `[data-presence="thinking"]`, `[data-presence="working"]`, `[data-presence="researching"]`, `[data-presence="speaking"]`
    - _Requirements: 3.9_

- [x] 4. Implement `MascotOverlay` full-screen component
  - [x] 4.1 Create `src/features/mascot/mascot-overlay.tsx`
    - Fixed-position overlay visible only when `presence ∈ { "working", "researching" }`, using `AnimatePresence` + `motion.div` for 300 ms fade-out
    - Render `InkoMascot` at minimum 200 × 200 px at centre, backdrop ≥ 40 % opacity, `aria-live="polite"` message region
    - `pointer-events: none` on the outer container so nav remains clickable
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 4.2 Write property test for overlay message round-trip (Property 5)
    - **Property 5: Overlay message round-trip**
    - **Validates: Requirements 5.3, 5.6**

  - [x] 4.3 Add CSS for `.mascot-overlay`, `.mascot-overlay-backdrop`, `.mascot-overlay-stage`, `.mascot-overlay-message` to `globals.css`
    - z-index ≥ 60, backdrop `rgba(21, 26, 75, 0.52)`, message card with `border-radius: 18px`
    - _Requirements: 5.1, 5.5_

- [x] 5. Update `AppShell` with new nav, `NavMascotAvatar`, and `MascotOverlay`
  - [x] 5.1 Replace the navigation array in `app-shell.tsx` with the seven required items
    - `Home /`, `Research /research`, `Library /library`, `Sources /sources`, `Notes /notes`, `Practice /practice`, `Pomodoro /pomodoro`
    - Import icons: `FlaskConical`, `Library`, `BookMarked`, `FileText`, `Dumbbell`, `Timer` from `lucide-react` (replace existing set)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 5.2 Write property test for nav active-state — `aria-current` follows pathname (Property 1)
    - **Property 1: Nav active state follows pathname**
    - **Validates: Requirements 2.4**

  - [x] 5.3 Mount `NavMascotAvatar` in the desktop sidebar (after `<nav>`, before `.progress-link`) and in the mobile nav (as a visually separate slot)
    - _Requirements: 3.1, 3.2_

  - [x] 5.4 Mount `MascotOverlay` as a sibling to `<main>` inside `.app-frame`
    - _Requirements: 5.1, 5.4_

- [x] 6. Checkpoint — Ensure nav and overlay render correctly; all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Home page session naming and Jarvis feedback
  - [x] 7.1 Create `src/features/home/session-name-form.tsx`
    - `SessionNameForm` client component: visible label, placeholder, `maxLength={120}`, `onSubmit` validation (empty/whitespace → inline `role="alert"` error), successful submit stores `name.trim()` to `sessionStorage["inko:session-name"]` and calls `router.push("/library")`
    - Show committed session name once submitted
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 7.2 Write property test for session name max-length constraint (Property 6)
    - **Property 6: Session name max-length constraint**
    - **Validates: Requirements 6.2**

  - [x] 7.3 Write property test for valid session name accepted and stored (Property 7)
    - **Property 7: Valid session name accepted and stored**
    - **Validates: Requirements 6.3, 6.4**

  - [x] 7.4 Write property test for whitespace session name rejected (Property 8)
    - **Property 8: Whitespace session name rejected**
    - **Validates: Requirements 6.5**

  - [x] 7.5 Create `src/features/home/home-feedback-text.tsx`
    - `HomeFeedbackText` reads `useMascot()` and renders the correct Jarvis-style string from the `feedbackText` map (all 8 presence values)
    - `aria-live="polite" aria-atomic="true"`
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 7.6 Write property test for home feedback text maps presence (Property 9)
    - **Property 9: Home feedback text maps presence**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.5, 7.6**

  - [x] 7.7 Update `home-orbit.tsx` to replace `VoicePaletteCard` with `SessionNameForm` and the static Jarvis prompt chips
    - Replace `VoicePaletteCard` with `SessionNameForm` (in `orbit-left` column)
    - Add `HomeFeedbackText` adjacent to the mascot stage in `orbit-center`
    - Add the static `jarvisPrompts` chip list (`"Can you explain this?"`, `"Research this topic, compare the studies, then make me a summary."`, `"What about this source?"`, `"Compare it with the previous one."`, `"Open my research on AI."`)
    - _Requirements: 6.1, 7.1, 7.7_

  - [x] 7.8 Apply typography guard to `globals.css` — add `text-transform: none` to `.home-copy h1`
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 8. Checkpoint — Ensure home page updates pass all tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Research feature — data layer
  - [x] 9.1 Create `src/features/research/research-schema.ts`
    - Define TypeScript types: `ResearchSession`, `ResearchSource`, `ResearchFinding`, `ResearchContradiction`, `OpenQuestion`, `CanvasNote`
    - Add `SourceTag = "supports" | "contradicts"`
    - Export `researchQuestionSchema` (Zod: `z.string().min(10).max(500)`)
    - _Requirements: 8.10, 8.12_

  - [x] 9.2 Write property test for research question length validation (Property 12)
    - **Property 12: Research question length validation**
    - **Validates: Requirements 8.10, 8.12**

  - [x] 9.3 Create `src/features/research/research-repository.ts`
    - Implement all CRUD functions following `notes-repository.ts` patterns: `listResearchSessions`, `createResearchSession`, `getResearchSession`, `subscribeToResearchSessions`, `listSources`, `createSource`, `deleteSource`, `listFindings`, `listContradictions`, `listOpenQuestions`, `getCanvasNote`, `upsertCanvasNote`
    - All queries scoped to `userId` (mirrors existing RLS pattern)
    - _Requirements: 8.2, 8.3, 8.5, 8.6, 8.7, 8.8, 8.11, 8.13, 8.14_

- [x] 10. Research feature — hook and UI components
  - [x] 10.1 Create `src/features/research/use-research.ts`
    - `useResearch()` hook returning the full `UseResearchReturn` shape: `sessions`, `activeSession`, `setActive`, `sources`, `findings`, `contradictions`, `openQuestions`, `canvasContent`, `saveCanvas`, `activeTab`, `setActiveTab`, `createSession`, `sessionError`, `loading`, `error`
    - Subscribe to realtime updates via `subscribeToResearchSessions`
    - _Requirements: 8.2, 8.3, 8.9, 8.11_

  - [x] 10.2 Write property test for research session sidebar ordering (Property 10)
    - **Property 10: Research session sidebar ordering**
    - **Validates: Requirements 8.2**

  - [x] 10.3 Write property test for new session appears and activates (Property 20)
    - **Property 20: Research new session appears in sidebar and activates**
    - **Validates: Requirements 8.11**

  - [x] 10.4 Create `src/features/research/research-session-form.tsx`
    - Form for creating a new research session; Zod-validated (10–500 chars); inline error on submit when invalid; calls `createSession()` on success
    - _Requirements: 8.10, 8.11, 8.12_

  - [x] 10.5 Create `src/features/research/research-sidebar.tsx`
    - Lists sessions ordered by `updated_at` desc; clicking a session calls `setActive(id)`; renders `ResearchSessionForm` for new sessions; empty state when no sessions
    - _Requirements: 8.2, 8.3, 8.9_

  - [x] 10.6 Write property test for research session selection shows correct question (Property 11)
    - **Property 11: Research session selection shows correct question**
    - **Validates: Requirements 8.3**

  - [x] 10.7 Create `src/features/research/research-tabs.tsx`
    - Tabbed interface with 7 tabs in order: Overview, Sources, Findings, Contradictions, Canvas, Notes, Open Questions
    - Sources tab: `SourceCard[]` (title, type indicator, Supports/Contradicts tag); Findings tab: statement + source attribution; Contradictions tab: source pairs + explanation; Canvas tab: `<textarea>` auto-saved; Notes tab: structured markdown; Open Questions tab: list
    - _Requirements: 8.4, 8.5, 8.6, 8.7, 8.8, 8.13, 8.14_

  - [x] 10.8 Write property test for research sources displayed with tag (Property 13)
    - **Property 13: Research sources displayed with tag**
    - **Validates: Requirements 8.5**

  - [x] 10.9 Create `src/features/research/research-view.tsx`
    - Composes `ResearchSidebar` + `ResearchTabs` (when session active) or empty state prompt (when no sessions)
    - _Requirements: 8.1, 8.9_

  - [x] 10.10 Create `src/app/research/page.tsx`
    - Route wrapper: `export const metadata = { title: "Research" }; export default function ResearchPage() { return <ResearchView />; }`
    - _Requirements: 8.1_

- [x] 11. Checkpoint — Ensure research feature tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Library page reframe — data layer
  - [x] 12.1 Create `src/features/library/library-schema.ts`
    - Define `LibraryClass` and `LibraryFile` TypeScript types
    - Add Zod schema for class name (1–80 chars)
    - Accepted file types: `.pdf`, `.doc`, `.docx`, `.txt`, `.md`
    - _Requirements: 9.1, 9.4_

  - [x] 12.2 Write property test for class name length constraint (Property 15)
    - **Property 15: Class name length constraint**
    - **Validates: Requirements 9.4**

  - [x] 12.3 Create `src/features/library/library-repository.ts`
    - Implement: `listClasses`, `createClass`, `deleteClass`, `listFiles`, `uploadFile` (Supabase Storage upload at `{owner_id}/{class_id}/{file_id}/{filename}` + `library_files` row insert), `deleteFile`
    - All queries scoped to `userId`; `uploadFile` enforces MIME type before calling storage
    - _Requirements: 9.1, 9.2, 9.5, 9.9_

- [x] 13. Library page reframe — hook and UI components
  - [x] 13.1 Create `src/features/library/use-library.ts`
    - `useLibrary()` hook returning `classes`, `files`, `createClass`, `uploadFile`, `deleteFile`, `loading`, `error`, `uploadError`
    - _Requirements: 9.2, 9.3, 9.5_

  - [x] 13.2 Create `src/features/library/class-group.tsx`
    - `ClassGroup` renders class name + file count header; empty indicator when zero files; `FileCard[]` children
    - `FileCard` shows file name, type badge, upload date, and class name; includes delete button that opens a `ConfirmDialog` before calling `deleteFile`
    - _Requirements: 9.3, 9.8, 9.9, 9.10_

  - [x] 13.3 Write property test for file grouping by class (Property 14)
    - **Property 14: File grouping by class**
    - **Validates: Requirements 9.2, 9.3**

  - [x] 13.4 Write property test for empty class shows indicator (Property 19)
    - **Property 19: Empty class shows indicator**
    - **Validates: Requirements 9.8**

  - [x] 13.5 Create `src/features/library/file-upload-zone.tsx`
    - `FileUploadZone` renders a file input with `accept=".pdf,.doc,.docx,.txt,.md"`, a class selector dropdown (or inline create-class form), and an upload button
    - On failure renders error banner with file name and reason
    - _Requirements: 9.1, 9.2, 9.5_

  - [x] 13.6 Write property test for upload failure surfaces file name and reason (Property 16)
    - **Property 16: Upload failure surfaces file name and reason**
    - **Validates: Requirements 9.5**

  - [x] 13.7 Write property test for uploaded file card shows all metadata (Property 17)
    - **Property 17: Uploaded file card shows all metadata**
    - **Validates: Requirements 9.10**

  - [x] 13.8 Create `src/features/library/library-view.tsx`
    - Compose `PageHeading`, `LibraryToolbar` (new class + upload buttons), `ClassGroup[]`, and empty state (`"Upload your first file to get started."`)
    - No voice-capture elements
    - _Requirements: 9.1, 9.3, 9.6, 9.7_

  - [x] 13.9 Update `src/app/library/page.tsx` to import `LibraryView` from `@/features/library/library-view` instead of the current `notes` library view
    - _Requirements: 9.1, 9.6_

- [x] 14. Checkpoint — Ensure library feature tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Wire sequential workflow messages through existing voice agent dispatch
  - [x] 15.1 Update the voice agent dispatch sites to emit `WORK_STARTED` and `RESEARCH_STARTED` actions at the appropriate workflow phases
    - Planning phase: dispatch `{ type: "WORK_STARTED", label: "Planning the approach." }`
    - Research phase: dispatch `{ type: "RESEARCH_STARTED" }` (message already set to `"I'm comparing the evidence."`)
    - Organising phase: dispatch `{ type: "WORK_STARTED", label: "Organising the findings." }`
    - Verify `THINKING` message at understanding phase reads `"Let me understand that."` (may require a new reducer case or TOOL_STARTED label)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [x] 15.2 Write property test for sequential workflow messages (Property 18)
    - **Property 18: Sequential workflow messages**
    - **Validates: Requirements 10.3, 10.4, 10.5, 10.6, 10.7**

- [x] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at sensible breaks
- Property tests validate universal correctness properties defined in the design; unit tests validate specific examples and edge cases
- The existing `src/features/notes/library-view.tsx` is left untouched — only `src/app/library/page.tsx` switches its import
- Supabase tables (`research_sessions`, `research_sources`, `research_findings`, `research_contradictions`, `research_open_questions`, `research_canvas`, `research_notes`, `library_classes`, `library_files`) and Storage bucket (`library-files`) must be provisioned before running the repository tasks; that migration work is outside the scope of these coding tasks

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["3.1", "4.1", "9.1", "12.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.2", "4.3", "9.2", "9.3", "12.2", "12.3"] },
    { "id": 4, "tasks": ["5.1", "7.1", "7.5", "10.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "5.4", "7.2", "7.3", "7.4", "7.6", "7.8", "10.2", "10.3", "13.1"] },
    { "id": 6, "tasks": ["7.7", "10.4", "10.5", "13.2"] },
    { "id": 7, "tasks": ["10.6", "10.7", "13.3", "13.4", "13.5"] },
    { "id": 8, "tasks": ["10.8", "10.9", "13.6", "13.7", "13.8"] },
    { "id": 9, "tasks": ["10.10", "13.9"] },
    { "id": 10, "tasks": ["15.1"] },
    { "id": 11, "tasks": ["15.2"] }
  ]
}
```
