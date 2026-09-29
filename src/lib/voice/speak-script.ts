export function prepareAnnaSpeech(text: string) {
  const spoken = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\bsources?\s*\[\s*\d+(?:\s*,\s*\d+)*\s*]/gi, " ")
    .replace(/\[\s*\d+(?:\s*,\s*\d+)*\s*]/g, " ")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/[–—]/g, ", ")
    .replace(/\b([A-Z])(\d+)\b/g, "$1 $2")
    .replace(/\s+,/g, ",")
    .replace(/,(?:,|\s)+/g, ", ")
    .replace(/\s+\./g, ".")
    .replace(/\s+/g, " ")
    .trim();
  if (!spoken) return "";
  return /[.!?]$/.test(spoken) ? spoken : `${spoken}.`;
}
