import { animate } from "animejs/animation";

/** Central reduced-motion + capability gate. Every helper below applies the
 *  final state instantly when motion is reduced or the environment cannot
 *  animate (e.g. jsdom) — content is never gated on motion. */
export function motionAllowed(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.requestAnimationFrame !== "function") return false;
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Tween an integer from `from` to `to`, calling onUpdate with rounded
 *  values. Instant (single onUpdate(to)) when motion is off. Returns cancel. */
export function tweenNumber(
  from: number,
  to: number,
  onUpdate: (value: number) => void,
  duration = 500,
): () => void {
  if (from === to || !motionAllowed()) {
    onUpdate(to);
    return () => {};
  }
  const state = { v: from };
  const anim = animate(state, {
    v: to,
    duration,
    ease: "outQuad",
    onUpdate: () => onUpdate(Math.round(state.v)),
  });
  return () => anim.cancel();
}

/** Staggered entrance for a container's `[data-anime-item]` children
 *  (search results, lists). No-op when motion is off. */
export function staggerIn(container: HTMLElement | null, duration = 220): void {
  if (!container || !motionAllowed()) return;
  const items = container.querySelectorAll("[data-anime-item]");
  if (items.length === 0) return;
  animate(items, {
    opacity: [0, 1],
    translateY: [8, 0],
    duration,
    delay: (_el, i) => (i as number) * 35,
    ease: "outQuad",
  });
}

/** Toast enter/exit. Exit calls `done` for unmount. Instant when reduced. */
export function toastEnter(el: HTMLElement | null): void {
  if (!el || !motionAllowed()) return;
  animate(el, { opacity: [0, 1], translateY: [10, 0], duration: 200, ease: "outQuad" });
}

export function toastExit(el: HTMLElement | null, done: () => void): void {
  if (!el || !motionAllowed()) {
    done();
    return;
  }
  animate(el, {
    opacity: [0, 1],
    translateY: [0, 8],
    duration: 180,
    ease: "inQuad",
    onComplete: done,
  });
}

/** Match-ring sweep: animates stroke-dashoffset from full to target fraction. */
export function ringSweep(el: SVGElement | null, fraction: number, duration = 600): void {
  if (!el) return;
  const clamped = Math.max(0, Math.min(1, fraction));
  if (!motionAllowed()) {
    el.style.strokeDashoffset = String(100 * (1 - clamped));
    return;
  }
  const state = { v: 0 };
  animate(state, {
    v: clamped,
    duration,
    ease: "outQuad",
    onUpdate: () => {
      el.style.strokeDashoffset = String(100 * (1 - state.v));
    },
  });
}
