<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Using Next.js `Link` with MUI Components in Server Components

When passing Next.js `Link` to a MUI Client Component (such as `<MuiLink component={Link}>` or
`<Button LinkComponent={Link}>`) from a React Server Component, always import `Link` from
`@app/LinkProxy` (`app/LinkProxy.ts`) instead of `next/link`:

```tsx
import Link from '@app/LinkProxy';
import MuiLink from '@mui/material/Link';

<MuiLink component={Link} href="...">Label</MuiLink>
```

Importing directly from `next/link` fails at runtime with
`Functions cannot be passed directly to Client Components` in Next.js 16+. Treat `@app/LinkProxy`
as a block-1 import (as if it were `next/link`).

## Caching Strategy (`@lib/cache` over Next.js `'use cache'`)

`@lib/cache` (`app/lib/cache/`) is the primary server-side caching layer for the Volunteer Manager.
Broadly adopting Next.js's caching primitives (`'use cache'`, `cacheLife()`, `cacheTag()`) is an
explicit non-goal in order to avoid framework lock-in:

* Keep existing `@lib/cache` caches in `@lib/cache`, even when their payloads are serializable and
  could hypothetically be replaced by `'use cache'`.
* Prefer adding new application caches to `@lib/cache` (`CacheDescriptors.ts`) rather than
  introducing new `'use cache'` scopes.
* Reserve Next.js `'use cache'` for the narrow cases where Next.js's rendering model requires it
  (such as prerendered App Shell / Instant Navigation reads in `app/schedule2/` or build-safe
  `readCachedSetting()` reads).

## Git Commit Identity (Remote Agents)

Remote agents and cloud sandboxes often ship with a default `/etc/gitconfig` such as
`noreply@github.com`, which GitHub attributes to its `web-flow` account. Before creating any
commits, verify `git config user.name` and `git config user.email`, and ensure they are set to the
user's actual Git identity (e.g., matching recent commits on `main` or the user's GitHub profile
via `gh api user`).
