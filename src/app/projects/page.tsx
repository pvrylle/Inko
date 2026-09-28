import { ProjectsView } from "@/features/projects/projects-view";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const params = await searchParams;
  return <ProjectsView startCreating={params.new !== undefined} />;
}
