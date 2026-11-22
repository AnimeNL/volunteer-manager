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
We depend on a private `volunteer-manager-timeline` component, availability of which is restricted;
talk to one of the maintainers of this repository if you need access. Releases of this package are
published on [GitHub's NPM registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry) (also [see StackOverflow](https://stackoverflow.com/questions/28728665/how-to-use-private-github-repo-as-npm-dependency)).

You will have to log in to GitHub's NPM repository to access the private package:

```
npm login --scope=@beverloo --registry=https://npm.pkg.github.com
```

### Building a developer environment
Developing the AnimeCon Volunteer Manager follows NextJS' best practices. The following commands are
enabled and actively supported:

```
$ npm run build
$ npm run dev
```

It is recommended to run the `build` and `test` commands prior to committing a change.

The `dev` command spawns a local server that features live reload and advanced debugging
capabilities. This is the recommended environment for development. In order for this to work well,
you will need to copy [`.env.development.sample`](.env.development.sample) to `.env.development` and
fill in the details of a MySQL database, as well as various encryption passwords. Each of those
passwords needs to be at least 32 characters in length.

### Building a production environment
Deployment of the AnimeCon Volunteer Manager happens using a Docker image. One can be created by
running the following command, instructed by our [Dockerfile](Dockerfile):

```
$ npm run build-prod
```

Once the image has been created, you can run it locally through `npm run serve-prod`, providing
Docker has been installed on your system. The production environment will need a completed
`.env.production` file based on [`.env.production.sample`](.env.production.sample).

### Deploying to production
Deployment to the actual server is done through a [GitHub Action](.github/workflows/deploy.yml) that
mimics these steps remotely. This action is accessible through the GitHub user interface.

## Testing

### Vitest and unit tests
We use [Vitest](https://vitest.dev/) for unit tests in the project. They primarily focus on
server-side logic, as using them for client-side components is awkward at best. (Consider
Playwright.) Adding unit tests is easy and cheap, so should be the default for anything involving
non-trivial logic.

```
$ npm run test
```

### Playwright end-to-end tests
We use [Playwright](https://playwright.dev/) to enable end-to-end testing of the critical user
journeys part of the Volunteer Manager. The full suite can be found in [`e2e/`](./e2e), where the
cases are grouped together based on their use case.

```
$ npm run test:e2e
```

Not everything is expected to be covered by end-to-end tests, their primary purpose is to act as a
smoke test for important user journeys that we don't manually verify frequently. An example would be
creating an account, as it's safe to assume everyone working on this project has one.

## Debugging

### TypeScript performance tracing
Our project relies heavily on TypeScript for typing, and the "linting and checking validity of
types" step is the slowest step in our build process. Use of recursive types and branches with far
reaching consequences have repeatedly doubled, if not tripled build times.

The [TypeScript Performance](https://github.com/microsoft/TypeScript/wiki/Performance) page contains
a wealth of information on how to debug this. We've had success in identifying issues using tracing,
which can be created as follows:

```
$ npx tsc -p ./tsconfig.json --generateTrace trace
```

The generated `trace.json` file, in the `trace/` directory, can then be inspected using the
[Perfetto](https://ui.perfetto.dev/#!/viewer) tool. Any file or type that takes more than 100ms
should be considered a concern.

Another way to analyse the generated trace is to use the
[@typescript/analyze-trace](https://www.npmjs.com/package/@typescript/analyze-trace) tool, which can
be done as follows:

```
$ npm install --no-save @typescript/analyze-trace
$ npx analyze-trace trace
```

This tool will highlight any file that takes more than 500ms of compilation time. Note that the
output is a little bit harder to read, as there exists a compounding effect where e.g. all of MUI
may be attributed to an otherwise unrelated file.
