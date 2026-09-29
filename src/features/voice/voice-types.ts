export type VoiceConnectionState = "idle" | "connecting" | "connected" | "ending" | "error";

export type StudySourceLink = {
  title: string;
  url: string;
};

export type ChatSessionLink = {
  kind: "research" | "debate" | "flashcards";
  title: string;
  href: string;
};

export type VoiceMessage = {
  id: string;
  role: "student" | "inko";
  text: string;
  createdAt: string;
  interrupted?: boolean;
  sources?: StudySourceLink[];
  attachment?: { name: string; type: string };
  link?: ChatSessionLink;
};

export type ToolCall = {
  call_id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type VoiceServerEvent =
  | { type: "session.ready"; session_id: string }
  | { type: "session.ended"; session_duration_seconds: number; audio_duration_seconds?: number | null }
  | { type: "session.error" | "error"; code: string; message: string }
  | { type: "input.speech.started" }
  | { type: "input.speech.stopped" }
  | { type: "transcript.user.delta"; text: string; item_id?: string }
  | { type: "transcript.user"; text: string; item_id: string }
  | { type: "reply.started"; reply_id: string }
  | { type: "reply.audio"; data: string }
  | { type: "transcript.agent.delta"; delta: string; item_id: string; reply_id: string }
  | { type: "transcript.agent"; text: string; item_id: string; reply_id: string; interrupted: boolean }
  | { type: "reply.done"; reply_id?: string; status: "completed" | "interrupted" }
  | ({ type: "tool.call" } & ToolCall)
  | { type: "session.updated" };
