# Competitive UI analysis (embedded-discovery phase)

Supplements `docs/competitive-analysis.md` (pipeline UX) with: LinkedIn Jobs,
Indeed, Google Jobs, Notion trackers, Linear, Notion, Vercel/Geist, Raycast,
Stripe, Arc, landing-page patterns.

## Table

| Product | Post-login | Discovery | Applications | Interviews | Strong UX pattern |
|---|---|---|---|---|---|
| LinkedIn Jobs | Jobs tab w/ search + saved | Search + Easy Apply (profile-prefill, minimal friction) | Saved/applied lists | Via applications | One-click apply using stored profile data |
| Indeed | Search + dashboard | Filters-first search, salary tools | Saved + applied dashboard | Reminders | Filter density without clutter; track-from-search |
| Google Jobs | Search results | Aggregates; funnels to career pages | None (hands off) | None | Fast triage list; detail expands inline |
| Notion trackers | Database board | Manual entry | Kanban/table views | Date props | User-shaped views; zero learning curve |
| Linear | Issue triage list | Cmd+K scoped to context | Workflow states | N/A | Keyboard-first, context-scoped command palette |
| Raycast | Command palette | Fuzzy search over everything | N/A | N/A | Type-to-act; detail panel beside results |
| Vercel/Geist | Project overview | N/A | Deployments list | N/A | Empty-state taxonomy (blank-slate vs no-results vs error); `Verb+Noun` CTAs |
| Stripe | Dashboard + search-anything | Docs-embedded actions | N/A | N/A | Search that acts, not just finds |
| Arc | Spaces + profiles | Instant search, peek-in-place | N/A | N/A | Peek/detail without losing list context |
| Huntr/Teal/Simplify | Pipeline board | Clipper/bookmark/auto-save | Stage tracking | Logged per card | Save-first; readiness context on card |

## Adopt

- **Landing → sign-in funnel**: single headline + dual CTA (LinkedIn/Vercel style); static, no data.
- **Search-and-act discovery** (Stripe/Raycast): results list + inline detail + Save without leaving context (Arc peek pattern).
- **Geist empty-state taxonomy**: blank-slate (first use, teach) vs no-results (filters, offer reset) vs error (retry, data-safe). Our EmptyState already separates these; keep it.
- **LinkedIn lesson**: prefill everything — our search form should remember last role/location (localStorage) to cut retyping.
- **Linear lesson**: keyboard-accessible list (real buttons/links, focus-visible) over custom widgets.

## Avoid

- Extension-install flows (we own the discovery engine — no clipper needed).
- Kanban drag-and-drop (list + status editing covers our flow; DnD adds state machinery + mobile pain).
- Command palettes (no command-shaped actions yet; sidebar suffices).
- Marketing-heavy landing (authenticated users need to work, not read).

## Opportunity

Nobody combines evidence-backed verification *inside* the tracker's own discovery surface — competitors show keywords; we show cited sources + authenticity via deep-links. Our edge is making VERIFY one click from the embedded card without leaving Tracker context.
