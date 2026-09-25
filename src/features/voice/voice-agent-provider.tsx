"use client";

import { createContext, useContext } from "react";
import { useVoiceAgent } from "./use-voice-agent";

export type VoiceAgentController = ReturnType<typeof useVoiceAgent>;

const VoiceAgentContext = createContext<VoiceAgentController | null>(null);

export function VoiceAgentProvider({ children }: { children: React.ReactNode }) {
  const controller = useVoiceAgent();
  return (
    <VoiceAgentContext.Provider value={controller}>
      {children}
    </VoiceAgentContext.Provider>
  );
}

export function useOptionalVoiceAgent() {
  return useContext(VoiceAgentContext);
}

export function useVoiceAgentContext() {
  const controller = useOptionalVoiceAgent();
  if (!controller) {
    throw new Error("useVoiceAgentContext must be used within VoiceAgentProvider");
  }
  return controller;
}
