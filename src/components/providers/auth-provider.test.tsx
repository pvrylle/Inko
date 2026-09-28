import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { AuthProvider, useAuth } from "./auth-provider";

vi.mock("@/lib/supabase/client", () => ({ getBrowserSupabaseClient: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

function AuthProbe() {
  const { userId, isGuest, signOut } = useAuth();
  return (
    <>
      <output data-testid="auth-state">{userId}:{String(isGuest)}</output>
      <button onClick={() => void signOut()} type="button">Sign out</button>
    </>
  );
}

it("switches to a separate guest identity after sign-out", async () => {
  window.localStorage.clear();
  const user = { id: "account-a" };
  let onAuthChange: ((event: string, session: { user: typeof user } | null) => void) | undefined;
  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user } } })),
      onAuthStateChange: vi.fn((callback: typeof onAuthChange) => {
        onAuthChange = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signOut: vi.fn(async () => {
        onAuthChange?.("SIGNED_OUT", null);
        return { error: null };
      }),
    },
  };
  vi.mocked(getBrowserSupabaseClient).mockReturnValue(client as unknown as NonNullable<ReturnType<typeof getBrowserSupabaseClient>>);

  render(<AuthProvider><AuthProbe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId("auth-state")).toHaveTextContent("account-a:false"));

  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await waitFor(() => expect(screen.getByTestId("auth-state")).toHaveTextContent(/^[0-9a-f-]{36}:true$/));
  expect(screen.getByTestId("auth-state")).not.toHaveTextContent("account-a");
});
