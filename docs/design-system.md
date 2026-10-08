<<<<<<< HEAD
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
=======
# JobSetu design system

Server-rendered Jinja + one stylesheet + two tiny scripts. No frameworks,
no font downloads, no icon libraries, no animation libraries — a deliberate
choice for speed and reliability.

## Tokens (`app/static/style.css`)

- **Colors:** `--bg/--card/--panel`, `--ink/--muted/--text-soft`,
  `--accent` (+`--accent-ink`), `--border/--input-border/--input-bg`,
  `--chip-bg/--chip-border`, status pairs `--ok-*/--warn-*/--err-*`,
  `--info-bg/--info-border`, signal hues `--amber/--red/--green/--deepred/--olive/--gray`.
  Every surface uses variables; the only hex codes in the stylesheet are the
  token definitions themselves. All text/background pairs measured ≥ 4.5:1
  (light accent `#1a5fd0` chosen for exactly this).
- **Spacing:** `--space-1/2/3/4/6/8` (4–32px). **Radius:**
  `--radius-sm/md/lg/xl`. **Shadows:** `--shadow-sm/md` (hover only).
- **Motion:** `--duration-fast/normal/slow`; `prefers-reduced-motion`
  disables all transitions/animations, and JS rotators check it too.
- **Type:** system stack; `--font-display/h1/h2/small` scale.

## Component map (atoms → pages)

- Atoms: `.btn/.btn-ghost/.btn-small`, `.badge(.live/.cached)`, `.chip(.chip-yes)`,
  `.link`, `.cta`, inputs/selects, `.theme-toggle`.
- Molecules: `.pipeline`, `.match-score` + `.match-bar`, `.verify-*`,
  `.auth-*`, `.news`, `.interview`, `.kv`, `.breakdown` (+`.table-scroll`),
  `.resource-card`, `.toolbar` filters.
- Organisms: sticky `.site-header`, `.hero` search panel, `.job-card`,
  Company/Role/Prep/Interview/News sections on the evidence page (with sticky
  `.section-nav` anchor row), `.skeleton` async placeholders, `.recent-row`
  device-local recent searches.
- Templates/pages: landing, results, evidence (role intelligence), tools,
  profile, usage, error.

## Theme contract

`data-theme` on `<html>`; inline head script applies saved-or-system theme
pre-paint; `#theme-toggle` persists to `localStorage`; every component
audited in both themes.

## Reference library usage

- **Used as inspiration:** atomic layering, SaaS spacing/hierarchy, hover
  elevation, staged loading, chip/filter patterns (Framer/Magic/Fancy/Cult/
  Uiverse ideas reimplemented in vanilla CSS/JS).
- **Principles applied, library not installed:** Radix accessibility
  (native controls, labels, focus, keyboard), Tailbits utility thinking
  (tokens instead), AtomizeCode structure.
- **Not needed:** React migration, Tailwind, Radix Themes, Anime.js (CSS
  covers our motion), Framer Motion, downloaded fonts, lordicon/
  useanimations (external animated-icon scripts: licensing + weight),
  Thiings 3D assets (VPN-gated, heavy), text-rotate libraries (12-line
  script instead).
>>>>>>> e9c6929019e324b5af53fa75f10210ec7f411830
