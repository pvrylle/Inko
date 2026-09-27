"use client";

import { MascotProvider } from "@/features/mascot/mascot-provider";
import { VoiceAgentProvider } from "@/features/voice/voice-agent-provider";
import { ToastProvider } from "@/features/toast/toast-provider";
import { AuthModalProvider } from "@/features/auth/auth-modal-provider";
import { AuthProvider } from "./auth-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <MascotProvider>
          <AuthModalProvider>
            <VoiceAgentProvider>{children}</VoiceAgentProvider>
          </AuthModalProvider>
        </MascotProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
