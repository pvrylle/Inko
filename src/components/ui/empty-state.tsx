import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, message, action }: {
  icon: LucideIcon;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="empty-state">
      <span className="empty-icon"><Icon aria-hidden="true" size={28} /></span>
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </section>
  );
}
