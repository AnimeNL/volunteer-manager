# AnimeCon Volunteer Manager
This repository contains the [AnimeCon](https://animecon.nl/) Volunteer Manager, through which the
Crew, Crew Care, Festival Host and Steward teams will be managed. The following features are
available in the current version:

  * Multi-tenant landing page referring visitors to all active events,
  * Registration portal for information backed by a CMS, allowing visitors to apply to join,
    * Volunteers can use passkeys as opposed to passwords to access their accounts,
    * Once approved, volunteers can express their hotel and training preferences, share their
      availability and, after the event, request their ticket to be refunded.
  * Administration area for managing the volunteers,
    * Several dashboards summarising the current status of an event's organisation,
    * Flexible event management for any number of in-flight events at once,
      * Automatic program sync with the AnimeCon AnPlan tool, including a changelog,
      * Automatic e-mail generation for mutations that directly impact volunteers,
      * Define shifts and provide scheduling per volunteer, across teams and aligned with the
        event's program,
      * Separated application and volunteer management systems, per team, per event,
      * Hotel booking management including support for non-volunteers and warnings,
      * Retention management to easily approach volunteers who helped out before, including the
        ability to generate both e-mail and text messages,
      * Training scheduling management including support for non-volunteers and warnings,
      * Vendor management and scheduling for First Aid and Security teams,
    * Knowledge Base to provide volunteers access to categorised Q&A during the event,
    * Full accountability through extensive logging, including any and all outgoing messages,
    * Powerful permission management based on assigned roles and expressly granted privileges,
    * Direct integration with our friends at [Del a Rie Advies](https://delarieadvies.nl).
  * Multi-year statistics, each of which can be sliced by team and situation,
  * GDPR-compliant data export tool, enabling third parties to securely access the data they need
    with strict limits on availability, time and request limits.

The Volunteer Manager has integrations with [AnPlan](https://animecon.nl/),
[Google Cloud](https://cloud.google.com) and the
[Google Vertex AI API](https://cloud.google.com/vertex-ai/docs/reference/rest) for sourcing event
information and implementing certain functionality. A MySQL (or MariaDB) database is used, for which
we use the excellent [ts-sql-query](https://ts-sql-query.readthedocs.io/en/stable/) library.

A [purpose built scheduler](app/lib/scheduler/) is included to execute one-off and repeating tasks
outside of user requests, enabling the Volunteer Manager to optimise for imediate responsiveness.

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
$ npm run serve
```

It is recommended to run the `build` and `test` commands prior to committing a change.

The `serve` command spawns a local server that features live reload and advanced debugging
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
