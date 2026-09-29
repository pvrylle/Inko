import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { AppShell } from "./app-shell";

const chatActions = vi.hoisted(() => ({
  renameConversation: vi.fn(), archiveConversation: vi.fn(), restoreConversation: vi.fn(), removeConversation: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/research",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/ui/inko-logo", () => ({ InkoLogo: () => <span>Inko</span> }));
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ user: null, isGuest: true }) }));
vi.mock("@/features/guest/guest-banner", () => ({ GuestBanner: () => null }));
vi.mock("@/features/projects/project-provider", () => ({ useOptionalProjects: () => null }));
vi.mock("@/features/voice/voice-agent-provider", () => ({
  useOptionalVoiceAgent: () => ({
    sessions: [
      { id: "recent-chat", title: "Plan biology revision", archived_at: null },
      { id: "archived-chat", title: "Old notes", archived_at: "2026-09-29T00:00:00.000Z" },
    ],
    activeSessionId: null,
    ...chatActions,
  }),
}));
vi.mock("@/features/home/home-chat", () => ({
  HomeChat: ({ onClose }: { onClose: () => void }) => <button onClick={onClose} type="button">Close Inko panel</button>,
}));

describe("responsive app rails", () => {
  beforeEach(() => Object.values(chatActions).forEach((action) => action.mockClear()));

  it("marks the current section without leaving New chat selected", () => {
    render(<AppShell><p>Research content</p></AppShell>);
    const navigation = screen.getByRole("complementary", { name: "Primary navigation" });
    expect(within(navigation).getByRole("link", { name: "Research" })).toHaveAttribute("aria-current", "page");
    expect(within(navigation).getByRole("button", { name: "New chat" })).not.toHaveAttribute("aria-current");
    expect(within(navigation).getByRole("button", { name: "All chats" })).not.toHaveAttribute("aria-current");
  });
  it("lets users hide and restore navigation and Inko", async () => {
    const user = userEvent.setup();
    const { container } = render(<AppShell><p>Research content</p></AppShell>);
    const shell = container.querySelector<HTMLElement>(".assistant-shell");
    const navigation = screen.getByRole("complementary", { name: "Primary navigation" });
    const assistant = container.querySelector<HTMLElement>("#inko-assistant");

    await user.click(within(navigation).getByRole("button", { name: "Hide navigation" }));
    expect(shell).toHaveAttribute("data-sidebar-collapsed", "true");
    await user.click(screen.getByRole("button", { name: "Show navigation" }));
    expect(shell).toHaveAttribute("data-sidebar-collapsed", "false");

    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(navigation).toHaveAttribute("data-open", "true");
    await user.click(within(navigation).getByRole("button", { name: "Close navigation" }));
    expect(navigation).toHaveAttribute("data-open", "false");

    await user.click(screen.getByRole("button", { name: "Show Inko assistant" }));
    expect(assistant).toHaveAttribute("data-open", "true");
    await user.click(screen.getByRole("button", { name: "Close Inko panel" }));
    expect(assistant).toHaveAttribute("data-open", "false");
  });

  it("offers rename, archive, delete, and restore in the sidebar", async () => {
    const user = userEvent.setup();
    render(<AppShell><p>Research content</p></AppShell>);
    const navigation = screen.getByRole("complementary", { name: "Primary navigation" });

    await user.click(within(navigation).getByRole("button", { name: "Options for Plan biology revision" }));
    await user.click(within(navigation).getByRole("button", { name: "Rename" }));
    await user.clear(within(navigation).getByRole("textbox", { name: "Rename Plan biology revision" }));
    await user.type(within(navigation).getByRole("textbox", { name: "Rename Plan biology revision" }), "Biology exam");
    await user.click(within(navigation).getByRole("button", { name: "Save chat name" }));
    expect(chatActions.renameConversation).toHaveBeenCalledWith("recent-chat", "Biology exam");

    await user.click(within(navigation).getByRole("button", { name: "Options for Plan biology revision" }));
    await user.click(within(navigation).getByRole("button", { name: "Archive" }));
    expect(chatActions.archiveConversation).toHaveBeenCalledWith("recent-chat");

    await user.click(within(navigation).getByRole("button", { name: "Options for Plan biology revision" }));
    await user.click(within(navigation).getByRole("button", { name: "Delete" }));
    await user.click(within(navigation).getByRole("button", { name: "Delete" }));
    expect(chatActions.removeConversation).toHaveBeenCalledWith("recent-chat");

    await user.click(within(navigation).getByRole("button", { name: "Restore Old notes" }));
    expect(chatActions.restoreConversation).toHaveBeenCalledWith("archived-chat");
  });
});
