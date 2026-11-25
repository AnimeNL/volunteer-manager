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

## No API Routes for Data Fetching
* Do not add or call `/api/*` endpoints to fetch schedule data. Load data directly in React Server
  Components behind `<Suspense>` boundaries, and use Server Actions (following `app/AGENTS.md`) for
  mutations.

## View Transitions
* Use React's `<ViewTransition>` component and `<Link transitionTypes={[...]}>` for route
  transitions, `<Suspense>` skeleton-to-content reveals, and shared-element morphs.
* Anchor persistent shell chrome (header bar, mobile bottom navigation) using `viewTransitionName`
  so only page content transitions, and respect `prefers-reduced-motion`.

## Isolation & Dependencies
* Code in `app/schedule2/` may only import from external packages, `@lib` (`app/lib/`), or other
  modules inside `app/schedule2/`. Depending on anything else in `app/` (such as `app/schedule/`,
  `app/admin/`, `app/components/`, or `@app/LinkProxy`) is prohibited.

## No `Environment` Dependency & SSR-Safe Theming
* Do not depend on `@lib/Environment` (`determineEnvironment()`) in layouts, themes, or the App
  Shell. Reading the `Host` header couples the shell to request-time headers.
* Use MUI CSS variables (`colorSchemes` + `cssVariables: { colorSchemeSelector: 'class' }`) backed
  by the root `<InitColorSchemeScript />` so the App Shell prerenders cleanly on the server without
  client-only gating (`if (!isClient) return null`).
