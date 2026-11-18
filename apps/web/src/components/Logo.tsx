/** The Carewish mark: a speech bubble holding a heart — your voice about your care. */
export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <rect width="48" height="48" rx="14" fill="var(--brand)" />
      <path
        d="M12 15.5c0-2.5 2-4.5 4.5-4.5h15c2.5 0 4.5 2 4.5 4.5v11c0 2.5-2 4.5-4.5 4.5H22l-6.2 5.3c-.6.5-1.5.1-1.5-.7V31h-.3c-1.1 0-2-.9-2-2V15.5Z"
        fill="var(--brand-ink)"
      />
      <path
        d="M24 26.6s-5.4-3.2-5.4-6.9c0-1.7 1.3-3 3-3 1 0 1.9.5 2.4 1.3.5-.8 1.4-1.3 2.4-1.3 1.7 0 3 1.3 3 3 0 3.7-5.4 6.9-5.4 6.9Z"
        fill="var(--accent)"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="text-xl font-bold tracking-tight">Carewish</span>
    </span>
  );
}
