# Authentication & Authorization (`app/lib/auth`)

This component owns identity, session lifecycle, credential security, and permission evaluation
across three entry points: `@lib/auth` (request identity, sessions, cache, impersonation, displays,
admin helpers), `@lib/auth/access` (permission evaluation and enforcement), and `@lib/auth/actions`
(Server Actions for sign-in, registration, passkeys, passwords, and profile/avatar updates).

## Authentication & Security Properties

### Argon2id-based password hashing
New passwords use [Argon2id] ([OWASP] baseline) with per-password random salts, constant-time
verification, and strict length and parameter bounds to prevent hashing DoS. Because volunteers
often return once a year, legacy [scrypt] and offline Argon2id-wrapped `$legacy-v0` hashes remain
verifiable and silently upgrade to Argon2id on sign-in via a conditional update so concurrent
password changes are never clobbered.

### One-time access codes
Admins can issue `XXXX-XXXX` codes (8 characters from an unambiguous 32-character alphabet
excluding `0`/`O` and `1`/`I`/`L`, providing 40 bits of entropy) for active, non-anonymized
accounts. Newly issued codes expire after 24 hours, are stored Argon2id-hashed (while legacy codes
remain verifiable), are atomically consumed on use or cleared on password or passkey sign-in, are
rejected for authenticated password changes, and never establish a session directly — they only
grant a single-use token to set a new password.

### Per-device sessions, displays & impersonation
Each sign-in revokes any existing device session cookie before creating a server-backed session
storing only a SHA-256 hash of a 256-bit secret, so a database read leak cannot mint cookies while
allowing per-device (sign-out) or bulk (atomic password changes/resets, deactivation,
anonymization) revocation — including any impersonation sessions initiated by that user. Cookies
are `HttpOnly`, `SameSite=Lax`, and `Secure` in production; user sessions expire after 270 days
(covering an annual festival cycle), while stateless display cookies run for 399 days.
Impersonation rejects self- and nested impersonation, revokes the prior session, stores the
impersonator and sanitized return URL server-side, and atomically consumes the impersonation
session on sign-out before restoring a fresh session only if the impersonator remains active.

### Purpose-isolated sealed tokens
Cookies and e-mail links (sessions, displays, passkey challenges, registration, password resets)
are encrypted and authenticated with [AES-256-GCM] using `>= 32`-character secrets validated at
startup and strict canonical base64url decoding. Keys are derived per purpose via [HKDF-SHA256]
and bound with GCM Additional Authenticated Data so tokens cannot be replayed across flows; the
token primitive supports key IDs and secret lists for rotation, and expiration is checked only
after authentication succeeds. Both registration and password-reset links bind to
`users.session_token` (enforced atomically and rotated on activation, deactivation, anonymization,
and password changes/resets) for single-use enforcement without a token table.

### Passkeys & WebAuthn
[WebAuthn] ceremonies enforce explicit `requireUserVerification: true` and store challenges in
5-minute, client-cleared `HttpOnly` sealed cookies bound to ceremony type, relying party, and user
to prevent cross-flow substitution. Signature counters are updated monotonically, and all
verification failures (exceptions, unverified responses, or counter regressions) are logged to help
detect cloned authenticators.

### Authentication caching & freshness
Resolved contexts are cached per user (15-minute TTL, 1,000-user cap, with constant-time secret
checks on hits) and deduplicated per render; hidden events and soft-deleted teams are excluded when
loading participations. High-risk mutations (password changes, passkey management, admin avatar
overrides, destructive admin account actions) bypass the cache — evicting stale cached entries on
failed verification — and mutations to user or global authorization state invalidate the cache.

### Rate limiting, enumeration & proxy trust
In-process, per-bucket, memory-bounded sliding-window rate limits protect sign-in, registration,
password reset/change, and avatar uploads: password sign-in, reset requests, and password changes
are dual-keyed (`IP + account/user`, checking IP first), reset verification is IP-rate-limited,
IPv4-mapped IPv6 addresses unwrap canonically, IPv6 addresses bucket by `/64` prefix, and breach
logs are deduplicated per window. Identity confirmation and registration intentionally disclose
account existence to drive the single-dialog sign-in UX, relying on IP rate limits against bulk
enumeration while password reset requests remain non-enumerable. Production runs behind a reverse
proxy that validates `Host` and overwrites `X-Forwarded-For`; post-auth and sign-out redirects
accept only single-slash relative paths, rejecting backslashes and control characters.

## Authorization Model

### Hierarchical, deny-by-default permissions
Permissions are declared as boolean or CRUD (`create`, `read`, `update`, `delete`), with optional
mandatory event/team scopes and `restrict: 'root'` assignment metadata enforced by admin actions.
Unknown permissions, invalid CRUD operations, omitted required scopes, or empty `and()`/`or()`
sets fail closed.

### Specificity, revocations & roles
Dotted paths let administrators combine broad grants with targeted exceptions. Event participations
grant role permissions scoped to `(event, team)`, while user-level `events`/`teams` allow-lists
(including `*`) extend scoped grants. Evaluation walks from most- to least-specific and returns at
the first matching level, checking revocations before grants at that level (so a child grant
overrides a parent revoke, while same-level revokes win); within grants and within revokes, a
global entry supersedes scoped entries for the same permission. Scoped revocations ignore wildcard
queries so revoking one event or team does not affect others. Reusable permission roles (including
`root`) expand with cycle detection, and role revokes inherit the grant's scope. Unauthenticated
requests fail with `401`; unauthorized ones with `403`.

[AES-256-GCM]: https://csrc.nist.gov/pubs/sp/800/38/d/final
[Argon2id]: https://datatracker.ietf.org/doc/html/rfc9106
[HKDF-SHA256]: https://datatracker.ietf.org/doc/html/rfc5869
[OWASP]: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
[scrypt]: https://datatracker.ietf.org/doc/html/rfc7914
[WebAuthn]: https://www.w3.org/TR/webauthn-2/
