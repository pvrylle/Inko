"use client";

import { MascotProvider } from "@/features/mascot/mascot-provider";
import { VoiceAgentProvider } from "@/features/voice/voice-agent-provider";
import { ToastProvider } from "@/features/toast/toast-provider";
import { AuthModalProvider } from "@/features/auth/auth-modal-provider";
import { AuthProvider } from "./auth-provider";
import { ProjectProvider } from "@/features/projects/project-provider";
import { PageBriefProvider } from "@/features/page-brief/page-brief";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <MascotProvider>
          <AuthModalProvider>
            <ProjectProvider>
              <PageBriefProvider>
                <VoiceAgentProvider>{children}</VoiceAgentProvider>
              </PageBriefProvider>
            </ProjectProvider>
          </AuthModalProvider>
        </MascotProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
