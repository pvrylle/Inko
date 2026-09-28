import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/research",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/ui/inko-logo", () => ({ InkoLogo: () => <span>Inko</span> }));
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ user: null, isGuest: true }) }));
vi.mock("@/features/guest/guest-banner", () => ({ GuestBanner: () => null }));
vi.mock("@/features/projects/project-provider", () => ({ useOptionalProjects: () => null }));
vi.mock("@/features/voice/voice-agent-provider", () => ({
  useOptionalVoiceAgent: () => ({ sessions: [], activeSessionId: null }),
}));
vi.mock("@/features/home/home-chat", () => ({
  HomeChat: ({ onClose }: { onClose: () => void }) => <button onClick={onClose} type="button">Close Inko panel</button>,
}));

describe("responsive app rails", () => {
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
});
