"use client";

import { MascotProvider } from "@/features/mascot/mascot-provider";
import { VoiceAgentProvider } from "@/features/voice/voice-agent-provider";
import { ToastProvider } from "@/features/toast/toast-provider";
import { AuthModalProvider } from "@/features/auth/auth-modal-provider";
import { AuthProvider } from "./auth-provider";
import { ProjectProvider } from "@/features/projects/project-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <MascotProvider>
          <AuthModalProvider>
            <ProjectProvider>
              <VoiceAgentProvider>{children}</VoiceAgentProvider>
            </ProjectProvider>
          </AuthModalProvider>
        </MascotProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
