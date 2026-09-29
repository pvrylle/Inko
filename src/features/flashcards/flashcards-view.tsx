"use client";

import { Brain, CalendarClock, CheckCircle2, Flame, Layers3, Mic, RotateCcw, Sparkles, Square, Upload, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { inkoFetch } from "@/lib/auth/api-client";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";
import { useMascot } from "@/features/mascot/mascot-provider";
import { generateNoteFromContent } from "@/features/notes/notes-repository";
import { useNotes } from "@/features/notes/use-notes";
import { useToasts } from "@/features/toast/toast-provider";
import { PageVoiceControl } from "@/features/voice/page-voice-control";
import { usesLocalStudyData } from "@/lib/data/local-study";
import { upsertLocalRecord } from "@/lib/data/local-store";
import type { Flashcard, Note, StudyRating } from "@/lib/data/models";
import { topicToNote } from "@/lib/study/topic-note";
import { commitFlashcardReview, generateFlashcards } from "./flashcards-repository";
import { useFlashcards } from "./use-flashcards";

const ratings: { value: StudyRating; label: string; hint: string }[] = [
  { value: "again", label: "Again", hint: "Forgot" },
  { value: "hard", label: "Hard", hint: "Major effort" },
  { value: "good", label: "Good", hint: "Recalled" },
  { value: "easy", label: "Easy", hint: "Effortless" },
];

function nextDueDescription(card: Flashcard, now: number) {
  const diffMs = Date.parse(card.due) - now;
  if (diffMs <= 0) return "Due now";
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `Due in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Due in ${hours}h`;
  const days = Math.round(hours / 24);
  return `Due in ${days}d`;
}

export function FlashcardsView() {
  const { notes, loading: notesLoading } = useNotes();
  const { flashcards, loading, error, reload, userId } = useFlashcards();
  const { celebrate: mascotCelebrate, dispatch } = useMascot();
  const { celebrate } = useToasts();
  const [deckChoice, setDeckChoice] = useState("new");
  const [topic, setTopic] = useState("");
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
  const [todayEndsAt] = useState(() => {
    const date = new Date();
    date.setHours(23, 59, 59, 999);
    return date.getTime();
  });

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

  const dueCards = useMemo(() => flashcards.filter((card) => Date.parse(card.due) <= reviewClock), [flashcards, reviewClock]);
  const upcomingCards = useMemo(
    () => flashcards.filter((card) => Date.parse(card.due) > reviewClock).sort((a, b) => Date.parse(a.due) - Date.parse(b.due)).slice(0, 4),
    [flashcards, reviewClock],
  );
  const activeCard = dueCards[0] ?? null;
  const selectedNote = notes.find((note) => note.id === deckChoice) ?? null;
  const dueToday = flashcards.filter((card) => Date.parse(card.due) <= todayEndsAt).length;
  const learning = flashcards.filter((card) => card.state === 1 || card.state === 3).length;
  const mastered = flashcards.filter((card) => card.state === 2 && card.stability >= 21).length;
  const masteredPercent = flashcards.length ? Math.round((mastered / flashcards.length) * 100) : 0;

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
    return deckChoice === "new" ? null : selectedNote;
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
      <PageHeading eyebrow="Remember for longer" title="Flashcards" description="Type a topic, paste notes, or speak them. AssemblyAI transcribes your voice, then you can flip each card or let Inko read it aloud." action={<PageVoiceControl />} />

      <div className="stat-strip" aria-label="Flashcard statistics">
        <span><strong>{dueToday}</strong><small>Due today</small></span>
        <span><strong>{learning}</strong><small>Learning</small></span>
        <span><strong>{mastered}</strong><small>Mastered</small></span>
      </div>

      {flashcards.length > 0 && (
        <div className="mastery-ring" role="progressbar" aria-label="Mastered percentage" aria-valuenow={masteredPercent} aria-valuemin={0} aria-valuemax={100} style={{ ["--mastery-progress" as string]: `${masteredPercent}%` }}>
          <div>
            <strong>{masteredPercent}%</strong>
            <small>Mastered</small>
          </div>
        </div>
      )}

      <section className="deck-generator" aria-label="Create a flashcard deck">
        <div><span className="deck-generator-icon"><Sparkles size={19} /></span><div><h2>Make a deck</h2><p>Use a saved note, type the ideas, or record them. AssemblyAI turns the audio into notes before the cards are made.</p></div></div>
        <div className="deck-generator-controls">
          <label className="deck-choice-field">
            <span>Deck</span>
            <select aria-label="Deck" onChange={(event) => setDeckChoice(event.target.value)} value={deckChoice}>
              <option value="new">Create a new deck</option>
              {!notesLoading && notes.map((note) => <option key={note.id} value={note.id}>{note.title}</option>)}
            </select>
          </label>
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

      {(error || formError) && <p className="form-error flashcard-error" role="alert">{formError || error}</p>}

      {!loading && flashcards.length === 0 ? (
        <EmptyState icon={Layers3} title="No cards yet" message="Choose a note, type the ideas, or record them. AssemblyAI transcribes the audio, then Inko turns the key ideas into a deck." />
      ) : !loading && !activeCard ? (
        <EmptyState icon={CheckCircle2} title="You are caught up" message="Nothing is due right now. FSRS will bring each idea back when reviewing helps most." />
      ) : activeCard ? (
        <section className="review-session" aria-label="Flashcard review">
          <div className="review-progress">
            <span><Brain size={17} /> Review queue</span>
            <div className="review-progress-meta">
              <button aria-pressed={practiceWithInko} className="secondary-button card-read-button" onClick={() => setPracticeWithInko((on) => !on)} type="button">
                {practiceWithInko ? <Square size={14} /> : <Volume2 size={14} />}
                {practiceWithInko ? "Stop Inko" : "Practice with Inko"}
              </button>
              {sessionStreak > 1 && <span className="streak-chip"><Flame size={13} /> {sessionStreak} in a row</span>}
              <strong>{dueCards.length} due now</strong>
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

          {reading ? <p className="card-read-status" role="status">Inko is reading this card.</p> : null}
          <p className="rating-prompt">How well did you remember it?</p>
          <div className="rating-grid">
            {ratings.map((rating) => <button key={rating.value} className="rating-button" disabled={working !== null} onClick={() => void confirmRating(rating.value)} type="button"><strong>{rating.label}</strong><small>{rating.hint}</small></button>)}
          </div>
        </section>
      ) : null}

      {upcomingCards.length > 0 && (
        <section className="upcoming-cards" aria-label="Upcoming reviews">
          <div className="section-title-row">
            <div><p className="eyebrow">Coming up</p><h2>Next reviews</h2></div>
            <span className="upcoming-meta"><CalendarClock size={14} /> FSRS scheduled</span>
          </div>
          <ol className="upcoming-list">
            {upcomingCards.map((card) => (
              <li key={card.id}>
                <span className="upcoming-front">{card.front}</span>
                <span className="upcoming-due">{nextDueDescription(card, reviewClock)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
