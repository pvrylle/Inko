"use client";

export function ContentTopbar({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  if (!children) return null;
  return <div className={`content-topbar ${className}`.trim()}>{children}</div>;
}
