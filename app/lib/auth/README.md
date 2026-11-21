# Authentication & Authorization (`app/lib/auth`)

This component owns identity, session lifecycle, credential security, and permission evaluation
across three entry points: `@lib/auth` (request identity, sessions, cache, impersonation, displays,
admin helpers), `@lib/auth/access` (permission evaluation and enforcement), and `@lib/auth/actions`
(Server Actions for sign-in, registration, passkeys, passwords, and profile updates).

## Authentication & Security Properties

### Argon2id-based password hashing
New passwords use [Argon2id] ([OWASP] baseline) with per-password random salts and constant-time
verification to resist offline cracking, with length bounds preventing hashing DoS. Because
volunteers often return once a year, legacy [scrypt] hashes remain verifiable and silently upgrade
to Argon2id on sign-in via a conditional update so concurrent password changes are never clobbered.

### One-time access codes
Admins can issue `XXXX-XXXX` codes (8 characters from an unambiguous 32-character alphabet
excluding `0`/`O` and `1`/`I`/`L`, providing 40 bits of entropy) to help locked-out volunteers
recover access on-site. Codes are stored hashed like passwords and never establish a session
directly — they only grant a single-use token to set a new password.

### Per-device sessions & impersonation
Each sign-in creates a server-backed session storing only a SHA-256 hash of a 256-bit secret, so a
database read leak cannot mint valid cookies while allowing targeted (sign-out) or bulk (password
change) revocation. Cookies are `HttpOnly`, `SameSite=Lax`, `Secure` in production, and expire after
180 days so volunteers re-authenticate at least once per conference cycle. Impersonation records the
impersonator and return URL server-side, restoring a fresh session on sign-out only if the
impersonator's account is still active.

### Purpose-isolated sealed tokens
Cookies and e-mail links (sessions, displays, passkey challenges, registration, password resets) are
encrypted and authenticated with [AES-256-GCM]. Keys are derived per purpose via [HKDF-SHA256] and
bound with GCM Additional Authenticated Data so tokens cannot be replayed across flows. Key IDs and
ordered secret lists enable zero-downtime rotation, and expiration is checked only after
authentication succeeds. Password-reset tokens bind to a per-user counter rotated on every password
change, ensuring single-use without a separate token table.

### Passkeys & WebAuthn
[WebAuthn] challenges live in short-lived, single-use sealed cookies bound to ceremony type, relying
party, and user to prevent replay and cross-flow substitution. Credential lookups are constant-time
and signature counters are persisted to help detect cloned authenticators.

### Authentication caching & freshness
Resolved contexts are cached per user (with constant-time secret checks on hits) and deduplicated
per render to avoid redundant database queries. High-risk mutations (password changes, passkey
management) bypass the cache so revoked sessions cannot escalate. Callers mutating user or global
authorization state must invalidate the auth cache.

### Rate limiting & redirect safety
Memory-bounded sliding-window rate limits are dual-keyed by IP and account, with per-IP budgets
sized for many volunteers sharing convention Wi-Fi NAT; triggered limits are logged for visibility.
Post-authentication redirects accept only single-slash relative paths to prevent open redirects.

## Authorization Model

### Hierarchical, deny-by-default permissions
Permissions are explicitly declared as boolean or CRUD (`create`, `read`, `update`, `delete`), with
optional mandatory event/team scopes and root-only visibility restrictions. Unknown permissions or
omitted required scopes throw immediately rather than silently denying.

### Specificity, revocations & roles
Dotted paths let administrators grant broad access while carving out narrow exceptions. Evaluation
walks from most- to least-specific; revocations are checked before grants at every level and always
win. Scoped revocations ignore wildcard queries so revoking one event or team does not affect
others. Reusable permission roles (including `root`) expand with cycle detection, and role revokes
inherit the grant's scope. Unauthenticated requests fail with `401`; unauthorized ones with `403`.

[AES-256-GCM]: https://csrc.nist.gov/pubs/sp/800/38/d/final
[Argon2id]: https://datatracker.ietf.org/doc/html/rfc9106
[HKDF-SHA256]: https://datatracker.ietf.org/doc/html/rfc5869
[OWASP]: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
[scrypt]: https://datatracker.ietf.org/doc/html/rfc7914
[WebAuthn]: https://www.w3.org/TR/webauthn-2/
