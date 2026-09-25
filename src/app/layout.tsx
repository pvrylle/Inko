import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Inko — Your study companion",
    template: "%s · Inko",
  },
  description: "A voice-first AI study companion for notes, flashcards, quizzes, and focus sessions.",
};

export const viewport: Viewport = {
  themeColor: "#F5F9FF",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
