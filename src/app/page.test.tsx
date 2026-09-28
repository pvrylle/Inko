import { render, screen } from "@testing-library/react";
import { MascotProvider } from "@/features/mascot/mascot-provider";
import { vi } from "vitest";
import HomePage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("@/features/voice/voice-agent-provider", () => ({
  useOptionalVoiceAgent: () => ({
    sessions: [], activeSessionId: null, messages: [], connection: "idle",
    partialTranscript: "", error: null, sessionError: null, replyPending: false,
    start: vi.fn(), end: vi.fn(), sendText: vi.fn(), clearConversation: vi.fn(), openConversation: vi.fn(),
  }),
}));

describe("HomePage", () => {
  it("presents a simple conversation with text and voice input", () => {
    render(<MascotProvider><HomePage /></MascotProvider>);
    expect(screen.getByRole("heading", { name: /new conversation/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /message Inko/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start talking to Inko/i })).toBeInTheDocument();
  });
});
