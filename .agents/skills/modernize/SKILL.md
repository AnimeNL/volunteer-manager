---
name: modernize
description: Explains the conventions and standards for code in a particular area of the system.
---

# Skill Name: Modernize a page

## Instructions & Core Logic

### Use of React Server Components
Pages and layouts should be React Server Components (no `'use client'` at the top). Each page and
layout must begin with an access check, unless it's a public page (for example in the `/welcome`
directory).

## Administration area (`app/admin/`)

### Authentication
All code in `app/admin/` must use one of the `requireAuthentication` variants (such as
`requireAuthentication(WithEvent(AndTeam?)?)`) from `@lib/requireAuthentication`.

### Database access
Code interacting with the database must do so using `db` from `@lib/database`. When multiple queries
or transactions are run in a single function or system, store `db` in a local `dbInstance` so that
the same connection is used throughout.

### Header and metadata
Each page in `app/admin/` must start with a `<Section>` component that includes breadcrumbs. It must
also export a `generateMetadata` constant that calls into `createGenerateMetadataFn()` with those
same breadcrumbs in the reverse order. OK to use numeric parameters where substitutions are not
available.

### Obtaining event and/or team data
When accessing event and/or team data, the `requireAuthenticationWithEvent(AndTeam?)` function will
give you access to the cached versions. Strongly prefer this over alternatives.

* When data is missing from `CachedEvent` or `CachedTeam`, ask the user whether it should be added.
* When the event or team cannot be derived from the authentication check, use the `getEvent()` or
  `getTeam()` methods exposed from `@app/lib/cache` instead.
* When neither is an option, ask the user for confirmation on whether a manual database query is
  preferred over another approach. Maybe consider one or two alternatives.

### Logging
Use `LogBuilder` with a `LogDescriptor` entry added in the appropriate section. Avoid superfluous
conditionals around the recording call by using `withCondition()`.

### Server Actions
Convention is to add a local `FeatureActions.ts` (where "Feature" is the name of the page you're
editing) with a top-level `'use server';` directive. Each Server Action should:

1. Have a clear Zod-based validation protocol, using transformers where applicable.
2. Wrap the Server Action implementation itself in `executeServerAction()` to run our access and
   security checks.
3. Lead the implementation with an applicable authentication check.

It should be rare for a Server Action to not write a log message. Ask the user for confirmation when
this is omitted.

### Dialogs
Outside of `app/admin/components`, use `<ResponsiveConfirmationDialog>`, `<ResponsiveFormDialog>`
or `<ResponsiveDialog>` instead of manual dialogs.

### Sections
At the top-level of a page or layout, the following rules exist:

1. The first child should be a `<Section>` that contains an icon in the `"primary"` color, a title,
   and breadcrumbs. It must also contain a `<SectionIntroduction>`.
2. Most of the page content should be in a second `<Section>`. When a page has a
   `<SectionTabContext>` in its ancestry, the `tabs` prop should be passed. When it is a detail
   page of a tabbed section — for example a tab called "Prompts" which lists the prompts, and the
   page is the detail page of one of those prompts — then the `back` prop should also be passed.
3. When a `<Section>` does not have the `noHeader` prop, it must have both a title and an icon. The
   icon must not be given any colour, unless it's important for context (e.g. "danger zone").
4. Use of non-`<Section>` top-level components, unless they're a variant such as
   `<FormGridSection>`, should be relatively rare. Ask the user for confirmation when in doubt.
