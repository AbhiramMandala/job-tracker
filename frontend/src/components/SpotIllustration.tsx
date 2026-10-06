/** Layered SVG spot illustrations (decorative; meaning lives in the
 *  surrounding text). Soft gradients, offset layers, subtle perspective —
 *  no engines, no assets. */

export type SpotKind = "pipeline" | "calendar" | "document" | "compass" | "shield";

export function SpotIllustration({ kind }: { kind: SpotKind }) {
  return (
    <svg width="120" height="96" viewBox="0 0 120 96" aria-hidden="true" className="mx-auto mb-3">
      <defs>
        <linearGradient id={`spot-a-${kind}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#dbeafe" />
          <stop offset="1" stopColor="#eff6ff" />
        </linearGradient>
        <linearGradient id={`spot-b-${kind}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1d4ed8" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      {kind === "pipeline" && (
        <g>
          <rect x="18" y="58" width="84" height="24" rx="6" fill={`url(#spot-a-${kind})`} stroke="#bfdbfe" />
          <rect x="26" y="34" width="84" height="24" rx="6" fill="#ffffff" stroke="#bfdbfe" />
          <rect x="34" y="10" width="84" height="24" rx="6" fill={`url(#spot-b-${kind})`} opacity="0.92" />
          <circle cx="48" cy="22" r="5" fill="#ffffff" opacity="0.85" />
          <rect x="58" y="19" width="34" height="6" rx="3" fill="#ffffff" opacity="0.7" />
        </g>
      )}
      {kind === "calendar" && (
        <g>
          <rect x="30" y="18" width="60" height="58" rx="8" fill="#ffffff" stroke="#bfdbfe" strokeWidth="1.5" />
          <rect x="30" y="18" width="60" height="16" rx="8" fill={`url(#spot-b-${kind})`} opacity="0.9" />
          <rect x="30" y="28" width="60" height="6" fill={`url(#spot-b-${kind})`} opacity="0.9" />
          <line x1="44" y1="12" x2="44" y2="24" stroke="#1d4ed8" strokeWidth="4" strokeLinecap="round" />
          <line x1="76" y1="12" x2="76" y2="24" stroke="#1d4ed8" strokeWidth="4" strokeLinecap="round" />
          <circle cx="60" cy="54" r="11" fill={`url(#spot-a-${kind})`} stroke="#1d4ed8" strokeWidth="1.5" />
          <path d="M60 48v6l4 3" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
      {kind === "document" && (
        <g>
          <rect x="34" y="22" width="56" height="62" rx="6" fill={`url(#spot-a-${kind})`} stroke="#bfdbfe" transform="rotate(-6 62 53)" />
          <rect x="30" y="14" width="56" height="62" rx="6" fill="#ffffff" stroke="#bfdbfe" strokeWidth="1.5" transform="rotate(4 58 45)" />
          <rect x="40" y="28" width="30" height="6" rx="3" fill="#1d4ed8" opacity="0.85" />
          <rect x="40" y="40" width="36" height="4" rx="2" fill="#cbd5e1" />
          <rect x="40" y="49" width="36" height="4" rx="2" fill="#cbd5e1" />
          <rect x="40" y="58" width="24" height="4" rx="2" fill="#cbd5e1" />
        </g>
      )}
      {kind === "compass" && (
        <g>
          <circle cx="60" cy="48" r="30" fill={`url(#spot-a-${kind})`} stroke="#bfdbfe" strokeWidth="1.5" />
          <circle cx="60" cy="48" r="22" fill="#ffffff" stroke="#bfdbfe" />
          <path d="M70 38l-6 12-12 6 6-12z" fill={`url(#spot-b-${kind})`} />
          <circle cx="60" cy="48" r="2.5" fill="#1d4ed8" />
          <rect x="82" y="66" width="26" height="14" rx="4" fill="#ffffff" stroke="#bfdbfe" transform="rotate(8 95 73)" />
        </g>
      )}
      {kind === "shield" && (
        <g>
          <path d="M60 10l26 10v22c0 18-11 30-26 38-15-8-26-20-26-38V20z" fill={`url(#spot-a-${kind})`} stroke="#1d4ed8" strokeWidth="1.5" />
          <path d="M52 46l6 6 12-13" fill="none" stroke="#1d4ed8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="78" y="60" width="24" height="8" rx="4" fill="#ffffff" stroke="#bfdbfe" transform="rotate(-6 90 64)" />
        </g>
      )}
    </svg>
  );
}
