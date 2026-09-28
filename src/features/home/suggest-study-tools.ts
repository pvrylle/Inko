export type StudyToolId = "note" | "cards" | "quiz" | "research" | "canvas" | "focus";

export type StudyToolSuggestion = {
  id: StudyToolId;
  hint: string;
};

export function suggestStudyTools(question: string, answer: string, sourceCount: number): StudyToolSuggestion[] {
  const blob = `${question}\n${answer}`.toLowerCase();
  const plain = answer.replace(/\s*\[\d+\]/g, " ").replace(/\s+/g, " ").trim();
  const writing = /\b(essay|paragraph|draft|thesis|narrative|conclusion|writing)\b/.test(blob);
  const drill = /\b(defin\w*|vocab\w*|memor\w*|formula|terms?|key points?)\b/.test(blob);
  const quiz = /\b(quiz|exam|test|practice questions?)\b/.test(blob);
  const research = sourceCount > 0 || /\b(research|sources?|evidence|studies|contradict\w*|claims?)\b/.test(blob);
  const canvas = writing || /\b(outline|structure|compare|argument|findings|steps)\b/.test(blob);
  const focus = writing || /\b(focus|study session|practice)\b/.test(blob);
  const sentences = plain.split(/[.!?]/).filter((part) => part.trim().length > 40).length;

  const picks: StudyToolSuggestion[] = [];
  if (plain.length >= 80) {
    picks.push({
      id: "note",
      hint: writing ? "Save this as a writing note you can revise." : "Save this answer as a study note.",
    });
  }
  if (!writing && (drill || sentences >= 3)) {
    picks.push({ id: "cards", hint: "Turn the facts in this answer into flashcards." });
  }
  if (quiz || drill) {
    picks.push({ id: "quiz", hint: "Check these ideas with a short quiz." });
  }
  if (research) {
    picks.push({
      id: "research",
      hint: sourceCount > 0 ? "Open the sources behind this answer." : "Keep digging on this in a research session.",
    });
  }
  if (canvas) {
    picks.push({
      id: "canvas",
      hint: writing ? "Lay the essay points out on the canvas." : "Put these findings on the canvas.",
    });
  }
  if (focus) {
    picks.push({
      id: "focus",
      hint: writing ? "Start a timer and draft from this answer." : "Start a 25 minute focus session on this.",
    });
  }
  if (picks.length === 0) picks.push({ id: "note", hint: "Save this answer as a study note." });
  return picks.slice(0, 4);
}
