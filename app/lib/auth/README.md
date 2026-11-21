# Authentication & Authorization (`app/lib/auth`)

This module implements authentication, session management, abuse controls, and permission
evaluation across three entry points:

- `@lib/auth` — Request authentication context, cache invalidation, impersonation, display
  cookies, and admin account/session lifecycle helpers.
- `@lib/auth/access` — Hierarchical, scoped RBAC/ABAC permission evaluation (`AccessControl`,
  `checkPermission`, `and`/`or`).
- `@lib/auth/actions` — Next.js Server Actions for sign-in, registration, passkeys, password
  management, and self-service profile updates.

## Authentication & Cryptographic Primitives

- **Password hashing (`Password.ts`)**: New passwords are hashed with **Argon2id** (OWASP baseline:
  19 MiB memory, 2 passes, 1 lane, 32-byte tag, 16-byte random salt) encoded as PHC strings. Length
  is bounded to 8–128 characters to prevent hashing DoS, and digests are compared in constant time
  (`crypto.timingSafeEqual`). Legacy v0 hashes (`scrypt(sha256(pw), APP_PASSWORD_SALT)`, raw or
  offline-wrapped `$legacy-v0$argon2id$...`) remain verifiable and are silently upgraded to Argon2id
  on sign-in using a conditional `WHERE auth_value = previousHash` update so concurrent password
  changes are never overwritten.
- **One-time access codes (`AccountStore.ts`)**: 8-character `XXXX-XXXX` codes drawn from an
  unambiguous 32-character alphabet (40 bits of entropy), stored Argon2id-hashed in `users_auth`.
  Signing in with a code does not create a session; it issues a single-use password-update token.
- **Sealed tokens (`SealedToken.ts`, `Tokens.ts`)**: Compact URL-safe `v1.<kid>.<payload>` tokens
  encrypted with **AES-256-GCM** (12-byte random IV, 16-byte auth tag). Encryption keys are derived
  per purpose (`display`, `passkey-challenge`, `password-reset`, `registration`, `session`) via
  **HKDF-SHA256** and bound to version, purpose, and key ID through GCM Additional Authenticated
  Data (AAD), preventing cross-purpose token replay. Ordered secret lists enable zero-downtime key
  rotation via 6-byte HMAC-derived key IDs (`kid`). Expiration (`exp`) is checked only after GCM
  authentication succeeds.
- **Sessions (`Session.ts`, `SessionStore.ts`, `AuthenticationContext.ts`)**: Per-device sessions
  are stored in `users_sessions` as the SHA-256 hash of a 256-bit random secret. The `auth` cookie
  (`HttpOnly`, `SameSite=Lax`, `Secure` in production, 180-day TTL) carries a sealed
  `{ sessionId, userId, secret }` payload. Impersonation records `impersonator_user_id` and
  `impersonator_return_url` server-side; signing out revokes the impersonation row and restores a
  fresh session for the impersonator only if their account is still active. Password-reset tokens
  (3-hour TTL) embed `users.session_token`, which is incremented on password update/reset alongside
  revoking sessions to enforce single-use.
- **Caching & freshness (`AuthenticationContext.ts`)**: Verified sessions are cached per `userId`
  as `{ context, sessions: Map<sessionId, secretHash> }`, validated in constant time on cache hits,
  and deduplicated per render via `React.cache()`. High-risk mutations (password changes, passkey
  registration/deletion) pass `{ bypassCache: true }` to verify directly against `users_sessions`.
  Call `invalidateUserAuthCache(userId)` or `clearAuthCache()` when user or global authorization
  inputs change.
- **Passkeys (`PasskeyChallenge.ts`, `PasskeyStore.ts`)**: WebAuthn ceremonies use 5-minute,
  single-use sealed `HttpOnly` challenge cookies bound to `{ flow, rpId, userId }`, constant-time
  credential ID matching, and monotonic signature counter persistence.
- **Abuse controls (`RateLimit.ts`, `ActionHelpers.ts`)**: In-process sliding-window rate limiters
  (capped at 10k tracked keys) enforce per-IP and per-account budgets sized for shared convention
  Wi-Fi NAT, recording an `Info` error log when triggered. Post-auth redirects are restricted to
  single-slash relative paths (`/^\/(?!\/)/`) to prevent open redirects.

## Authorization (`access/`)

- **Deny-by-default hierarchical model (`Access.ts`, `AccessControl.ts`, `AccessList.ts`)**:
  Permissions are dotted paths typed as `boolean` or `crud` (`:create`, `:read`, `:update`,
  `:delete`), with optional mandatory `event` and/or `team` scopes and `root` visibility
  restrictions. Unrecognized permissions or missing required scopes throw immediately.
- **Specificity & revocation precedence**: Queries walk from most-specific (`a.b:delete`) to
  least-specific (`a`). At each level, revocations are evaluated before grants and always take
  precedence. Scoped revocations use `requireSpecificScope: true` so wildcard (`*`) checks do not
  falsely trip on a single-event or single-team revoke.
- **Role expansion (`PermissionRoles.ts`)**: Database-defined permission roles (plus `root`,
  expanding to all top-level groups) are cached in `PermissionRoles` and expanded with cycle
  detection. Revocations inherited from a role preserve the event/team scope of the grant.
- **HTTP semantics**: Missing authentication throws `401 Unauthorized`; authenticated users failing
  an access check receive `403 Forbidden`.
