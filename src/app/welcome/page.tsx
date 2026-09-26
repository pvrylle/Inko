"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { OnboardingFlow, hasCompletedOnboarding } from "@/features/onboarding/onboarding-flow";

export default function WelcomePage() {
  const router = useRouter();

  useEffect(() => {
    if (hasCompletedOnboarding()) router.replace("/");
  }, [router]);

  return <OnboardingFlow />;
}
