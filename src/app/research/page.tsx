import { Suspense } from "react";
import { ResearchView } from "@/features/research/research-view";

export const metadata = { title: "Research" };

export default function ResearchPage() {
  return (
    <Suspense fallback={null}>
      <ResearchView />
    </Suspense>
  );
}
