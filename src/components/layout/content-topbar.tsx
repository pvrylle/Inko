"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function ContentTopbar({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  if (!children) return null;
  return <div className={`content-topbar ${className}`.trim()}>{children}</div>;
}

export function BackToPractice() {
  return <Link className="back-home" href="/practice"><ArrowLeft size={15} /> Back to Practice</Link>;
}
