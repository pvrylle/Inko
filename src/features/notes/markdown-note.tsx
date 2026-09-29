import { inlineMarkdown } from "@/components/ui/inline-markdown";

export function MarkdownNote({ markdown }: { markdown: string }) {
  return (
    <div className="note-markdown">
      {markdown.split("\n").map((line, index) => {
        if (line.startsWith("# ")) return <h1 key={index}>{inlineMarkdown(line.slice(2))}</h1>;
        if (line.startsWith("## ")) return <h2 key={index}>{inlineMarkdown(line.slice(3))}</h2>;
        if (line.startsWith("> ")) return <blockquote key={index}>{inlineMarkdown(line.slice(2))}</blockquote>;
        if (line.startsWith("- ")) return <div className="markdown-bullet" key={index}><span>•</span><p>{inlineMarkdown(line.slice(2))}</p></div>;
        return line ? <p key={index}>{inlineMarkdown(line)}</p> : <div className="markdown-space" key={index} />;
      })}
    </div>
  );
}
