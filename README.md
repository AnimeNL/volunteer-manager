# AnimeCon Volunteer Manager
This repository contains the [AnimeCon](https://animecon.nl/) Volunteer Manager, through which the
Crew, Crew Care, Festival Host and Steward teams are managed. The following features are available
in the current version:

  * Multi-tenant landing page referring visitors to all active events,
  * Registration portal backed by a CMS, allowing visitors to apply and manage their participation,
    * Secure authentication with passkeys or Argon2id passwords and per-device session management,
    * Versioned preferences for hotels, trainings, availability, language and ticket refunds.
  * Volunteer schedule portal and venue displays for use during the event,
    * Personal schedules, festival ticket QR codes, categorised Knowledge Base and feedback tracking,
    * Venue displays showing live schedules with integrated help-request support.
  * Responsive, Dark Mode-enabled administration area for managing events and volunteers,
    * Overview dashboards covering event status, deadlines, recent changes, finances and diagnostics,
    * Flexible event management for any number of in-flight events at once,
      * Automatic program sync with AnimeCon's AnPlan tool, including history and owner outreach,
      * AI-assisted, personalised volunteer outreach across e-mail, SMS and WhatsApp,
      * Shift definition and cross-team scheduling aligned with the event's program,
      * Separated application (with claiming), volunteer, retention and vendor management,
      * Hotel and training management with preference history, payment tracking and non-volunteers,
      * Ticketing and financial dashboards (volunteer, associate and visitor tickets, QR codes,
        UTM filtering and anonymisation),
      * Duty Book with AI-generated summaries and Knowledge Base management,
    * Multi-account team e-mail management with integrated threaded inboxes (SMTP & IMAP),
    * Full accountability through structured logging, API instrumentation and outbound message logs,
    * Dynamic role-based permission management supporting scoped grants and revokes,
    * Direct integration with our friends at [Del a Rie Advies](https://delarieadvies.nl).
  * GDPR-compliant data export tool with strict availability, time and request limits.

The Volunteer Manager integrates with [AnPlan](https://animecon.nl/) for program data, the
[Google Gemini API](https://ai.google.dev/) for AI-assisted content generation and decisions,
[Weeztix](https://weeztix.com/) and [YourTicketProvider](https://www.yourticketprovider.nl/) for
ticketing and financial data, [Twilio](https://www.twilio.com/) for SMS and WhatsApp messaging, and
SMTP/IMAP servers for team e-mail. A MySQL (or MariaDB) database is used via
[ts-sql-query](https://ts-sql-query.readthedocs.io/en/stable/).

A [purpose-built scheduler](app/lib/scheduler/) is included to execute one-off and repeating tasks
outside of user requests, enabling the Volunteer Manager to optimise for immediate responsiveness.

## Building and deploying

### Checking out the repository
This project requires Node.js `>=26.0.0` and depends on a private
`@AnimeNL/volunteer-manager-timeline` package fetched directly over Git from GitHub. Talk to one of
the maintainers of this repository if you need access, and ensure your local Git configuration (SSH
key or personal access token) can clone private `AnimeNL` repositories before running `npm install`.

### Building a developer environment
Developing the AnimeCon Volunteer Manager follows Next.js' best practices. The following commands
are enabled and actively supported:

```
$ npm run dev                   # Local dev server with Turbopack and hot reload
$ npm run serve-with-scheduler  # Local dev server with the background scheduler enabled
$ npm run build                 # Production Next.js build
$ npm run lint                  # Biome lint and code quality checks
$ npm run test                  # Vitest unit and component test suite
```

It is recommended to run `build`, `lint` and `test` prior to committing a change.

To run the local server, copy [`.env.development.sample`](.env.development.sample) to
`.env.development` and fill in the details of a MySQL (or MariaDB) database as well as the
encryption secrets. Each of the sealing passwords (`APP_COOKIE_PASSWORD`, `APP_PASSRESET_PASSWORD`,
and `APP_REGISTRATION_PASSWORD`) must be at least 32 characters in length.

### Building and deploying to production
Deployment of the AnimeCon Volunteer Manager happens via a multi-stage standalone Next.js Docker
image defined in our [Dockerfile](Dockerfile). Pass a GitHub token with read access to the private
timeline dependency as a build argument:

```
$ docker build --build-arg GH_TOKEN=<token> -t volunteer-manager .
```

The container serves the application on port `3000`, exposes a `/statusz` health check endpoint
(used by [`healthcheck.mjs`](healthcheck.mjs)), and requires environment variables matching
[`.env.production.sample`](.env.production.sample).

## Testing and linting
We use [Vitest](https://vitest.dev/) for unit and component tests across both `node` (server-side
logic) and `jsdom` (React Testing Library) environments, and [Biome](https://biomejs.dev/) for
linting and cognitive complexity checks. Adding unit tests is cheap and fast, and should be the
default for anything involving non-trivial logic.

```
$ npm run test
$ npm run test:watch
$ npm run lint
```

## Debugging

### TypeScript performance tracing
Our project relies heavily on TypeScript for typing, and type-checking can become a bottleneck when
complex or recursive types are introduced. The
[TypeScript Performance](https://github.com/microsoft/TypeScript/wiki/Performance) page contains a
wealth of information on how to debug this. Tracing can be generated as follows:

```
$ npx tsc -p ./tsconfig.json --generateTrace trace
```

The generated `trace.json` file in `trace/` can be inspected with
[Perfetto](https://ui.perfetto.dev/#!/viewer) (anything over 100ms is worth investigating), or
summarised with [@typescript/analyze-trace](https://www.npmjs.com/package/@typescript/analyze-trace):

```
$ npx --yes @typescript/analyze-trace trace
```
