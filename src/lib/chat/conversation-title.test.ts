import { conversationTitleFromMessages, deriveConversationTitle, isDefaultConversationTitle } from "./conversation-title";

describe("conversation titles", () => {
  it("turns a search request into the topic", () => {
    expect(deriveConversationTitle("Can you search about Python?")).toBe("Python");
  });

  it("keeps a short study question readable", () => {
    expect(deriveConversationTitle("How does sleep affect memory consolidation in students?")).toBe(
      "Sleep affect memory consolidation in students",
    );
  });

  it("replaces the first-message placeholder title", () => {
    expect(isDefaultConversationTitle("New chat")).toBe(true);
    expect(isDefaultConversationTitle("Can you search about Python?", "Can you search about Python?")).toBe(true);
    expect(isDefaultConversationTitle("Python", "Can you search about Python?")).toBe(false);
  });

  it("names a session from the first student message", () => {
    expect(conversationTitleFromMessages("New chat", [
      { role: "student", text: "Tell me about the French Revolution" },
    ])).toBe("The French Revolution");
  });
});
