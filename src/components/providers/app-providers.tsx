"use client";

import { AuthProvider } from "./auth-provider";
import { MascotProvider } from "@/features/mascot/mascot-provider";
import { ToastProvider } from "@/features/toast/toast-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <MascotProvider>{children}</MascotProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
