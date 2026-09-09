export type NoteSource = "voice" | "text" | "photo" | "pdf";
export type VoiceSessionStatus = "active" | "completed" | "failed" | "deletion_pending" | "deleted";
export type StudyRating = "again" | "hard" | "good" | "easy";

export type Note = {
  id: string;
  owner_id: string;
  title: string;
  summary: string;
  content_markdown: string;
  source: NoteSource;
  storage_path: string | null;
  created_at: string;
  updated_at: string;
};

export type Flashcard = {
  id: string;
  owner_id: string;
  note_id: string;
  front: string;
  back: string;
  explanation: string | null;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
  created_at: string;
  updated_at: string;
};

export type FlashcardReview = {
  id: string;
  owner_id: string;
  flashcard_id: string;
  rating: StudyRating;
  answer_text: string | null;
  semantic_score: number | null;
  feedback: string | null;
  previous_due: string;
  next_due: string;
  reviewed_at: string;
};

export type SemanticGrade = {
  score: number;
  verdict: "correct" | "partial" | "incorrect";
  feedback: string;
  suggested_rating: StudyRating;
};

export type Quiz = {
  id: string;
  owner_id: string;
  note_id: string;
  title: string;
  created_at: string;
};

export type QuizQuestion = {
  id: string;
  quiz_id: string;
  owner_id: string;
  position: number;
  prompt: string;
  options: string[];
  created_at: string;
};

export type QuizAnswerKey = {
  id: string;
  question_id: string;
  owner_id: string;
  correct_index: number;
  explanation: string;
};

export type QuizAttempt = {
  id: string;
  owner_id: string;
  quiz_id: string;
  question_id: string;
  selected_index: number;
  correct: boolean;
  feedback: string;
  created_at: string;
};

export type QuizAnswerResult = {
  attempt: QuizAttempt;
  correct_index: number;
  persisted: boolean;
};

export type FocusStatus = "active" | "paused" | "completed" | "cancelled";
export type FocusControlAction = "pause" | "resume" | "stop" | "complete";

export type FocusSession = {
  id: string;
  owner_id: string;
  duration_minutes: number;
  started_at: string;
  target_ends_at: string;
  paused_at: string | null;
  accumulated_pause_seconds: number;
  completed_at: string | null;
  status: FocusStatus;
  created_at: string;
  updated_at: string;
};
