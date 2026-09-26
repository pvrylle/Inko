"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HomeOrbit } from "@/features/home/home-orbit";
import { hasCompletedOnboarding } from "@/features/onboarding/onboarding-flow";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (!hasCompletedOnboarding()) router.replace("/welcome");
  }, [router]);

  return <HomeOrbit />;
}
