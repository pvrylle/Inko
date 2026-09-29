import { render } from "@testing-library/react";
import { MarkdownNote } from "./markdown-note";

describe("MarkdownNote", () => {
  it("renders ### headings instead of leaving the hashes on the page", () => {
    const { container } = render(<MarkdownNote markdown={"### The idea\nDisgust keeps people away from contamination."} />);
    expect(container.querySelector("h3")?.textContent).toBe("The idea");
    expect(container.textContent).not.toContain("###");
    expect(container.querySelector("p")?.textContent).toContain("Disgust keeps people");
  });
});
