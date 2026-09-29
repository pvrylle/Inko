"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, Flame, Layers3, Mic, Plus, RotateCcw, Sparkles, Square, Upload, Volume2 } from "lucide-react";
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
import { commitFlashcardReview, generateFlashcards } from "./flashcards-repository";
import { useFlashcards } from "./use-flashcards";
import { usePublishBrief } from "@/features/page-brief/page-brief";

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
    const synth = window.speechSynthesis;
    if (!practiceWithInko || !spokenLine || !synth) return;
    let cancelled = false;
    const utterance = new SpeechSynthesisUtterance(spokenLine);
    utterance.lang = "en-US";
    utterance.rate = 0.96;
    utterance.pitch = 1.12;
    utterance.onstart = () => { if (!cancelled) setReading(true); };
    utterance.onend = () => { if (!cancelled) setReading(false); };
    utterance.onerror = () => { if (!cancelled) setReading(false); };
    const begin = () => {
      if (cancelled) return;
      const voices = synth.getVoices();
      const voice = voices.find((item) => /samantha|aria|jenny|ana/i.test(item.name) && item.lang.toLowerCase().startsWith("en"))
        ?? voices.find((item) => item.lang.toLowerCase().startsWith("en"));
      if (voice) utterance.voice = voice;
      synth.cancel();
      synth.speak(utterance);
    };
    if (synth.getVoices().length > 0) begin();
    else synth.addEventListener("voiceschanged", begin, { once: true });
    return () => {
      cancelled = true;
      synth.removeEventListener("voiceschanged", begin);
      synth.cancel();
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
      <PageHeading eyebrow="Remember for longer" title="Flashcards" description="Pick a topic deck to review, or make a new one. Next moves through that deck, and Inko can read each card aloud." />

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
        <section className="deck-generator" aria-label="Create a flashcard deck">
          <div>
            <span className="deck-generator-icon"><Sparkles size={19} /></span>
            <div><h2>New deck</h2><p>Type a topic, paste notes, or record them. AssemblyAI turns the audio into cards.</p></div>
            <button className="secondary-button card-read-button" onClick={() => setMaking(false)} type="button">Cancel</button>
          </div>
          <div className="deck-generator-controls">
            <label className="topic-field">
              <span className="sr-only">Study topic</span>
              <input onChange={(event) => setTopic(event.target.value)} placeholder="Topic, e.g. mitosis checkpoints" value={topic} />
            </label>
            <label className="deck-source-field">
              <span className="sr-only">Notes to turn into cards</span>
              <textarea className="deck-source" maxLength={8000} onChange={(event) => { setSource(event.target.value); setSourceKind("text"); }} placeholder="Or paste notes, or record them below" rows={4} value={source} />
            </label>
            <div className="deck-voice-row">
              <button className="secondary-button" disabled={working !== null} onClick={() => recording ? stopRecording() : void startRecording()} type="button">
                {recording ? <Square size={15} /> : <Mic size={15} />}
                {recording ? "Stop and transcribe" : working === "transcribe" ? "Transcribing…" : "Record with AssemblyAI"}
              </button>
              <button className="secondary-button" disabled={working !== null || recording} onClick={() => audioInputRef.current?.click()} type="button"><Upload size={15} /> Upload audio</button>
              <input accept="audio/webm,audio/mp4,audio/ogg,.webm,.mp4,.m4a,.ogg" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void transcribeAudio(file); }} ref={audioInputRef} type="file" />
              <button className="primary-button" disabled={working !== null || recording} onClick={() => void createCards()} type="button">{working === "generate" ? "Creating deck…" : "Create deck"}</button>
            </div>
          </div>
        </section>
      ) : (
        <section aria-label="Choose a deck">
          {!loading && decks.length === 0 ? <EmptyState icon={Layers3} title="No decks yet" message="Create a deck from a topic, notes, or a recording." /> : null}
          <div className="deck-board">
            <button className="deck-pick" data-new="true" onClick={() => setMaking(true)} type="button">
              <span><Plus size={18} /></span>
              <strong>New deck</strong>
              <small>Topic, notes, or audio</small>
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
