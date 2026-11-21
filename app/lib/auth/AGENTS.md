# Agent Guidelines (`app/lib/auth`)

## Documentation & Public API
- **Keep `README.md` up-to-date**: Any change to authentication, session lifecycle, cryptography,
  abuse controls, or authorization semantics must be reflected in `app/lib/auth/README.md`. Keep it
  under 150 lines and focused on motivations and security properties rather than file or function
  lists.
- **Do not expand `index.ts` without confirmation**: Avoid adding exports to `index.ts`,
  `access/index.ts`, or `actions/index.ts`. Any new public export must be explicitly confirmed by
  the human first, and should be high-level and minimal to preserve internal flexibility. External
  code should import through these barrel files rather than deep-importing internal modules.

## Deliberate Design Decisions
- **Retain legacy password verification**: The production database still contains raw `scrypt`
  password hashes and will for at least another year. Raw `scrypt` verification, offline
  `wrapLegacyPasswordHash()`, and `$legacy-v0` verification *must* remain intact until migrated or
  aged out so returning annual volunteers silently upgrade to Argon2id on sign-in.
- **`users.session_token` is for single-use e-mail tokens only**: Browser sessions live exclusively
  in `users_sessions`. `users.session_token` is retained solely to bind sealed password-reset and
  registration-activation tokens (rotated on activation, deactivation, and password changes) — do
  not remove it or repurpose it for sessions.
- **Auth cache & `bypassCache`**: Any mutation changing a user's profile, permissions, event
  participations, activation status, or credentials must call
  `invalidateAuthCache(/* forUserId= */ userId)` (or `invalidateAuthCache()` for global role/event
  changes). High-risk security mutations (password changes, passkey management, admin account
  actions) must verify against the database via `requireAuthenticationContext` with
  `{ bypassCache: true }`.
- **Prefer `requireAuthenticationContext()`**: Use `requireAuthenticationContext()` whenever
  unauthenticated requests should fail with `401`. Reserve `getAuthenticationContext()` for routes
  or actions that genuinely support visitors or return custom responses/redirects.
- **Trusted reverse-proxy headers (`Host` and `X-Forwarded-For`)**: The production reverse proxy
  validates `Host` against configured virtual hosts and overwrites `X-Forwarded-For` with the
  connecting client IP. Auth actions and rate limiters may rely on both headers directly without
  re-validating `Host` against the database or walking proxy hops.
- **Intentional identifier-first lookup (`confirmIdentityAction`)**: `confirmIdentityAction` and
  `registerAction` deliberately disclose whether an e-mail address corresponds to an existing or
  activated account (and whether passkeys are enrolled) to drive the single-dialog
  `<AuthenticationFlow>` UX. Do not replace these with generic non-enumerable responses; bulk
  enumeration is mitigated via IP rate limiting (`confirm-identity-ip` and `register-ip`), while
  `requestPasswordResetAction` remains non-enumerable.

## Testing Gotchas
- **Avoid importing `next/headers` inside `vi.mock('next/headers')` factories**: In Vitest,
  importing a helper module (such as `actions/ActionTestHelpers.ts`) from an async
  `vi.mock('next/headers', ...)` factory will bind the real `next/headers` if that helper
  transitively imports `AuthenticationContext.ts` or any other runtime consumer of `next/headers`.
  Keep test helpers free of runtime `next/headers` imports (e.g. clear
  `Cache.getInstance('Authentication')` directly instead of importing `invalidateAuthCache`).
