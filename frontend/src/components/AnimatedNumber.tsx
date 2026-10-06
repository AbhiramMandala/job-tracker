import { useEffect, useRef } from "react";
import { tweenNumber } from "../animations/anime";

/** Integer that tweens to its value (pipeline counts, totals).
 *  Renders the final value immediately when motion is reduced. */
export function AnimatedNumber({ value, label }: { value: number; label?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    const el = ref.current;
    if (!el) return;
    el.textContent = String(from);
    const cancel = tweenNumber(from, value, (v) => {
      if (el.textContent !== undefined) el.textContent = String(v);
    });
    return cancel;
  }, [value]);

  return (
    <span ref={ref} aria-label={label} className="tabular-nums">
      {value}
    </span>
  );
}
