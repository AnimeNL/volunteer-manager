---
name: security-review
description: >-
  Performs a security audit of authentication, authorization, client-side boundaries, and
  entry-point checks across the codebase. Only run this skill when explicitly requested by the user
  (e.g. "run a security review" or "/security-review"); never invoke it automatically.
---

# Skill Name: Security review

## Trigger & Approach
**Manual invocation only**: Do not run this skill unless the user explicitly asks for a security
review. Routine change reviews must continue to use `/self-review`.

Treat the review as read-only unless the user asks for fixes. Before auditing code, read
`app/lib/auth/README.md` and `app/lib/auth/AGENTS.md` so documented design decisions and tradeoffs
are distinguished from real regressions (while still verifying their compensating controls hold).

## Audit Goals

### 1. Core authentication & authorization (`app/lib/auth`)
Verify that `app/lib/auth` upholds the security properties documented in its `README.md` and
`AGENTS.md`:
* Public barrels (`@lib/auth`, `@lib/auth/access`, `@lib/auth/actions`) remain minimal and do not
  leak internal primitives.
* Credential hashing, sealed tokens, one-time access codes, sessions, displays, impersonation, and
  WebAuthn ceremonies remain cryptographically sound, atomic, and replay-resistant.
* Auth caching, `bypassCache`, rate limiting, and redirect sanitization have no bypasses.
* The authorization engine fails closed, resolves specificity/revokes/roles accurately, and
  preserves `401` vs `403` and `restrict: 'root'` semantics.
* `app/lib/auth/README.md` and `app/lib/auth/AGENTS.md` remain accurate.

### 2. Direct usages of `app/lib/auth`
Audit every consumer outside `app/lib/auth/` (including auth, Server Action, and `<DataTable>`
wrappers):
* Production code imports only through the public barrel entry points.
* `getAuthenticationContext()` is used only where visitor support or custom handling is genuinely
  required, with no data leaks when unauthenticated.
* High-risk mutations (account lifecycle, impersonation, credentials, permissions) verify fresh
  state with `bypassCache` and enforce privilege boundaries (including `restrict: 'root'`).
* Every mutation affecting user identity, activation, credentials, roles, permissions, events,
  teams, or participations invalidates the auth cache appropriately.
* Permission checks use accurate event/team scopes and CRUD operations without unintended wildcard
  broadening.

### 3. Client-side security boundaries
Audit `'use client'` modules and RSC-to-Client boundaries for XSS, open redirects, token leaks, and
data exposure:
* **Auth & account UI** (`app/registration/AuthenticationFlow.tsx` and
  `app/registration/authentication/`): verify URL tokens, post-auth/sign-out redirects, WebAuthn
  flows, password inputs, and sign-out cleanup are safe and never rely on client-side validation
  for security.
* **Untrusted content rendering**: verify HTML, SVG, Markdown, and sandboxed `<iframe>` sinks (such
  as inbound e-mail rendering, QR codes, and remote Markdown) prevent script execution, unsafe URL
  protocols, and unsafe file downloads.
* **Storage, bridges & payloads**: check client storage, dynamic links, `postMessage`/device
  bridges, and Server-to-Client props so secrets, tokens, or unauthorized PII are never exposed.

### 4. Entry-point security checks
Because Next.js layouts do not re-run on every navigation, every entry point must enforce its own
security boundary:
* **Route handlers** (`route.ts` / `route.tsx` across all of `app/`): every exported HTTP method
  opens with an appropriate check (user auth + resource authorization, shared secret, webhook
  signature, or verified intentional public access with safe response headers).
* **Pages & layouts** (`page.tsx`, `layout.tsx`, and `generateMetadata`): no `'use client'` pages
  or layouts; every non-public page begins with the appropriate authentication and permission check
  for its area, and metadata does not leak protected data before auth.
* **Server Actions & `<DataTable>` data sources**: every `'use server'` function and
  `createDataSource()` validates inputs, enforces explicit permission/ownership checks beyond mere
  sign-in (preventing IDOR on bound or URL parameters), and justifies any `allowVisitors: true`,
  `allowUnauthenticated()`, or non-`executeServerAction()` usage.

### 5. Keep this skill up-to-date
Audit `.agents/skills/security-review/SKILL.md` itself against the current repository: verify its
references and assumptions are still accurate, identify any new security-sensitive areas or attack
surfaces it should cover, and propose concrete updates.

## Known Intentional Patterns
Do not report the following deliberate design choices as vulnerabilities (list them under
**Verified Exceptions** instead):
* **`updateVolunteerNotes` (`app/schedule/[event]/volunteers/[volunteer]/VolunteerActions.ts`)**:
  Intentionally authorizes with `volunteers.participation:read` (event-scoped, `kAnyTeam`) so
  leaders who can view volunteer notes in the schedule app can also update them across teams.
* **`VendorTable` (`app/admin/events/[event]/[team]/first-aid/VendorTable.tsx`)**:
  Intentionally maps `create`, `update`, and `delete` operations to `volunteers.vendor-teams:update`
  (keeping `read` separate).

## Report Format
Present findings concisely in four sections:
1. **Summary**: Scope covered and finding counts by severity (`Critical`, `High`, `Medium`, `Low`,
   `Info`).
2. **Findings**: Ordered by severity with file links/lines, impact, and recommended fix.
3. **Verified Exceptions**: Intentionally public entry points, `allowVisitors: true` actions, and
   sensitive client sinks checked and confirmed safe.
4. **Skill Freshness**: Suggested updates to this skill from Goal 5 (apply only if asked).
