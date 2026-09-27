import { describe, expect, it } from "vitest";
import { parseDuckDuckGoResults, publicStudyUrl } from "./web-search";

const html = `
<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fai-education&amp;rut=abc">AI in education</a>
<a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fai-education&amp;rut=abc">Schools use <b>AI</b> for feedback.</a>
<a class="result__snippet" href="//duckduckgo.com/l/?uddg=http%3A%2F%2Finsecure.example%2Fa">Skip insecure</a>
<a class="result__snippet" href="javascript:alert(1)">Skip script</a>
<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.npr.org%2Fai-schools">NPR report</a>
<a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.npr.org%2Fai-schools">Risks of AI in schools.</a>
`;

describe("study web search parsing", () => {
  it("keeps https result pages and drops unsafe links", () => {
    expect(publicStudyUrl("https://example.com/paper")).toBe("https://example.com/paper");
    expect(publicStudyUrl("http://example.com/paper")).toBeNull();
    expect(publicStudyUrl("https://localhost/secret")).toBeNull();
    expect(publicStudyUrl("javascript:alert(1)")).toBeNull();
  });

  it("reads titles and snippets from search results", () => {
    expect(parseDuckDuckGoResults(html)).toEqual([
      { title: "AI in education", url: "https://example.com/ai-education", snippet: "Schools use AI for feedback." },
      { title: "NPR report", url: "https://www.npr.org/ai-schools", snippet: "Risks of AI in schools." },
    ]);
  });
});
