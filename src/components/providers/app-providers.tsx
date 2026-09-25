"use client";

import { MascotProvider } from "@/features/mascot/mascot-provider";
import { VoiceAgentProvider } from "@/features/voice/voice-agent-provider";
import { ToastProvider } from "@/features/toast/toast-provider";
import { AuthProvider } from "./auth-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <MascotProvider>
          <VoiceAgentProvider>{children}</VoiceAgentProvider>
        </MascotProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
