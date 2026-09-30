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
