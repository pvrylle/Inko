# Requirements Document

## Introduction

This document specifies the requirements for a comprehensive UI/UX overhaul of Inko, transforming it from a general study companion into a Jarvis-style academic research assistant. The overhaul covers: fixing typography inconsistencies on the home page heading; redesigning the navigation bar with seven items plus a persistent compact Inko mascot avatar showing live state; reworking the home page with session naming and Jarvis-style voice-command prompts; introducing a brand-new `/research` page with session management, tabbed source analysis, and finding cards; reframing the Library page as a file/class organiser (removing voice-capture); extending the mascot state machine with `working` and `researching` presence states; and adding a Jarvis-style full-screen mascot overlay for active work states.

The implementation builds on the existing Next.js 16 / React 19 / TypeScript codebase, the `mascotReducer` state machine in `src/features/mascot/mascot-state.ts`, and the existing Supabase data layer.

---

## Glossary

- **App Shell**: The persistent layout component (`src/components/layout/app-shell.tsx`) that renders the desktop sidebar, mobile header, main content area, and mobile bottom nav.
- **Inko**: The AI mascot character rendered by `InkoMascot` and orchestrated by `mascotReducer`.
- **Mascot Avatar**: A compact, always-visible rendition of Inko (≤ 36 × 36 px) embedded in the navigation bar that reflects the current `MascotPresence` state.
- **MascotPresence**: The union type that describes Inko's current activity: `idle | listening | thinking | speaking | sleeping | error` (existing) plus `working | researching` (new).
- **Mascot Overlay**: A full-screen (or near-full-screen) modal-style panel that expands Inko's stage when `MascotPresence` is `working` or `researching`.
- **Research Session**: A persistent record of a single research task, storing the research question, associated sources, findings, contradictions, canvas notes, and open questions.
- **Source**: A document, URL, or file attached to a Research Session, tagged as either `supports` or `contradicts` relative to the research question.
- **Session Name**: A short user-supplied label (≤ 120 characters) that gives Inko context for a study or research session.
- **Library**: The `/library` page where users upload and organise academic files (PDFs, documents, class materials) grouped by class or subject.
- **Class**: A user-defined subject group (e.g. "Biology 101") used to organise files within the Library.
- **Nav State Label**: The capitalised text label displayed beneath or beside the Mascot Avatar in the nav bar, reflecting the current `MascotPresence` (e.g. `STANDBY`, `LISTENING`, `THINKING`, `WORKING`, `RESEARCHING`, `SPEAKING`).
- **Presence-to-Label Map**: The mapping from `MascotPresence` values to Nav State Labels: `idle` → `STANDBY`, `sleeping` → `STANDBY`, `listening` → `LISTENING`, `thinking` → `THINKING`, `working` → `WORKING`, `researching` → `RESEARCHING`, `speaking` → `SPEAKING`, `error` → `STANDBY`.

---

## Requirements

### Requirement 1 — Home Page Typography Fix

**User Story:** As a user, I want the home page heading to read "Hey, I'm Inko!" with correct sentence-case capitalisation, so that the interface feels polished and consistent.

#### Acceptance Criteria

1. THE App Shell SHALL render the home page `<h1>` text as `Hey, I'm Inko!` with only the first letter of the sentence capitalised and the brand name `Inko` capitalised.
2. WHEN the home page renders, THE App Shell SHALL apply the same heading font-weight and font-size token to `Hey, I'm Inko!` as is applied to all other level-1 page headings across the application.
3. THE App Shell SHALL NOT render the heading with mixed all-caps, all-lowercase, or word-case variants of `HEY`, `I'M`, or `INKO`.

---

### Requirement 2 — Navigation Bar Redesign

**User Story:** As a user, I want the navigation bar to list seven purposeful destinations — Home, Research, Library, Sources, Notes, Practice, Pomodoro — so that I can reach every major feature with one tap.

#### Acceptance Criteria

1. THE App Shell SHALL render exactly seven navigation items in the following order: Home (`/`), Research (`/research`), Library (`/library`), Sources (`/sources`), Notes (`/notes`), Practice (`/practice`), Pomodoro (`/pomodoro`).
2. WHEN the viewport width is 768 px or wider, THE App Shell SHALL display navigation items in the desktop sidebar in the specified order.
3. WHEN the viewport width is below 768 px, THE App Shell SHALL display navigation items in the bottom mobile nav bar in the specified order.
4. WHEN a navigation item's route matches the current pathname, THE App Shell SHALL set `aria-current="page"` on that nav link and apply the active visual style.
5. THE App Shell SHALL render each navigation item with a recognisable icon and a visible text label.

---

### Requirement 3 — Persistent Mascot Avatar in Navigation

**User Story:** As a user, I want to see a compact Inko avatar in the nav bar at all times across every page, so that I always know Inko's current state without navigating away.

#### Acceptance Criteria

1. THE App Shell SHALL render the Mascot Avatar in the desktop sidebar on every page without exception.
2. THE App Shell SHALL render the Mascot Avatar in the mobile bottom nav bar on every page without exception.
3. WHILE `MascotPresence` is `idle` or `sleeping` or `error`, THE App Shell SHALL display the Nav State Label `STANDBY` beneath the Mascot Avatar.
4. WHEN `MascotPresence` transitions to `listening`, THE App Shell SHALL update the Nav State Label to `LISTENING` within one animation frame.
5. WHEN `MascotPresence` transitions to `thinking`, THE App Shell SHALL update the Nav State Label to `THINKING` within one animation frame.
6. WHEN `MascotPresence` transitions to `working`, THE App Shell SHALL update the Nav State Label to `WORKING` within one animation frame.
7. WHEN `MascotPresence` transitions to `researching`, THE App Shell SHALL update the Nav State Label to `RESEARCHING` within one animation frame.
8. WHEN `MascotPresence` transitions to `speaking`, THE App Shell SHALL update the Nav State Label to `SPEAKING` within one animation frame.
9. THE Mascot Avatar SHALL have a maximum rendered size of 36 × 36 CSS pixels so that it does not displace other navigation items.
10. THE Mascot Avatar SHALL be non-interactive (no click or keyboard handler) when rendered in the compact nav position.

---

### Requirement 4 — Extended Mascot State Machine

**User Story:** As a developer, I want the mascot state machine to include `working` and `researching` presence states, so that the UI can reflect Inko's full Jarvis-style workflow.

#### Acceptance Criteria

1. THE Mascot State Machine SHALL include `working` and `researching` as valid `MascotPresence` values alongside the existing six values.
2. WHEN a `RESEARCH_STARTED` action is dispatched, THE Mascot State Machine SHALL transition `MascotPresence` to `researching` and set the message to `"I'm comparing the evidence."`.
3. WHEN a `WORK_STARTED` action is dispatched with an optional `label` string, THE Mascot State Machine SHALL transition `MascotPresence` to `working` and set the message to the provided label or to `"Working on it…"` if no label is provided.
4. WHEN a `REPLY_DONE` action is dispatched, THE Mascot State Machine SHALL transition from `working` or `researching` back to `idle` using the same message logic as the existing `REPLY_DONE` handler.
5. THE Mascot State Machine SHALL expose `MascotAction` types `RESEARCH_STARTED` and `WORK_STARTED` with the signatures `{ type: "RESEARCH_STARTED" }` and `{ type: "WORK_STARTED"; label?: string }`.

---

### Requirement 5 — Jarvis-Style Mascot Overlay

**User Story:** As a user, I want Inko to expand into a prominent full-screen overlay when actively working or researching, so that I have a clear visual signal that Inko is deeply engaged with my task.

#### Acceptance Criteria

1. WHEN `MascotPresence` is `working` or `researching`, THE App Shell SHALL render the Mascot Overlay above all other page content using a fixed-position layer with a z-index sufficient to cover the main content area.
2. WHILE the Mascot Overlay is visible, THE App Shell SHALL display a large-format `InkoMascot` component (minimum 200 × 200 CSS pixels) at the vertical and horizontal centre of the overlay.
3. WHILE the Mascot Overlay is visible, THE App Shell SHALL display the current mascot message text beneath the large-format `InkoMascot` component.
4. WHEN `MascotPresence` transitions away from `working` or `researching`, THE App Shell SHALL dismiss the Mascot Overlay with a fade-out animation of 300 ms or less.
5. WHILE the Mascot Overlay is visible, THE App Shell SHALL apply a semi-transparent backdrop (minimum 40 % opacity) over the main content area to focus attention on Inko.
6. THE Mascot Overlay SHALL include an accessible `aria-live="polite"` region that announces the current mascot message to screen readers.

---

### Requirement 6 — Home Page Session Naming

**User Story:** As a user, I want to name my study or research session on the home page so that Inko immediately understands my context and can guide me efficiently.

#### Acceptance Criteria

1. THE Home Page SHALL render a session-name input field with a visible label and placeholder text on initial load before any session name has been entered.
2. THE Home Page SHALL constrain the session-name input to a maximum of 120 characters.
3. WHEN the user submits a session name of at least 1 non-whitespace character, THE Home Page SHALL pass the session name to the Inko AI context as the active session label.
4. WHEN the session name is submitted, THE Home Page SHALL automatically navigate the user to `/library` so that Inko can guide them to organise relevant materials.
5. IF the user submits an empty or whitespace-only session name, THEN THE Home Page SHALL display an inline validation message reading `"Please give your session a name."` and SHALL NOT navigate away.
6. WHILE a valid session name exists for the current session, THE Home Page SHALL display the session name as the active context label visible on the home page.

---

### Requirement 7 — Home Page Jarvis-Style Voice Commands

**User Story:** As a user, I want the home page to showcase Jarvis-style command prompts and display contextual feedback text during each voice interaction state, so that I know what to say and what Inko is doing at all times.

#### Acceptance Criteria

1. THE Home Page SHALL display a curated set of example command prompts including at minimum: `"Can you explain this?"`, `"Research this topic, compare the studies, then make me a summary."`, `"What about this source?"`, `"Compare it with the previous one."`, and `"Open my research on AI."`.
2. WHEN `MascotPresence` is `listening`, THE Home Page SHALL display the feedback text `"I'm listening…"` adjacent to the mascot stage.
3. WHEN `MascotPresence` is `thinking`, THE Home Page SHALL display the feedback text `"Let me investigate that."` adjacent to the mascot stage.
4. WHEN `MascotPresence` is `researching`, THE Home Page SHALL display the feedback text `"I'm comparing the evidence."` adjacent to the mascot stage.
5. WHEN `MascotPresence` is `speaking`, THE Home Page SHALL display the feedback text `"Here's what I found."` adjacent to the mascot stage.
6. WHEN `MascotPresence` is `idle` or `sleeping`, THE Home Page SHALL display the default standby prompt `"What are we studying today?"` adjacent to the mascot stage.
7. THE Home Page SHALL update the displayed feedback text within one animation frame of a `MascotPresence` change.

---

### Requirement 8 — Research Page

**User Story:** As a researcher, I want a dedicated `/research` page where I can manage research sessions with source tracking, findings, contradictions, and open questions, so that I can conduct systematic academic research in one place.

#### Acceptance Criteria

1. THE Research Page SHALL be accessible at the route `/research`.
2. THE Research Page SHALL render a sidebar listing all saved Research Sessions ordered by most recently updated first.
3. WHEN the user selects a Research Session from the sidebar, THE Research Page SHALL display the selected session's research question as a prominent header in the main area.
4. THE Research Page SHALL render a tabbed interface in the main area with the following tabs in order: Overview, Sources, Findings, Contradictions, Canvas, Notes, Open Questions.
5. WHEN the user activates the Sources tab, THE Research Page SHALL display a list of Source cards, each showing the source title, type indicator, and a `Supports` or `Contradicts` tag relative to the research question.
6. WHEN the user activates the Findings tab, THE Research Page SHALL display a list of finding entries each containing a finding statement and the source attribution.
7. WHEN the user activates the Contradictions tab, THE Research Page SHALL display pairs or groups of contradicting Source cards with a brief explanation of the contradiction.
8. WHEN the user activates the Open Questions tab, THE Research Page SHALL display a list of unresolved questions generated from the session's research.
9. WHEN no Research Session exists, THE Research Page SHALL render an empty state with a prompt to start a new research session.
10. THE Research Page SHALL provide a control to create a new Research Session, accepting a research question of at least 10 and at most 500 characters.
11. WHEN a new Research Session is created with a valid research question, THE Research Page SHALL add the session to the sidebar and activate it as the selected session.
12. IF the research question submitted for a new Research Session is fewer than 10 characters or empty, THEN THE Research Page SHALL display a validation message and SHALL NOT create the session.
13. WHEN the user activates the Canvas tab, THE Research Page SHALL display a free-form text area for unstructured notes scoped to the active Research Session.
14. WHEN the user activates the Notes tab, THE Research Page SHALL display structured notes generated or saved for the active Research Session.

---

### Requirement 9 — Library Page Reframe

**User Story:** As a student, I want the Library page to be a place where I upload and organise my academic files by class or subject, so that I can keep my course materials structured and easily accessible.

#### Acceptance Criteria

1. THE Library Page SHALL render a file upload area that accepts PDF and common document formats (`.pdf`, `.doc`, `.docx`, `.txt`, `.md`).
2. WHEN the user uploads a file, THE Library Page SHALL associate the file with a user-selected or newly created Class.
3. THE Library Page SHALL display uploaded files grouped by their Class label.
4. THE Library Page SHALL provide a control to create a new Class with a name of at least 1 and at most 80 characters.
5. IF a file upload fails, THEN THE Library Page SHALL display an error message identifying the failed file by name and the reason for failure.
6. THE Library Page SHALL NOT render a voice-capture form, a "capture an idea" empty-state action button, or any UI element whose label or description references capturing voice ideas.
7. THE Library Page SHALL render an empty state with the message `"Upload your first file to get started."` and a file upload button WHEN no files have been uploaded.
8. WHEN a Class has no files, THE Library Page SHALL display the Class label with an indicator that no files have been added yet.
9. THE Library Page SHALL provide a control to delete an uploaded file, with a confirmation step before permanent removal.
10. WHEN a file is successfully uploaded, THE Library Page SHALL display the file name, file type badge, upload date, and the Class it belongs to.

---

### Requirement 10 — Mascot Sequential Workflow Feedback

**User Story:** As a user, I want Inko to display sequential status messages that reflect the Jarvis-style academic workflow (LISTEN → UNDERSTAND → PLAN → RESEARCH → ANALYZE → COMPARE → ORGANIZE → EXPLAIN → WAIT), so that I can follow Inko's progress on complex multi-step tasks.

#### Acceptance Criteria

1. WHEN Inko begins processing a complex multi-step command, THE Mascot State Machine SHALL dispatch presence transitions in the order: `listening` → `thinking` → `working` → `researching` → `working` → `speaking` → `idle`, advancing only as each phase completes.
2. WHEN `MascotPresence` is `thinking`, THE Mascot Stage SHALL display the message `"Let me understand that."` during the understanding phase.
3. WHEN `MascotPresence` transitions to `working` for the planning phase, THE Mascot Stage SHALL display the message `"Planning the approach."`.
4. WHEN `MascotPresence` transitions to `researching`, THE Mascot Stage SHALL display the message `"I'm comparing the evidence."`.
5. WHEN `MascotPresence` transitions to `working` for the organising phase, THE Mascot Stage SHALL display the message `"Organising the findings."`.
6. WHEN `MascotPresence` transitions to `speaking`, THE Mascot Stage SHALL display the message `"Here's what I found."`.
7. WHEN `MascotPresence` transitions back to `idle` after the full workflow, THE Mascot Stage SHALL display the message `"What should we do next?"`.
