import Link from "next/link";

export function InkoLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="inko-logo" href="/" aria-label="Tentaio home">
      <span className="logo-mark" aria-hidden="true">
        <span className="logo-eye logo-eye-left" />
        <span className="logo-eye logo-eye-right" />
      </span>
      <span className="logo-text">
        <span className="logo-word">Tentaio</span>
        {!compact && <span className="logo-tagline">Research. Think. Grow.</span>}
      </span>
    </Link>
  );
}
