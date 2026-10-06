# UI technology decisions (NEXT PHASE: visual upgrade)

Date: 2026-10-06. Stack stays React 18 + Vite 5 + Tailwind 3 + Cloudflare Pages/Workers. No migration.

## ReactBits — ADAPT patterns, install nothing

ReactBits is copy-paste code by design (135+ components, Tailwind variants).
Adopted as hand-written CSS/React in our codebase, not as a dependency:

- **SpotlightCard** (mouse-tracked radial highlight) → action cards on Home, job cards on Discover.
- **ShineButton** (diagonal light sweep on hover) → primary CTAs only.
- **Skeleton shimmer** → loading states (replaces bare spinners for layout content).
- **Fade-up entrance** → page/section mount animation with stagger.

Rejected: SplashCursor, Particles, Magnet, Scramble text, Tilt cards — decoration
that distracts in a utility app, pointer-tracking cost, readability risk.

## 21st.dev / shadcn patterns — ADOPT the patterns, not the packages

- **Empty-state pattern** (icon + title + explanation + primary action): our `EmptyState` gains icon + action slots; every major page gets a real empty state. No package — our component already exists.
- **Dashboard shell pattern** (icon sidebar, active pill, sticky header, user identity): applied to our `Layout`. No sidebar library.
- **Stat/pipeline cards**: custom `Pipeline` component; no chart library (counts don't need Recharts).

## Three.js / React Three Fiber — REJECTED (documented)

Evaluated for a Home ambient visual and a career-progression visual. Rejected because:
1. No information a WebGL scene would convey that the pipeline strip doesn't already show.
2. WebGL init + frame loop cost on a page whose job is fast triage; mobile GPUs suffer most, and our users are students on varied hardware.
3. Accessibility burden (canvas is opaque to AT; every meaning must be duplicated in DOM anyway).
4. The "abstract network" look reads crypto-dashboard, which the brief explicitly forbids.

Ambient depth is achieved with layered CSS gradients + grid + spotlight (0 KB JS, GPU-cheap, `prefers-reduced-motion`-safe).

## Animation library — anime.js 4, granular imports ONLY

CSS keyframes + transitions remain the base (entrance, hover, shine, skeleton,
modal). Anime.js is used strictly for what CSS cannot do well:

- `tweenNumber` — animated pipeline/metric counts (`AnimatedNumber`).
- `staggerIn` — result-list stagger via per-index delay callback (no stagger module).
- `toastEnter`/`toastExit` — toast lifecycle with unmount callback.
- `ringSweep` — match-ring stroke animation.

Imports are granular (`animejs/animation` only) — never the root bundle.
Measured cost: ~15 KB gzip. The `stagger` module was evaluated and dropped in
favor of a delay callback to save weight. All helpers no-op to final state
under `prefers-reduced-motion` or without rAF, so content never depends on motion.

## Icons — lucide-react (NEW dependency)

- Purpose: consistent nav/action/empty-state icons (replaces ☰/→/⚠ glyphs and emoji).
- Why necessary: hand-drawing 20+ icons is infeasible; no icon system exists in-repo.
- Compatibility: React 18, Vite 5, full TypeScript, actively maintained.
- Bundle: tree-shaken named imports; measured impact in Phase 10 (target < 15 KB gzip delta).
- Usage rule: `import { X } from "lucide-react"` per icon — never `import *`.

## Custom-built (no library)

`AppShell`/`Layout`, `PageHeader`, `ActionCard`, `Pipeline`, `NextActionCard`,
`JobCard`/`ApplicationCard`/`InterviewCard`/`ResumeCard`, `EmptyState`,
skeletons, `StatusBadge`/`VerifyBadge`, modal, forms. Reasons: our domain
(statuses, pipeline semantics, JobSetu source badge) doesn't map onto generic
kits; custom components stay small and match the design tokens exactly.

## Explicitly NOT installed

- framer-motion (unneeded weight; CSS suffices)
- three / @react-three/fiber (+ questions above)
- shadcn/ui registry, Magic UI, Aceternity, 21st.dev registry pulls (overlapping systems; we'd inherit their tokens/conflicts for little gain)
- chart libraries (no chart-shaped data)
- Any Next.js dependency (no migration; Pages + Workers unchanged)

## Bundle/performance control

- Baseline (pre-upgrade): JS 207.6 kB / CSS 15.8 kB (vite build output).
- Budget: total JS gzip delta ≤ +25 KB vs baseline, CSS ≤ +8 KB.
- Measured (post-Anime): JS +24.1 KB gzip, CSS +1.6 KB gzip — inside budget.
- Rules: no runtime animation libs; decorative layers are pure CSS; icons tree-shaken; no new per-page heavy deps; skeletons preserve layout (no CLS); decorative visuals never block interaction or fetch.
