import { render, screen } from "@testing-library/react";
import { MascotProvider } from "@/features/mascot/mascot-provider";
import HomePage from "./page";

describe("HomePage", () => {
  it("presents voice as the primary action", () => {
    render(<MascotProvider><HomePage /></MascotProvider>);
    expect(screen.getByRole("heading", { name: /hey Inko/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start talking to Inko/i })).toBeInTheDocument();
  });
});
