export type MascotPresence =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "sleeping"
  | "error"
  | "working"
  | "researching";
export type MascotMood = "neutral" | "happy" | "encouraging";
/** Future AI affect channel — clip router uses happy today; other values fall through to presence/tool clips. */
export type MascotEmotion = "neutral" | "happy" | "curious" | "focused" | "concerned" | "encouraging";
export type MascotMode = "normal" | "focus";

export type MascotState = {
  presence: MascotPresence;
  mood: MascotMood;
  emotion: MascotEmotion;
  mode: MascotMode;
  message: string;
};

export type MascotAction =
  | { type: "SESSION_READY" }
  | { type: "USER_STARTED" }
  | { type: "USER_STOPPED" }
  | { type: "AGENT_AUDIO" }
  | { type: "REPLY_DONE" }
  | { type: "TOOL_STARTED"; label?: string }
  | { type: "CELEBRATE"; message?: string }
  | { type: "ENCOURAGE"; message?: string }
  | { type: "SET_MODE"; mode: MascotMode }
  | { type: "SET_EMOTION"; emotion: MascotEmotion }
  | { type: "SLEEP" }
  | { type: "WAKE" }
  | { type: "ERROR"; message?: string }
  | { type: "RESET_MOOD" }
  | { type: "RESEARCH_STARTED" }
  | { type: "WORK_STARTED"; label?: string };

export const initialMascotState: MascotState = {
  presence: "idle",
  mood: "neutral",
  emotion: "neutral",
  mode: "normal",
  message: "What are we studying today?",
};

export function mascotReducer(state: MascotState, action: MascotAction): MascotState {
  switch (action.type) {
    case "SESSION_READY":
      return { ...state, presence: "idle", message: "I'm all ears!" };
    case "USER_STARTED":
      return { ...state, presence: "listening", mood: "neutral", emotion: "neutral", message: "I'm listening…" };
    case "USER_STOPPED":
      return { ...state, presence: "thinking", message: "Let me understand that." };
    case "TOOL_STARTED":
      return { ...state, presence: "thinking", message: action.label ?? "Working on it…" };
    case "AGENT_AUDIO":
      return { ...state, presence: "speaking", message: "Here's what I found." };
    case "REPLY_DONE":
      return { ...state, presence: "idle", message: state.mode === "focus" ? "You've got this." : "What should we do next?" };
    case "CELEBRATE":
      return {
        ...state,
        presence: "idle",
        mood: "happy",
        emotion: "happy",
        message: action.message ?? "That was brilliant!",
      };
    case "ENCOURAGE":
      return {
        ...state,
        mood: "encouraging",
        emotion: "encouraging",
        message: action.message ?? "Small steps still count.",
      };
    case "SET_MODE":
      return { ...state, mode: action.mode, message: action.mode === "focus" ? "Quiet focus mode. Let's go." : "What should we do next?" };
    case "SET_EMOTION":
      // AI / voice layer will dispatch this from model affect or tool outcomes.
      return {
        ...state,
        emotion: action.emotion,
        mood: action.emotion === "happy" ? "happy" : action.emotion === "encouraging" ? "encouraging" : state.mood,
      };
    case "SLEEP":
      return state.presence === "idle" ? { ...state, presence: "sleeping", message: "Zzz…" } : state;
    case "WAKE":
      return state.presence === "sleeping" ? { ...state, presence: "idle", message: "I'm awake! Ready?" } : state;
    case "ERROR":
      return {
        ...state,
        presence: "error",
        mood: "encouraging",
        emotion: "concerned",
        message: action.message ?? "That got a little tangled. Try again?",
      };
    case "RESET_MOOD":
      return { ...state, mood: "neutral", emotion: state.emotion === "happy" || state.emotion === "encouraging" ? "neutral" : state.emotion };
    case "RESEARCH_STARTED":
      return { ...state, presence: "researching", emotion: "focused", message: "I'm comparing the evidence." };
    case "WORK_STARTED":
      return { ...state, presence: "working", emotion: "focused", message: action.label ?? "Working on it…" };
    default:
      return state;
  }
}
