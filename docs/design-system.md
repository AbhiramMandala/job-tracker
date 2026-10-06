# Career workspace design system

Single source of truth for visual consistency. Implemented in
`frontend/src/index.css` (tokens, keyframes) + `tailwind.config.js` (mapped
utilities) + `frontend/src/components/ui.tsx` (primitives).

## Colors (light + dark via `dark:` variants; CSS vars remain for future theming)

Dark mode is class-based (`darkMode: "class"`, toggled by `useTheme`, persisted as `jt-theme`, OS preference as default). Every surface/text/border class carries a `dark:` counterpart — no page-specific exceptions. Brand-solid buttons (blue-700, red-600, green-700) are shared across themes; soft alert/badge backgrounds get deep variants (e.g. `amber-950`, `blue-950`).

| Token | Value | Use |
|---|---|---|
| `--bg` | slate-100 `#f1f5f9` | app background |
| `--surface` | white | cards, panels |
| `--surface-elev` | white + `shadow-md` | modals, popovers |
| `--border` | slate-200 `#e2e8f0` | card/input borders |
| `--primary` | blue-700 `#1d4ed8` | links, primary buttons |
| `--primary-hover` | blue-800 `#1e40af` | primary hover |
| `--ink` | slate-900 | strong text/headings |
| `--muted` | slate-600/500 | secondary text, metadata |
| `--success` | emerald-700 on emerald-50 | offers, saved✓ |
| `--warning` | amber-800 on amber-50 | follow-ups, attention |
| `--danger` | red-700 on red-50/600 solid | destructive, overdue |
| `--teal` | teal-800 on teal-100 | JobSetu source badge |

Status pills reuse the existing `StatusBadge` palette (no new colors per page).

## Typography

- Display (hero greeting): `text-3xl font-extrabold tracking-tight`
- Page heading: `text-2xl font-bold`
- Section heading: `font-semibold` (base size)
- Body: default (`text-sm` in dense surfaces)
- Metadata/labels: `text-xs` / `text-sm text-slate-500`, never bold-colored

Hierarchy comes from size/spacing, not from bolding everything.

## Spacing / radius / shadow

- Page: `max-w-6xl px-4 py-6`, sections `space-y-6`, cards `p-4`, gaps `gap-3/4`.
- Radius: cards `rounded-lg`, buttons/inputs `rounded-md`, pills `rounded-full`. No bubble UI.
- Elevation: resting `shadow-sm`, hover `shadow-md`, modal `shadow-xl`. One level per state.

## Motion (`--motion` keyframes; all gated behind reduced-motion)

- `fade-up` 240ms ease-out on page sections (stagger via `--reveal-delay`, max 4 steps).
- Hover: `translateY(-2px)` + `shadow-md` on clickable cards only.
- Button shine: diagonal sweep ≤600ms on primary CTAs.
- Skeleton shimmer 1.4s linear loop.
- Modal: fade 150ms + scale .98→1.
- Rules: ≤300ms except shimmer; interruptible; never delay interaction; never animate tables/filters/list content re-flow; decorative layers static under `prefers-reduced-motion` (including gradients/spotlight).

## Breakpoints

`sm 640 / md 768 / lg 1024`. Grids: 1col → `sm:2col` → action grids; pipeline strip horizontal scroll-safe on 320px; tables get `overflow-x-auto` wrappers (cards on detail pages stack).

## Components

`PageHeader` (title + description + optional actions), `ActionCard` (icon, title, body, arrow, spotlight hover), `Pipeline` (4 stages, counts, progress feel), `NextActionCard` (neutral/amber/red urgency), `EmptyState` (icon + title + body + primary action), `CardSkeleton`/`RowSkeleton` (dimension-stable), `StatusBadge` (existing palette), `ConfirmModal`, `Spinner` (reserved for auth/bootstrap only).

## Accessibility

- Icon + text (never icon-only meaning except labeled icon buttons with `aria-label`).
- Focus: visible `:focus-visible` rings on all interactives (Tailwind default + explicit on custom cards via `focus-within` where needed).
- Contrast: body text ≥ slate-600 on white; pills keep existing contrast-tested combos.
- `prefers-reduced-motion`: kill entrance/shine/shimmer/spotlight transitions; skeletons render static.

## When NOT to animate / use 3D

No WebGL anywhere (see ui-technology-decisions). No animation on: tables, form inputs, filter selects, settings, tab switches that move focus, anything where motion could hide information. When in doubt, static + fast wins.
