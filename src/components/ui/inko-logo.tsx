import Link from "next/link";

export function InkoLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="inko-logo" href="/" aria-label="Inko home">
      <span className="logo-mark" aria-hidden="true">
        <span className="logo-eye logo-eye-left" />
        <span className="logo-eye logo-eye-right" />
      </span>
      {!compact && <span className="logo-word">inko</span>}
      {compact && <span className="logo-word">inko</span>}
    </Link>
  );
}
