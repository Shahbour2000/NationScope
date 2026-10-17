import { useId } from "react";

/** NationScope mark: a scope ring over a world arc, cyan to violet. Concept logo; replace the SVG here to rebrand. */
export function LogoMark({ size = 28 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22d3ee" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="12" stroke={`url(#${id})`} strokeWidth="2.2" />
      <path d="M4.5 18c5-3.5 10-3.5 14 0s7 3 9 1" stroke={`url(#${id})`} strokeWidth="2" strokeLinecap="round" />
      <path d="M16 1.5v5M16 25.5v5M1.5 16h5M25.5 16h5" stroke={`url(#${id})`} strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.2" fill={`url(#${id})`} />
    </svg>
  );
}

export function Logo({ showWordmark = true }: { showWordmark?: boolean }) {
  return (
    <span className="ns-logo">
      <LogoMark />
      {showWordmark && <span className="ns-wordmark">Nation<b>Scope</b></span>}
    </span>
  );
}
