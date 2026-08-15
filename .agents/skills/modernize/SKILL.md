---
name: modernize
description: Explains how to modernize code in a particular area of the system.
---

# Skill Name: Modernize a page

## Instructions & Core Logic
The system has been written over the course of a decade, and includes code that is many years old.
Sometimes the code has to be brought up to modern standards. These are the rules to follow:

### Use of React Server Components
Pages and layouts never should include 'use client' at the top, they always should be RSC. Each
page and layout must begin with an access check, unless it's a public page (for example in the
`/welcome` directory).

## Administration area (`app/admin/`)

### Authentication
Never use `verifyAccessAndFetchPageInfo()`; `requireAuthentication(Context?)WithEvent(AndTeam?)`
is the modern way of doing authentication for code in `app/admin/events/`, whereas other code
should use `requireAuthenticationContext` directly.

### Header and metadata
Each page in `app/admin/` must start with <Section> component that includes breadcrumbs. It also
must export a `generateMetadata` constant that calls into `createGenerateMetadataFn()` with those
same breadcrumbs in the reverse order. OK to use numeric parameters where substitutions are not
available.

### Obtaining event and/or team data
When accessing event and/or team data, the `requireAuthentication(Context?)WithEvent(AndTeam?)`
function will give you access to the cached versions. Strongly prefer this over alternatives.

* When data is missing from `CachedEvent` or `CachedTeam`, ask the user whether it should be added.
* When the event or team cannot be derived from the authentication check, use the `getEvent()` or
  `getTeam()` methods exposed from `@app/lib/cache` instead.
* When neither is an option, ask the user for confirmation on whether a manual database query is
  preferred over another approach. Maybe consider one or two alternatives.

### Logging
The `RecordLog` system is deprecated and should no longer be used. Substitute with a `LogBuilder`
statement, including a new `LogDescriptor` entry added in the appropriate section. Remove any
superfluous conditionals around the recording call by using `withConditional()`. Remove any
outdated log types from `Log.tsx`.

### API routes vs. Server Actions
Use of any API routes (i.e. `callApi()` or direct calls into `/api/...`) are deprecated and must be
superseded with a Server Action. Convention is to add a local `FeatureActions.ts` (where "Feature"
is the name of the ~page you're editing) that exposes Server Actions. Each Server Action should:

1. Have a clear Zod-based validation protocol, using transformers where applicable,
2. Wrap the Server Action implementation itself in `executeServerAction()` to run our access and
   security checks.
3. Lead the implementation with an applicable authentication check.

It should be rare for a Server Action to not write a log message. Ask the user for confirmation when
this is omitted.

### Dialogs
Use of <ConfirmationDialog>, <ServerActionDialog> and <SettingDialog> outside of
`app/admin/components` is deprecated and must be superseded. Instead, use
<ResponsiveConfirmationDialog>, <ResponsiveFormDialog> or <ResponsiveDialog>.

### Sections
At the top-level of a page or layout, the following rules exist:

1. The first child should be a <Section> that contains an icon in the "primary" color, a title, and
   breadcrumbs. It must also contain a <SectionIntroduction>.
2. Most of the page content should be in a second <Section>. When a page has a <SectionTabContext>
   in its ancestry, the "tabs" prop should be passed. When it is a detail page of a tabbed section,
   for example a tab called "Prompts" which lists the prompts, and the page is the detail page of
   one of those prompts, then the "back" prop should also be passed.
3. When a <Section> does not have the "noHeader" prop, it must have both a title and an icon. The
   icon must not be given any colour, unless it's important for context. (E.g. "danger zone".)
4. Use of non-<Section> top-level components, unless they're a variant such as <FormGridSection>,
   should be relatively rare. Ask the user for confirmation when in doubt.

### Tabs
Use of <NavigationTabs> is deprecated and must be superseded. Instead:

1. Migrate any page headers from the local `layout.tsx` to each individual page, adjusting their
   titles as appropriate.
2. Change `layout.tsx` to wrap its children in a <SectionTabContext> instead
3. Change each page so that the first <Section> after the header is given the "tabs" prop, such
   as <Section tabs>.

### Use of deprecated components
The following components are no longer supported and should be substituted:

* <CollapsableSection> should become a regular <Section>
* react-hook-form <FormContainer> should be updated to use <FormGridSection>, <FormGrid> or
  <FormProvider>, as most applicable
* MUI <Paper> at a layout or page's top level almost never is appropriate, and should be updated
  to use a <Section> with a <SectionIntroduction>.
* MUI <Table> should be updated to use a <KeyValueList>
