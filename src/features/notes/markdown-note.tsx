import { inlineMarkdown } from "@/components/ui/inline-markdown";

const numbered = /^\d+\.\s+/;

export function MarkdownNote({ markdown }: { markdown: string }) {
  return (
    <div className="note-markdown">
      {markdown.split("\n").map((raw, index) => {
        const line = raw.replace(/\s+$/, "");
        const trimmed = line.trimStart();
        if (trimmed.startsWith("#### ")) return <h4 key={index}>{inlineMarkdown(trimmed.slice(5))}</h4>;
        if (trimmed.startsWith("### ")) return <h3 key={index}>{inlineMarkdown(trimmed.slice(4))}</h3>;
        if (trimmed.startsWith("## ")) return <h2 key={index}>{inlineMarkdown(trimmed.slice(3))}</h2>;
        if (trimmed.startsWith("# ")) return <h1 key={index}>{inlineMarkdown(trimmed.slice(2))}</h1>;
        if (trimmed.startsWith("> ")) return <blockquote key={index}>{inlineMarkdown(trimmed.slice(2))}</blockquote>;
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return <div className="markdown-bullet" key={index}><span>•</span><p>{inlineMarkdown(trimmed.slice(2))}</p></div>;
        }
        if (numbered.test(trimmed)) {
          return <div className="markdown-bullet" key={index}><span>{trimmed.match(/^\d+/)?.[0]}.</span><p>{inlineMarkdown(trimmed.replace(numbered, ""))}</p></div>;
        }
        return trimmed ? <p key={index}>{inlineMarkdown(trimmed)}</p> : <div className="markdown-space" key={index} />;
      })}
    </div>
  );
}
