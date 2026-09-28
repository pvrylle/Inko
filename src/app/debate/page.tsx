import { DebateView } from "@/features/debate/debate-view";

export const metadata = { title: "Debate" };

export default async function DebatePage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const params = await searchParams;
  return <DebateView initialTopic={params.topic?.trim().slice(0, 200) ?? ""} />;
}
