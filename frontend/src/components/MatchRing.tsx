import { useEffect, useRef } from "react";
import { ringSweep } from "../animations/anime";

/** Match-percentage ring (SVG, animated sweep). Decorative arc only — the
 *  numeric value is always present as text for AT. */
export function MatchRing({ value, size = 44 }: { value: number; size?: number }) {
  const circle = useRef<SVGCircleElement>(null);
  const pct = Math.max(0, Math.min(100, Math.round(value)));

  useEffect(() => {
    ringSweep(circle.current, pct / 100);
  }, [pct]);

  const stroke = pct >= 70 ? "#1d4ed8" : pct >= 40 ? "#b77900" : "#64748b";
  const r = 16;

  return (
    <span className="inline-flex items-center gap-1.5" role="img" aria-label={`${pct}% match`}>
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
        <circle
          ref={circle}
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="5"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={100}
          strokeDashoffset={100 * (1 - pct / 100)}
          transform="rotate(-90 20 20)"
        />
      </svg>
      <span className="text-sm font-bold tabular-nums" style={{ color: stroke }}>
        {pct}%
      </span>
    </span>
  );
}
