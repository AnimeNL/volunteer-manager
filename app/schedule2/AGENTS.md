# Agent Guidelines (`app/schedule2`)

`app/schedule2/` is a ground-up re-implementation of the volunteer schedule portal built around
Next.js Instant Navigation (Cache Components + Partial Prefetching), streaming `<Suspense>`, and
React View Transitions.

## Instant Navigation & App Shell
* Every layout and page segment in `app/schedule2/` must opt into Instant Navigation validation
  (`export const instant = true`) and Partial Prefetching (`export const prefetch = 'partial'`).
* Layouts must render a static, URL-independent App Shell. Never `await params`, `searchParams`,
  `cookies()`, `headers()`, or uncached data outside a `<Suspense>` boundary.
* Client hooks that read dynamic URL state (`usePathname`, `useParams`, `useSearchParams`,
  `useSelectedLayoutSegment`, `useSelectedLayoutSegments`) suspend during prerendering on dynamic
  segments. Push them down into small leaf Client Components wrapped in `<Suspense>`.
* Cache reusable server reads with `'use cache'`, `cacheLife()`, and `cacheTag()`. Stream live or
  per-user data behind granular `<Suspense>` boundaries with meaningful fallbacks.
* Keep `<Suspense>` loading skeletons roughly in sync with the actual page content (matching
  structure, typography variants, row counts, and approximate dimensions) and keep static `<Card>`
  surfaces outside `<SuspenseReveal>` so card frames do not flash during reveals.

## No API Routes for Data Fetching & Server Action Auth
* Do not add or call `/api/*` endpoints to fetch schedule data. Load data directly in React Server
  Components behind `<Suspense>` boundaries, and use Server Actions (following `app/AGENTS.md`) for
  mutations.
* Server Actions in `app/schedule2/` are called by volunteers, not only administrators. Always use
  `requireVolunteerAuthentication()`, `requireVolunteerAuthenticationWithEvent()`, or
  `requireVolunteerAuthenticationWithEventAndTeam()` from `@lib/auth` — never
  `requireAuthentication*()`, which requires administrative access (`event.visible`).

## View Transitions
* Cross-page route transitions use a single uniform Material Fade Through animation handled
  centrally by `<Page>` (do not pass directional `transitionTypes` to `<Link>` or compute
  directional slide order).
* Use `<SuspenseReveal>` for skeleton-to-content reveals and anchor persistent shell chrome
  (`schedule-header`, `schedule-mobile-nav`) via `viewTransitionName`, respecting
  `prefers-reduced-motion`.

## Isolation & Dependencies
* Code in `app/schedule2/` may only import from external packages, `@lib` (`app/lib/`),
  `@components` (`app/components/`), or other modules inside `app/schedule2/`. Depending on
  anything else in `app/` (such as `app/schedule/`, `app/admin/`, or `@app/LinkProxy`) is
  prohibited.

## Naming & Comments
* Always refer to this portal as `schedule` (never `schedule2`) in symbol names, component names,
  CSS custom properties, view-transition names, cache tags, and comments. Reserve `schedule2`
  strictly for actual route URLs (`/schedule2/...`) and Next.js `PageProps`/`LayoutProps` route
  literals until `app/schedule2/` replaces `app/schedule/`.

## No `Environment` Dependency & SSR-Safe Theming
* Do not depend on `@lib/Environment` (`determineEnvironment()`) in layouts, themes, or the App
  Shell. Reading the `Host` header couples the shell to request-time headers.
* Use MUI CSS variables (`colorSchemes` + `cssVariables: { colorSchemeSelector: 'class' }`) backed
  by the root `<InitColorSchemeScript />` so the App Shell prerenders cleanly on the server without
  client-only gating (`if (!isClient) return null`).

## Component Factoring & MUI Styling
* Default to plain React function components as Server Components. Only extract a component for a
  meaningful boundary: a `'use client'` leaf, a `<Suspense>` data or skeleton boundary, a reusable
  domain unit, or a repeated styled primitive. Avoid wrapper components created solely to style a
  one-off element.
* Stay 100% on MUI for component styling. Do not use hoisted `const kStyles` objects (they signal
  that `styled()`, concise inline `sx`, or theme overrides should be used instead), and do not add
  CSS Modules (`*.module.css`). Reserve plain CSS files for global or animation rules that MUI does
  not express (such as `view-transitions.css`).
* Put app-wide MUI component defaults in `ScheduleTheme.tsx` (`components.*.styleOverrides`) rather
  than exporting custom `styled(MuiX)` wrappers.
* Use concise, plain-object inline `sx={{ ... }}` for small (1–3 property) layout, spacing, and
  responsive visibility tweaks, and for styling inside Server Components where `styled()` cannot be
  called. Never add `'use client'` solely to use `styled()`, and avoid function-valued `sx`
  (`sx={theme => ...}`); prefer theme shorthands (`color: 'text.secondary'`, `borderRadius: 1`) or
  CSS variables so styles remain RSC-serializable.
* In Client Components, use `styled()` from `@mui/material/styles` for non-trivial styles, complex
  selectors, reusable primitives, and repeated list or grid items (static `styled()` objects bypass
  per-render `styleFunctionSx` overhead). Use `variants: [...]` and `shouldForwardProp` for
  prop-driven styles, and `theme.applyStyles('dark', ...)` with `(theme.vars || theme).palette.*`
  for colour-scheme styling—never branch on `theme.palette.mode`.
* Always use direct MUI subpath imports (e.g. `import Box from '@mui/material/Box'`) rather than
  barrel imports from `@mui/material`.
* When targeting MUI component slots or states in CSS selectors (`styled()` or `sx`), import the
  component's exported `*Classes` object (e.g. `listItemIconClasses.root`,
  `inputBaseClasses.input`) rather than hardcoding `.Mui*` class name strings.
* Prefer composing (nested) MUI layout primitives (`<Grid>`, `<Stack>`, `<Box>`) and MUI spacing
  and padding tokens (`spacing`, `p`/`px`/`py`, `theme.spacing(...)`) over reinventing flex/grid
  layouts or hardcoding pixel margins and padding in custom `styled()` wrappers.
* Use standard MUI `<Typography variant="...">` and icon `fontSize` presets (`small`, `medium`,
  `large`) rather than hardcoded custom `fontSize` values so the type scale stays consistent across
  the portal.
* Follow the canonical palette boundary: in `sx` / `styled()`, use MUI's semantic palette tokens
  (`primary.*`, `secondary.*`, `background.default`/`paper`, `text.primary`/`secondary`/`disabled`,
  `divider`, `action.hover`, `warning.*`, `error.*`, `info.*`), and on `<Typography color="...">`
  use the `<Typography>` colour presets (`textPrimary`, `textSecondary`, `textDisabled`, `primary`,
  `error`, `inherit`) rather than dot-path strings; reserve `m3.*` strictly for M3-specific
  surfaces/accents MUI does not model (`sheet`, `dock`, `dockActive`, `floatingNav`, `treeLine`,
  `ambientGlow*`, `tileAccentA–D`). Never hardcode hex/rgba colours outside `ScheduleTheme.tsx` and
  `m3ColorScheme.ts`.
* Reuse the shared primitives in `components/` (`InteractiveSurface` / `useActivityRippleKey`,
  `IconBadge`, `RestrictedBadge`, `EmptyStateCard`, `ScheduleList` / `ScheduleListRow`,
  `ScheduleListSkeleton` / `SegmentedListSkeleton`) and co-locate route-specific components next to
  their route (like `overview/`, `knowledge/`, `scanner/`, `settings/`, `vendors/`).
