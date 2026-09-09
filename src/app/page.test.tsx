import { render, screen } from "@testing-library/react";
import { MascotProvider } from "@/features/mascot/mascot-provider";
import HomePage from "./page";

describe("HomePage", () => {
  it("presents voice as the primary action", () => {
    render(<MascotProvider><HomePage /></MascotProvider>);
    expect(screen.getByRole("button", { name: /start talking to inko/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ask inko anything/i)).toBeInTheDocument();
  });
});
