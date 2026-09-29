import { DebateView, type DebateMode } from "@/features/debate/debate-view";

export const metadata = { title: "Debate" };

function debateMode(value: string | undefined): DebateMode {
  if (value === "socratic" || value === "defense") return value;
  return "debate";
}

export default async function DebatePage({ searchParams }: { searchParams: Promise<{ topic?: string; claim?: string; mode?: string; session?: string; live?: string }> }) {
  const params = await searchParams;
  return (
    <DebateView
      initialTopic={params.topic?.trim().slice(0, 200) ?? ""}
      initialClaim={params.claim?.trim().slice(0, 500) ?? ""}
      initialMode={debateMode(params.mode)}
      initialLive={params.live === "1"}
      sessionId={params.session?.trim().slice(0, 80) ?? ""}
    />
  );
}
