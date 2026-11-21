# Agent Guidelines (`app/lib/auth`)

## Documentation & Public API
- **Keep `README.md` up-to-date**: Any change to authentication, session lifecycle, cryptography,
  abuse controls, or authorization semantics must be reflected in `app/lib/auth/README.md`. Keep it
  under 100 lines and focused on motivations and security properties rather than file or function
  lists.
- **Do not expand `index.ts` without confirmation**: Avoid adding exports to `index.ts`,
  `access/index.ts`, or `actions/index.ts`. Any new public export must be explicitly confirmed by
  the human first, and should be high-level and minimal to preserve internal flexibility. External
  code should import through these barrel files rather than deep-importing internal modules.

## Deliberate Design Decisions
- **Retain legacy password verification**: Legacy non-Argon2id password hashes (`scrypt` and
  wrapped `legacy-v0`) *must* remain verifiable so returning annual volunteers silently upgrade to
  Argon2id on sign-in.
- **`users.session_token` is for password resets only**: Browser sessions live exclusively in
  `users_sessions`. `users.session_token` is retained solely to make sealed password-reset tokens
  single-use (rotated on password updates/resets) — do not remove it or repurpose it for sessions.
- **Auth cache & `bypassCache`**: Any mutation changing a user's profile, permissions, event
  participations, activation status, or credentials must call
  `invalidateAuthCache(/* forUserId= */ userId)` (or `invalidateAuthCache()` for global role/event
  changes). High-risk security mutations (password changes, passkey management, admin account
  actions) must verify against the database via `requireAuthenticationContext` with
  `{ bypassCache: true }`.
- **Prefer `requireAuthenticationContext()`**: Use `requireAuthenticationContext()` whenever
  unauthenticated requests should fail with `401`. Reserve `getAuthenticationContext()` for routes
  or actions that genuinely support visitors or return custom responses/redirects.

## Testing Gotchas
- **Avoid importing `next/headers` inside `vi.mock('next/headers')` factories**: In Vitest,
  importing a helper module (such as `actions/ActionTestHelpers.ts`) from an async
  `vi.mock('next/headers', ...)` factory will bind the real `next/headers` if that helper
  transitively imports `AuthenticationContext.ts` or any other runtime consumer of `next/headers`.
  Keep test helpers free of runtime `next/headers` imports (e.g. clear
  `Cache.getInstance('Authentication')` directly instead of importing `invalidateAuthCache`).
