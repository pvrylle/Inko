import type { ReactNode } from "react";

const marker = /(\[\d+\]|\*\*[^*]+?\*\*|\*[^*\s][^*]*?\*)/g;

/** Renders citation markers, bold, and italics without leaving the asterisks on screen. */
export function inlineMarkdown(text: string, cite?: (label: string, index: number) => ReactNode): ReactNode[] {
  return text.split(marker).map((part, index) => {
    const citation = part.match(/^\[(\d+)\]$/);
    if (citation) return cite ? cite(citation[1], index) : <span key={index}>{part}</span>;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2 && !part.startsWith("**")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <span key={index}>{part}</span>;
  });
}
