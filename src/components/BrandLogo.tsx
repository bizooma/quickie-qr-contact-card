// QuickieQR logo: the mark (three QR finder squares + a lime bolt) and the
// "quickieQR" wordmark set in live type, so it stays crisp at any size and
// follows light/dark mode. Size it with a text-* class on `className`.

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden className={className}>
      <rect width="512" height="512" rx="116" fill="var(--brand)" />
      {(
        [
          [92, 92],
          [284, 92],
          [92, 284],
        ] as const
      ).map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="136" height="136" rx="32" fill="#FFFFFF" />
          <rect x={x + 26} y={y + 26} width="84" height="84" rx="18" fill="var(--brand)" />
          <rect x={x + 46} y={y + 46} width="44" height="44" rx="11" fill="#FFFFFF" />
        </g>
      ))}
      <path
        d="M378 270 L298 384 H350 L326 446 L420 326 H368 L398 270 Z"
        fill="var(--pop-lime)"
        stroke="var(--pop-lime)"
        strokeWidth="10"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BrandLogo({ className = "text-2xl" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="QuickieQR"
      className={`inline-flex items-center gap-[0.3em] font-display font-extrabold leading-none tracking-[-0.045em] text-foreground ${className}`}
    >
      <BrandMark className="h-[1.2em] w-[1.2em] shrink-0" />
      <span aria-hidden className="inline-flex items-baseline">
        quickie
        <span className="relative isolate ml-[0.04em] text-brand dark:text-pop-lime">
          <span className="absolute -inset-x-[0.08em] bottom-[0.02em] -z-10 h-[0.42em] -skew-x-12 rounded-[0.08em] bg-pop-lime/80 dark:hidden" />
          QR
        </span>
      </span>
    </span>
  );
}
