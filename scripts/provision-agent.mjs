import process from "node:process";

try { process.loadEnvFile?.(".env.local"); } catch {}

const assemblyKey = process.env.ASSEMBLYAI_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
const existingAgentId = process.env.ASSEMBLYAI_AGENT_ID;

if (!assemblyKey || !geminiKey) {
  console.error("ASSEMBLYAI_API_KEY and GEMINI_API_KEY are required in .env.local.");
  process.exit(1);
}

const tool = (name, description, properties, required = []) => ({
  type: "function",
  name,
  description,
  execution_mode: "interactive",
  timeout_seconds: 90,
  parameters: { type: "object", properties, required },
});

const tools = [
  tool("create_note", "Create and save a structured study note from the student's spoken or typed content.", { content: { type: "string", description: "The full content to turn into a note. Example: Mitosis has four main phases..." } }, ["content"]),
  tool("generate_flashcards", "Generate flashcards from one of the student's notes.", { note_id: { type: "string", description: "The note UUID shown by the app." } }, ["note_id"]),
  tool("start_flashcard_review", "Start or continue a review by returning the student's next due flashcard. Ask this card's front without revealing its answer.", {}),
  tool("grade_flashcard_answer", "Semantically compare a student's answer with a flashcard answer.", { card_id: { type: "string", description: "The active flashcard UUID." }, answer: { type: "string", description: "The student's complete spoken answer." } }, ["card_id", "answer"]),
  tool("commit_flashcard_rating", "Save a student-confirmed FSRS rating.", { card_id: { type: "string", description: "The active flashcard UUID." }, rating: { type: "string", enum: ["again", "hard", "good", "easy"], description: "The confirmed review rating." } }, ["card_id", "rating"]),
  tool("start_quiz", "Generate and start a multiple-choice quiz for a note.", { note_id: { type: "string", description: "The source note UUID." } }, ["note_id"]),
  tool("submit_quiz_answer", "Submit an answer to the active multiple-choice question.", { question_id: { type: "string", description: "The active quiz question UUID." }, answer: { type: "string", description: "The spoken option letter, number, or exact option text." } }, ["question_id", "answer"]),
  tool("start_focus_session", "Start a persistent focus timer. If one is already active or paused, return it without resetting its duration.", { minutes: { type: "integer", minimum: 1, maximum: 180, description: "Focus duration in minutes. Example: 25" } }, ["minutes"]),
  tool("control_focus_timer", "Pause, resume, or stop the current focus timer. Stop cancels the current session.", { action: { type: "string", enum: ["pause", "resume", "stop"], description: "Timer action." } }, ["action"]),
  tool("plan_study_session", "Recommend the student's next few study steps using their real due cards, notes, quizzes, focus history, and streak. Return the resulting plan verbatim before offering to run the first step.", {}),
  tool("summarize_progress", "Read back a warm summary of the student's progress: streak, cards reviewed, quiz accuracy, focus minutes, and any recent achievement.", {}),
  tool("start_research", "Start a research session from the student's question. Call this before adding sources or analyzing.", { question: { type: "string", description: "The research question, 10 to 500 characters." } }, ["question"]),
  tool("add_research_source", "Attach a source to a research session. Use a library_file_id when the student names an uploaded file, otherwise pass an https URL.", {
    session_id: { type: "string", description: "The research session UUID." },
    title: { type: "string", description: "Short source title." },
    url: { type: "string", description: "Optional https URL." },
    library_file_id: { type: "string", description: "Optional owned library file UUID." },
    tag: { type: "string", enum: ["supports", "contradicts", "untagged"], description: "How the source relates to the question." },
  }, ["session_id", "title"]),
  tool("analyze_sources", "Compare the session sources and save findings, contradictions, notes, and open questions. If the result status is analyzing, tell the student the comparison is still running.", { session_id: { type: "string", description: "The research session UUID." } }, ["session_id"]),
  tool("summarize_findings", "Read back the saved findings, contradictions, and open questions for a research session. Do not invent findings that are not in the tool result.", { session_id: { type: "string", description: "The research session UUID." } }, ["session_id"]),
];

const agent = {
  name: "Inko Study Companion",
  system_prompt: `You are Inko, a warm, playful study companion. Speak in short, natural sentences. Never be condescending. Use tools whenever the student asks to save a note, make cards, review, take a quiz, control focus time, plan what to study next, hear their progress, or research a question. Start flashcard review by requesting the next due card, ask only its question, semantically grade the student's answer, then ask the student to confirm Again, Hard, Good, or Easy before committing the rating. For quizzes, ask one returned question at a time, submit exactly one answer before giving feedback, and use the tool's result instead of guessing correctness. Focus timers persist across reloads; if start returns an existing session, report its current state instead of claiming it restarted, and explain that stop cancels it. When asked what to study, call plan_study_session and read back the returned steps in order before offering to run the first one; do not invent extra tasks. When asked about progress, call summarize_progress and read the streak, cards reviewed, quiz accuracy, focus minutes, and any new achievement warmly. For research, call start_research before analysis, add sources the student names, then call analyze_sources. Read tool results instead of inventing findings. If analysis returns status analyzing, say the comparison is still running. Never reveal an answer before the student attempts it and never commit a suggested rating without confirmation. Never claim an artifact was saved until its tool succeeds. Ask one concise clarifying question when a required note, card, or research session is missing. For ordinary study chat, explain clearly in no more than three spoken sentences unless the student asks for detail.`,
  greeting: "Hey! I'm Inko. What are we studying today?",
  voice: "anna",
  input: {
    format: { encoding: "audio/pcm" },
    turn_detection: { vad_threshold: 0.5, min_silence: 700, max_silence: 2200, interrupt_response: true },
    keyterms: ["Inko", "flashcard", "Pomodoro", "FSRS"],
  },
  output: { format: { encoding: "audio/pcm" }, volume: 92 },
  tools,
  llm: [{
    base_url: "https://generativelanguage.googleapis.com/v1beta/openai",
    model,
    api_key: geminiKey,
  }],
};

const method = existingAgentId ? "PUT" : "POST";
const url = existingAgentId
  ? `https://agents.assemblyai.com/v1/agents/${existingAgentId}`
  : "https://agents.assemblyai.com/v1/agents";
const response = await fetch(url, {
  method,
  headers: { Authorization: `Bearer ${assemblyKey}`, "Content-Type": "application/json" },
  body: JSON.stringify(agent),
});

if (!response.ok) {
  const body = (await response.text()).replaceAll(assemblyKey, "[redacted]").replaceAll(geminiKey, "[redacted]");
  console.error(`Agent provisioning failed (${response.status}):`, body);
  process.exit(1);
}

const result = await response.json();
console.log(`Inko agent ${existingAgentId ? "updated" : "created"}.`);
console.log(`Set ASSEMBLYAI_AGENT_ID=${result.id ?? existingAgentId} in .env.local and Vercel.`);
