export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string };
type Owned = { id: string; owner_id: string };

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string; streak_count: number; last_active_at: string; created_at: string; updated_at: string };
        Insert: { id: string; display_name?: string; streak_count?: number; last_active_at?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      voice_sessions: {
        Row: Owned & Timestamps & { provider_session_id: string | null; status: Database["public"]["Enums"]["voice_session_status"]; started_at: string; ended_at: string | null; deletion_requested_at: string | null; deleted_at: string | null };
        Insert: { id?: string; owner_id: string; provider_session_id?: string | null; status?: Database["public"]["Enums"]["voice_session_status"]; started_at?: string; ended_at?: string | null; deletion_requested_at?: string | null; deleted_at?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["voice_sessions"]["Insert"]>;
        Relationships: [];
      };
      chat_turns: {
        Row: Owned & Timestamps & { voice_session_id: string | null; role: "student" | "inko"; transcript: string; interrupted: boolean; provider_item_id: string | null };
        Insert: { id?: string; owner_id: string; voice_session_id?: string | null; role: "student" | "inko"; transcript: string; interrupted?: boolean; provider_item_id?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["chat_turns"]["Insert"]>;
        Relationships: [];
      };
      notes: {
        Row: Owned & Timestamps & { title: string; summary: string; content_markdown: string; source: Database["public"]["Enums"]["note_source"]; storage_path: string | null; updated_at: string };
        Insert: { id?: string; owner_id: string; title: string; summary?: string; content_markdown: string; source?: Database["public"]["Enums"]["note_source"]; storage_path?: string | null; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["notes"]["Insert"]>;
        Relationships: [];
      };
      flashcards: {
        Row: Owned & Timestamps & { note_id: string; front: string; back: string; explanation: string | null; due: string; stability: number; difficulty: number; elapsed_days: number; scheduled_days: number; learning_steps: number; reps: number; lapses: number; state: number; last_review: string | null; updated_at: string };
        Insert: { id?: string; owner_id: string; note_id: string; front: string; back: string; explanation?: string | null; due?: string; stability?: number; difficulty?: number; elapsed_days?: number; scheduled_days?: number; learning_steps?: number; reps?: number; lapses?: number; state?: number; last_review?: string | null; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["flashcards"]["Insert"]>;
        Relationships: [];
      };
      flashcard_reviews: {
        Row: Owned & { flashcard_id: string; rating: Database["public"]["Enums"]["study_rating"]; answer_text: string | null; semantic_score: number | null; feedback: string | null; previous_due: string; next_due: string; reviewed_at: string };
        Insert: { id?: string; owner_id: string; flashcard_id: string; rating: Database["public"]["Enums"]["study_rating"]; answer_text?: string | null; semantic_score?: number | null; feedback?: string | null; previous_due: string; next_due: string; reviewed_at?: string };
        Update: Partial<Database["public"]["Tables"]["flashcard_reviews"]["Insert"]>;
        Relationships: [];
      };
      quizzes: {
        Row: Owned & Timestamps & { note_id: string; title: string };
        Insert: { id?: string; owner_id: string; note_id: string; title: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["quizzes"]["Insert"]>;
        Relationships: [];
      };
      quiz_questions: {
        Row: Owned & Timestamps & { quiz_id: string; position: number; prompt: string; options: string[] };
        Insert: { id?: string; owner_id: string; quiz_id: string; position: number; prompt: string; options: string[]; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["quiz_questions"]["Insert"]>;
        Relationships: [];
      };
      quiz_attempts: {
        Row: Owned & Timestamps & { quiz_id: string; question_id: string; selected_index: number; correct: boolean; feedback: string };
        Insert: { id?: string; owner_id: string; quiz_id: string; question_id: string; selected_index: number; correct: boolean; feedback: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["quiz_attempts"]["Insert"]>;
        Relationships: [];
      };
      focus_sessions: {
        Row: Owned & Timestamps & { duration_minutes: number; started_at: string; target_ends_at: string; paused_at: string | null; accumulated_pause_seconds: number; completed_at: string | null; status: Database["public"]["Enums"]["focus_status"]; updated_at: string };
        Insert: { id?: string; owner_id: string; duration_minutes: number; started_at?: string; target_ends_at: string; paused_at?: string | null; accumulated_pause_seconds?: number; completed_at?: string | null; status?: Database["public"]["Enums"]["focus_status"]; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["focus_sessions"]["Insert"]>;
        Relationships: [];
      };
      tool_executions: {
        Row: Owned & Timestamps & { call_id: string; tool_name: string; result: Json | null; error: string | null };
        Insert: { id?: string; owner_id: string; call_id: string; tool_name: string; result?: Json | null; error?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["tool_executions"]["Insert"]>;
        Relationships: [];
      };
      research_sessions: {
        Row: Owned & Timestamps & { question: string; title: string | null; description: string; status: Database["public"]["Enums"]["research_status"]; updated_at: string };
        Insert: { id?: string; owner_id: string; question: string; title?: string | null; description?: string; status?: Database["public"]["Enums"]["research_status"]; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["research_sessions"]["Insert"]>;
        Relationships: [];
      };
      library_classes: {
        Row: Owned & Timestamps & { name: string };
        Insert: { id?: string; owner_id: string; name: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["library_classes"]["Insert"]>;
        Relationships: [];
      };
      library_files: {
        Row: Owned & Timestamps & { class_id: string; name: string; type: Database["public"]["Enums"]["library_file_type"]; size_bytes: number; storage_path: string; upload_date: string };
        Insert: { id?: string; owner_id: string; class_id: string; name: string; type: Database["public"]["Enums"]["library_file_type"]; size_bytes: number; storage_path: string; upload_date?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["library_files"]["Insert"]>;
        Relationships: [];
      };
      research_sources: {
        Row: Owned & Timestamps & { session_id: string; title: string; url: string | null; type: Database["public"]["Enums"]["research_source_type"]; tag: Database["public"]["Enums"]["research_source_tag"]; library_file_id: string | null; extracted_text: string | null; meta: string | null };
        Insert: { id?: string; owner_id: string; session_id: string; title: string; url?: string | null; type: Database["public"]["Enums"]["research_source_type"]; tag?: Database["public"]["Enums"]["research_source_tag"]; library_file_id?: string | null; extracted_text?: string | null; meta?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["research_sources"]["Insert"]>;
        Relationships: [];
      };
      research_sources_public: {
        Row: Owned & Timestamps & { session_id: string; title: string; url: string | null; type: Database["public"]["Enums"]["research_source_type"]; tag: Database["public"]["Enums"]["research_source_tag"]; library_file_id: string | null; meta: string | null };
        Insert: { id?: string; owner_id: string; session_id: string; title: string; url?: string | null; type: Database["public"]["Enums"]["research_source_type"]; tag?: Database["public"]["Enums"]["research_source_tag"]; library_file_id?: string | null; meta?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["research_sources_public"]["Insert"]>;
        Relationships: [];
      };
      research_findings: {
        Row: Owned & Timestamps & { session_id: string; statement: string; source_id: string | null };
        Insert: { id?: string; owner_id: string; session_id: string; statement: string; source_id?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["research_findings"]["Insert"]>;
        Relationships: [];
      };
      research_contradictions: {
        Row: Owned & Timestamps & { session_id: string; explanation: string; source_ids: string[] };
        Insert: { id?: string; owner_id: string; session_id: string; explanation: string; source_ids: string[]; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["research_contradictions"]["Insert"]>;
        Relationships: [];
      };
      research_open_questions: {
        Row: Owned & Timestamps & { session_id: string; text: string };
        Insert: { id?: string; owner_id: string; session_id: string; text: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["research_open_questions"]["Insert"]>;
        Relationships: [];
      };
      research_canvas: {
        Row: Owned & { session_id: string; content: string; updated_at: string };
        Insert: { id?: string; owner_id: string; session_id: string; content?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["research_canvas"]["Insert"]>;
        Relationships: [];
      };
      research_notes: {
        Row: Owned & { session_id: string; content_markdown: string; updated_at: string };
        Insert: { id?: string; owner_id: string; session_id: string; content_markdown: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["research_notes"]["Insert"]>;
        Relationships: [];
      };
      research_runs: {
        Row: Owned & Timestamps & { session_id: string; status: Database["public"]["Enums"]["research_run_status"]; error: string | null; input_hash: string | null; call_id: string | null; updated_at: string };
        Insert: { id?: string; owner_id: string; session_id: string; status?: Database["public"]["Enums"]["research_run_status"]; error?: string | null; input_hash?: string | null; call_id?: string | null; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["research_runs"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      commit_flashcard_review: {
        Args: {
          p_card_id: string;
          p_review_id: string;
          p_rating: Database["public"]["Enums"]["study_rating"];
          p_answer_text: string | null;
          p_semantic_score: number | null;
          p_feedback: string | null;
          p_due: string;
          p_stability: number;
          p_difficulty: number;
          p_elapsed_days: number;
          p_scheduled_days: number;
          p_learning_steps: number;
          p_reps: number;
          p_lapses: number;
          p_state: number;
          p_last_review: string | null;
          p_reviewed_at: string;
        };
        Returns: Database["public"]["Tables"]["flashcards"]["Row"][];
      };
      create_quiz_from_generated: {
        Args: { p_owner_id: string; p_note_id: string; p_title: string; p_questions: Json; p_call_id: string };
        Returns: Json;
      };
      submit_quiz_answer: {
        Args: { p_question_id: string; p_selected_index: number };
        Returns: Json;
      };
      start_focus_session: {
        Args: { p_duration_minutes: number; p_call_id: string | null };
        Returns: Json;
      };
      control_focus_timer: {
        Args: { p_action: string; p_call_id: string | null };
        Returns: Json;
      };
      get_current_focus_session: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      begin_research_analysis: {
        Args: { p_owner_id: string; p_session_id: string; p_input_hash: string; p_call_id: string | null };
        Returns: Json;
      };
      replace_research_analysis: {
        Args: { p_owner_id: string; p_session_id: string; p_run_id: string; p_description: string; p_note_markdown: string; p_findings: Json; p_contradictions: Json; p_questions: Json; p_source_tags: Json };
        Returns: Json;
      };
      fail_research_run: {
        Args: { p_owner_id: string; p_session_id: string; p_run_id: string; p_error: string };
        Returns: Json;
      };
    };
    Enums: {
      note_source: "voice" | "text" | "photo" | "pdf";
      voice_session_status: "active" | "completed" | "failed" | "deletion_pending" | "deleted";
      study_rating: "again" | "hard" | "good" | "easy";
      focus_status: "active" | "paused" | "completed" | "cancelled";
      research_status: "draft" | "analyzing" | "ready" | "failed";
      research_source_type: "document" | "url" | "file";
      research_source_tag: "supports" | "contradicts" | "untagged";
      research_run_status: "analyzing" | "ready" | "failed";
      library_file_type: "pdf" | "doc" | "docx" | "txt" | "md";
    };
    CompositeTypes: Record<string, never>;
  };
};
