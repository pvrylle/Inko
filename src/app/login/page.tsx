"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthModal } from "@/features/auth/auth-modal-provider";

export default function LoginPage() {
  const router = useRouter();
  const { openAuth } = useAuthModal();

  useEffect(() => {
    openAuth("signup");
    router.replace("/");
  }, [openAuth, router]);

  return null;
}
