import { describe, expect, it } from "vitest";
import { toGeminiTurn, toOpenAICompletion } from "./brain";

describe("voice brain translation", () => {
  it("keeps the system prompt off the conversation and maps a tool round trip", () => {
    const turn = toGeminiTurn({
      messages: [
        { role: "system", content: "You are Inko." },
        { role: "user", content: "Research mitosis." },
        {
          role: "assistant",
          content: null,
          tool_calls: [{ id: "call_1", function: { name: "start_research", arguments: "{\"question\":\"How does mitosis work?\"}" } }],
        },
        { role: "tool", tool_call_id: "call_1", content: "{\"sessionId\":\"abc\"}" },
      ],
      tools: [{ function: { name: "start_research", description: "Start research", parameters: { type: "object" } } }],
    });

    expect(turn.system).toBe("You are Inko.");
    expect(turn.contents).toEqual([
      { role: "user", parts: [{ text: "Research mitosis." }] },
      { role: "model", parts: [{ functionCall: { name: "start_research", args: { question: "How does mitosis work?" } } }] },
      { role: "user", parts: [{ functionResponse: { name: "start_research", response: { sessionId: "abc" } } }] },
    ]);
    expect(turn.declarations).toEqual([
      { name: "start_research", description: "Start research", parameters: { type: "object" } },
    ]);
  });

  it("returns an OpenAI tool call the voice agent can execute", () => {
    const completion = toOpenAICompletion({
      text: "",
      model: "gemini-flash-latest",
      calls: [{ name: "start_research", args: { question: "How does mitosis work?" } }],
    });
    expect(completion.choices[0]?.finish_reason).toBe("tool_calls");
    expect(completion.choices[0]?.message.tool_calls?.[0]?.function).toEqual({
      name: "start_research",
      arguments: "{\"question\":\"How does mitosis work?\"}",
    });
  });
});
