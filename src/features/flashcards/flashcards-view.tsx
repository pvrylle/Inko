"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, Flame, Layers3, Mic, Plus, RotateCcw, Square, Trash2, Upload, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { inkoFetch } from "@/lib/auth/api-client";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";
import { useMascot } from "@/features/mascot/mascot-provider";
import { generateNoteFromContent } from "@/features/notes/notes-repository";
import { useNotes } from "@/features/notes/use-notes";
import { useToasts } from "@/features/toast/toast-provider";
import { usesLocalStudyData } from "@/lib/data/local-study";
import { upsertLocalRecord } from "@/lib/data/local-store";
import type { Flashcard, Note, StudyRating } from "@/lib/data/models";
import { topicToNote } from "@/lib/study/topic-note";
import { commitFlashcardReview, createManualDeck, generateFlashcards } from "./flashcards-repository";
import { emptyDraftCard, filledDraftCards, starterDraftCards, type DraftCard } from "./manual-deck";
import { useFlashcards } from "./use-flashcards";
import { usePublishBrief } from "@/features/page-brief/page-brief";
import { speakInkoLine, stopInkoSpeech } from "@/features/voice/speak-text";

const ratings: { value: StudyRating; label: string; hint: string }[] = [
  { value: "again", label: "Again", hint: "Forgot" },
  { value: "hard", label: "Hard", hint: "Major effort" },
  { value: "good", label: "Good", hint: "Recalled" },
  { value: "easy", label: "Easy", hint: "Effortless" },
];


export function FlashcardsView() {
  const { notes } = useNotes();
  const { flashcards, loading, error, reload, userId } = useFlashcards();
  const { celebrate: mascotCelebrate, dispatch } = useMascot();
  const { celebrate } = useToasts();
  const [topic, setTopic] = useState("");
  const [drafts, setDrafts] = useState<DraftCard[]>(starterDraftCards);
  const [making, setMaking] = useState(false);
  const [reviewNoteId, setReviewNoteId] = useState<string | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [cardCursor, setCardCursor] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [practiceWithInko, setPracticeWithInko] = useState(false);
  const [reading, setReading] = useState(false);
  const [activeCardKey, setActiveCardKey] = useState<string | null>(null);
  const [sessionStreak, setSessionStreak] = useState(0);
  const [source, setSource] = useState("");
  const [sourceKind, setSourceKind] = useState<"text" | "voice">("text");
  const [recording, setRecording] = useState(false);
  const [working, setWorking] = useState<"generate" | "review" | "transcribe" | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const aliveRef = useRef(true);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [reviewClock, setReviewClock] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setReviewClock(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const decks = useMemo(() => {
    const groups = new Map<string, Flashcard[]>();
    for (const card of flashcards) {
      const list = groups.get(card.note_id) ?? [];
      list.push(card);
      groups.set(card.note_id, list);
    }
    return [...groups.entries()].map(([noteId, cards]) => {
      const note = notes.find((item) => item.id === noteId);
      const ordered = [...cards].sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
      return {
        noteId,
        title: note?.title || "Deck",
        cards: ordered,
        due: ordered.filter((card) => Date.parse(card.due) <= reviewClock).length,
      };
    });
  }, [flashcards, notes, reviewClock]);
  const activeCard = flashcards.find((card) => card.id === queue[cardCursor]) ?? null;
  const reviewDeck = decks.find((deck) => deck.noteId === reviewNoteId) ?? null;

  const flashBriefLabel = reviewDeck?.title || (topic.trim().length >= 8 ? topic.trim() : null);
  usePublishBrief(flashBriefLabel ? { kind: "flashcards", label: `Flashcards: ${flashBriefLabel.slice(0, 80)}`, detail: `The student is reviewing flashcards: ${flashBriefLabel}.` } : null);

  if ((activeCard?.id ?? null) !== activeCardKey) {
    setActiveCardKey(activeCard?.id ?? null);
    if (flipped) setFlipped(false);
  }

  const spokenLine = activeCard
    ? flipped
      ? `Answer. ${activeCard.back}${activeCard.explanation ? `. ${activeCard.explanation}` : ""}`
      : `Question. ${activeCard.front}`
    : "";

  useEffect(() => {
    if (!practiceWithInko || !spokenLine) return;
    let cancelled = false;
    setReading(true);
    void speakInkoLine(spokenLine).then(() => {
      if (!cancelled) setReading(false);
    });
    return () => {
      cancelled = true;
      stopInkoSpeech();
      setReading(false);
    };
  }, [practiceWithInko, spokenLine]);

  const resolveNote = async (): Promise<Note | null> => {
    const spoken = source.trim();
    const prompt = spoken.length >= 8 ? spoken : topic.trim();
    const kind = spoken.length >= 8 ? sourceKind : "text";
    if (prompt.length >= 8 && userId) {
      if (await usesLocalStudyData()) {
        const note = topicToNote(userId, prompt, kind);
        upsertLocalRecord("notes", userId, note);
        return note;
      }
      return generateNoteFromContent(userId, prompt, kind);
    }
    return null;
  };

  const openDeck = (noteId: string, cards: Flashcard[]) => {
    setMaking(false);
    setReviewNoteId(noteId);
    setQueue(cards.map((card) => card.id));
    setCardCursor(0);
    setFlipped(false);
    setPracticeWithInko(false);
  };

  const leaveReview = () => {
    setReviewNoteId(null);
    setQueue([]);
    setCardCursor(0);
    setFlipped(false);
    setPracticeWithInko(false);
  };

  const transcribeAudio = async (audio: Blob) => {
    setWorking("transcribe");
    setFormError(null);
    try {
      const mimeType = audio.type.split(";")[0]?.toLowerCase() || "audio/webm";
      const extension = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
      const form = new FormData();
      form.set("audio", audio, `notes.${extension}`);
      const response = await inkoFetch("/api/voice/transcribe", { method: "POST", body: form });
      const payload = (await response.json()) as { text?: string; error?: string };
      if (!aliveRef.current) return;
      if (!response.ok || !payload.text?.trim()) {
        const code = payload.error;
        setFormError(code === "RATE_LIMITED" ? "Voice transcription is rate limited right now. Type your notes instead." : code === "UNSUPPORTED_AUDIO" ? "Use a WebM, MP4, or Ogg recording." : "AssemblyAI couldn't transcribe that audio. Try again or type your notes.");
        return;
      }
      setSource(payload.text.trim().slice(0, 8000));
      setSourceKind("voice");
    } catch {
      if (aliveRef.current) setFormError("AssemblyAI couldn't transcribe that audio. Try again or type your notes.");
    } finally {
      if (aliveRef.current) setWorking(null);
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") recorder.stop();
    setRecording(false);
  };

  const startRecording = async () => {
    if (!window.MediaRecorder) {
      setFormError("This browser cannot record audio. Type your notes or upload a file.");
      return;
    }
    setFormError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (streamRef.current === stream) streamRef.current = null;
        recorderRef.current = null;
        if (aliveRef.current) setRecording(false);
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (!aliveRef.current || blob.size === 0) return;
        void transcribeAudio(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setFormError("Microphone access was blocked. Allow it, or type your notes.");
    }
  };

  const createCards = async () => {
    if (!userId) return;
    setWorking("generate");
    setFormError(null);
    try {
      const note = await resolveNote();
      if (!note) {
        setFormError("Type a topic or paste notes, then choose Create deck.");
        return;
      }
      const generatedCards = await generateFlashcards(userId, note);
      await reload();
      setReviewClock((current) => Math.max(current, ...generatedCards.map((card) => Date.parse(card.due))));
      openDeck(note.id, generatedCards);
      setTopic("");
      setSource("");
      mascotCelebrate("Your new cards are ready!");
      celebrate("Deck ready", `${generatedCards.length} card${generatedCards.length === 1 ? "" : "s"} from ${note.title}`);
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "FLASHCARD_GENERATION_FAILED";
      setFormError(code === "GUEST_LIMIT" ? "You've used today's guest study limit. Sign in to keep going." : code === "GEMINI_NOT_CONFIGURED" ? "Add GEMINI_API_KEY to generate flashcards with Inko." : "Inko couldn't make those cards. Please try again.");
    } finally {
      setWorking(null);
    }
  };

  const createManualCards = async () => {
    if (!userId) return;
    const cards = filledDraftCards(drafts);
    const title = topic.trim().slice(0, 160) || cards[0]?.front.slice(0, 80) || "Flashcards";
    if (cards.length === 0) {
      setFormError("Add a term and a definition on at least one card.");
      return;
    }
    setWorking("generate");
    setFormError(null);
    try {
      const created = await createManualDeck(userId, title, cards);
      await reload();
      setReviewClock((current) => Math.max(current, ...created.cards.map((card) => Date.parse(card.due))));
      openDeck(created.note.id, created.cards);
      setTopic("");
      setSource("");
      setDrafts(starterDraftCards());
      mascotCelebrate("Your new cards are ready!");
      celebrate("Deck ready", `${created.cards.length} card${created.cards.length === 1 ? "" : "s"}`);
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "FLASHCARD_SAVE_FAILED";
      setFormError(code === "AUTH_REQUIRED" ? "Sign in to save this deck." : code === "RATE_LIMITED" ? "Give it a moment, then save again." : "Those cards could not be saved. Please try again.");
    } finally {
      setWorking(null);
    }
  };

  const updateDraft = (id: string, field: "front" | "back", value: string) => {
    setDrafts((current) => current.map((card) => card.id === id ? { ...card, [field]: value } : card));
  };

  const addDraft = () => setDrafts((current) => current.length >= 40 ? current : [...current, emptyDraftCard()]);

  const removeDraft = (id: string) => {
    setDrafts((current) => current.length === 1 ? current : current.filter((card) => card.id !== id));
  };

  const confirmRating = async (rating: StudyRating) => {
    if (!userId || !activeCard) return;
    setWorking("review");
    setFormError(null);
    try {
      const result = await commitFlashcardReview(userId, activeCard, rating, "", null);
      setFlipped(false);
      setCardCursor((index) => Math.min(queue.length - 1, index + 1));
      await reload();
      setReviewClock(Date.parse(result.review.reviewed_at));
      if (rating === "good" || rating === "easy") {
        const nextStreak = sessionStreak + 1;
        setSessionStreak(nextStreak);
        mascotCelebrate(rating === "easy" ? "That one is sticking!" : "Nice recall!");
        if (nextStreak > 0 && nextStreak % 5 === 0) celebrate("Five in a row", "That is what fluency starts to feel like.");
      } else {
        setSessionStreak(0);
        dispatch({ type: "ENCOURAGE", message: rating === "again" ? "No worries — we'll see it again soon." : "Effort builds memory." });
      }
    } catch {
      setFormError("That review wasn't saved. Your schedule has not been advanced.");
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="content-page page-enter">
      <PageHeading eyebrow="Remember for longer" title="Flashcards" description="Pick a deck to review, or create a set the Gizmo way: title, then a term and definition on each card." />

      {(error || formError) && <p className="form-error flashcard-error" role="alert">{formError || error}</p>}

      {reviewNoteId && activeCard ? (
        <section className="review-session" aria-label="Flashcard review">
          <div className="review-progress">
            <button className="secondary-button card-read-button" onClick={leaveReview} type="button"><ArrowLeft size={14} /> Decks</button>
            <div className="review-progress-meta">
              <strong>{reviewDeck?.title}</strong>
              <span>{cardCursor + 1} of {queue.length}</span>
              <button aria-pressed={practiceWithInko} className="secondary-button card-read-button" onClick={() => setPracticeWithInko((on) => !on)} type="button">
                {practiceWithInko ? <Square size={14} /> : <Volume2 size={14} />}
                {practiceWithInko ? "Stop Inko" : "Practice with Inko"}
              </button>
              {sessionStreak > 1 && <span className="streak-chip"><Flame size={13} /> {sessionStreak} in a row</span>}
            </div>
          </div>
          <div className="flashcard-flip" data-flipped={flipped}>
            <article className="flashcard-face flashcard-front" aria-hidden={flipped}>
              <span className="card-side-label">Question</span>
              <h2>{activeCard.front}</h2>
              <button className="flip-hint" onClick={() => setFlipped(true)} type="button"><RotateCcw size={13} /> Peek at the answer</button>
            </article>
            <article className="flashcard-face flashcard-back" aria-hidden={!flipped}>
              <span className="card-side-label">Answer</span>
              <p>{activeCard.back}</p>
              {activeCard.explanation && <small>{activeCard.explanation}</small>}
              <button className="flip-hint" onClick={() => setFlipped(false)} type="button"><RotateCcw size={13} /> Back to question</button>
            </article>
          </div>
          <div className="card-nav">
            <button className="secondary-button" disabled={cardCursor === 0} onClick={() => { setCardCursor((index) => Math.max(0, index - 1)); setFlipped(false); }} type="button"><ChevronLeft size={16} /> Previous</button>
            <button className="primary-button" disabled={cardCursor >= queue.length - 1} onClick={() => { setCardCursor((index) => Math.min(queue.length - 1, index + 1)); setFlipped(false); }} type="button">Next <ChevronRight size={16} /></button>
          </div>
          {reading ? <p className="card-read-status" role="status">Inko is reading this card.</p> : null}
          <p className="rating-prompt">How well did you remember it?</p>
          <div className="rating-grid">
            {ratings.map((rating) => <button key={rating.value} className="rating-button" disabled={working !== null} onClick={() => void confirmRating(rating.value)} type="button"><strong>{rating.label}</strong><small>{rating.hint}</small></button>)}
          </div>
        </section>
      ) : making ? (
        <section className="gizmo-deck" aria-label="Create a flashcard deck">
          <div className="gizmo-deck-head">
            <div>
              <h2>Create a set</h2>
              <p>Add a title, then type a term and definition on each card.</p>
            </div>
            <div className="gizmo-deck-actions">
              <button className="secondary-button card-read-button" onClick={() => { setMaking(false); setDrafts(starterDraftCards()); }} type="button">Cancel</button>
              <button className="primary-button" disabled={working !== null || recording} onClick={() => void createManualCards()} type="button">{working === "generate" && filledDraftCards(drafts).length > 0 ? "Saving…" : "Create"}</button>
            </div>
          </div>
          <label className="gizmo-title">
            <span>Title</span>
            <input maxLength={160} onChange={(event) => setTopic(event.target.value)} placeholder="Enter a title, like “Biology — Chapter 22”" value={topic} />
          </label>
          <ol className="gizmo-card-list">
            {drafts.map((card, index) => (
              <li className="gizmo-card" key={card.id}>
                <div className="gizmo-card-bar">
                  <span>{index + 1}</span>
                  <button aria-label={`Remove card ${index + 1}`} className="gizmo-card-remove" disabled={drafts.length === 1} onClick={() => removeDraft(card.id)} type="button"><Trash2 size={16} /></button>
                </div>
                <div className="gizmo-card-fields">
                  <label>
                    <textarea maxLength={1000} onChange={(event) => updateDraft(card.id, "front", event.target.value)} placeholder="Enter term" rows={3} value={card.front} />
                    <span>TERM</span>
                  </label>
                  <label>
                    <textarea
                      maxLength={4000}
                      onChange={(event) => updateDraft(card.id, "back", event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey && index === drafts.length - 1) {
                          event.preventDefault();
                          addDraft();
                        }
                      }}
                      placeholder="Enter definition"
                      rows={3}
                      value={card.back}
                    />
                    <span>DEFINITION</span>
                  </label>
                </div>
              </li>
            ))}
          </ol>
          <button className="gizmo-add-card" disabled={drafts.length >= 40} onClick={addDraft} type="button"><Plus size={18} /> Add card</button>
          <details className="gizmo-generate">
            <summary>Or make cards from notes or audio</summary>
            <p>Paste notes or record them. Inko turns that into a deck.</p>
            <textarea className="deck-source" maxLength={8000} onChange={(event) => { setSource(event.target.value); setSourceKind("text"); }} placeholder="Paste notes here" rows={4} value={source} />
            <div className="deck-voice-row">
              <button className="secondary-button" disabled={working !== null} onClick={() => recording ? stopRecording() : void startRecording()} type="button">
                {recording ? <Square size={15} /> : <Mic size={15} />}
                {recording ? "Stop and transcribe" : working === "transcribe" ? "Transcribing…" : "Record with AssemblyAI"}
              </button>
              <button className="secondary-button" disabled={working !== null || recording} onClick={() => audioInputRef.current?.click()} type="button"><Upload size={15} /> Upload audio</button>
              <input accept="audio/webm,audio/mp4,audio/ogg,.webm,.mp4,.m4a,.ogg" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void transcribeAudio(file); }} ref={audioInputRef} type="file" />
              <button className="primary-button" disabled={working !== null || recording} onClick={() => void createCards()} type="button">{working === "generate" ? "Creating deck…" : "Generate with Inko"}</button>
            </div>
          </details>
        </section>
      ) : (
        <section aria-label="Choose a deck">
          {!loading && decks.length === 0 ? <EmptyState icon={Layers3} title="No decks yet" message="Create a set by typing a term and a definition on each card." /> : null}
          <div className="deck-board">
            <button className="deck-pick" data-new="true" onClick={() => { setDrafts(starterDraftCards()); setMaking(true); }} type="button">
              <span><Plus size={18} /></span>
              <strong>New deck</strong>
              <small>Term and definition</small>
            </button>
            {decks.map((deck) => (
              <button className="deck-pick" key={deck.noteId} onClick={() => openDeck(deck.noteId, deck.cards)} type="button">
                <span><Layers3 size={18} /></span>
                <strong>{deck.title}</strong>
                <small>{deck.cards.length} card{deck.cards.length === 1 ? "" : "s"}{deck.due > 0 ? ` · ${deck.due} due` : ""}</small>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
