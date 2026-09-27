type TextPart = { type?: string; text?: string };
type ToolCall = { id?: string; function?: { name?: string; arguments?: string } };

export type BrainMessage = {
  role?: string;
  content?: string | null | TextPart[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type BrainTool = {
  type?: string;
  function?: {
    name?: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type BrainRequest = {
  model?: string;
  messages?: BrainMessage[];
  tools?: BrainTool[];
};

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export type GeminiTurn = { role: "user" | "model"; parts: GeminiPart[] };

function textOf(content: BrainMessage["content"]) {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content.map((part) => part.text ?? "").join("");
}

function parseArgs(raw: string | undefined) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : { value: parsed };
  } catch {
    return { value: raw };
  }
}

export function toGeminiTurn(body: BrainRequest) {
  const system = (body.messages ?? [])
    .filter((message) => message.role === "system")
    .map((message) => textOf(message.content).trim())
    .filter(Boolean)
    .join("\n\n");

  const namesByCallId = new Map<string, string>();
  const contents: GeminiTurn[] = [];

  for (const message of body.messages ?? []) {
    if (message.role === "system") continue;
    if (message.role === "assistant") {
      const parts: GeminiPart[] = [];
      const text = textOf(message.content).trim();
      if (text) parts.push({ text });
      for (const call of message.tool_calls ?? []) {
        const name = call.function?.name?.trim();
        if (!name) continue;
        if (call.id) namesByCallId.set(call.id, name);
        parts.push({ functionCall: { name, args: parseArgs(call.function?.arguments) } });
      }
      if (parts.length > 0) contents.push({ role: "model", parts });
      continue;
    }
    if (message.role === "tool") {
      const name = message.name?.trim() || (message.tool_call_id ? namesByCallId.get(message.tool_call_id) : undefined);
      if (!name) continue;
      let response: Record<string, unknown> = { result: textOf(message.content) };
      try {
        const parsed = JSON.parse(textOf(message.content)) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) response = parsed as Record<string, unknown>;
      } catch {
        // Keep the raw tool text.
      }
      contents.push({ role: "user", parts: [{ functionResponse: { name, response } }] });
      continue;
    }
    const text = textOf(message.content).trim();
    if (text) contents.push({ role: "user", parts: [{ text }] });
  }

  const declarations = (body.tools ?? []).flatMap((tool) => {
    const name = tool.function?.name?.trim();
    if (!name) return [];
    return [{
      name,
      description: tool.function?.description ?? "",
      parameters: tool.function?.parameters ?? { type: "object", properties: {} },
    }];
  });

  return { system, contents, declarations };
}

export function toOpenAICompletion(input: {
  text: string;
  calls: { name: string; args: Record<string, unknown> }[];
  model: string;
}) {
  const toolCalls = input.calls.map((call, index) => ({
    id: `call_${index}_${call.name}`,
    type: "function" as const,
    function: { name: call.name, arguments: JSON.stringify(call.args) },
  }));
  return {
    id: `chatcmpl_${crypto.randomUUID()}`,
    object: "chat.completion",
    model: input.model,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: input.text || null,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      },
      finish_reason: toolCalls.length > 0 ? "tool_calls" : "stop",
    }],
  };
}
