# Agent Guidelines (`app/admin`)

## Authentication
All entry points in `app/admin/` (pages, layouts, Server Actions, and data sources) must use one of
the `requireAuthentication` variants (such as `requireAuthentication(WithEvent(AndTeam?)?)`) from
`@lib/requireAuthentication`.

## Obtaining event and team data
When accessing event and/or team data, `requireAuthenticationWithEvent(AndTeam?)` provides the
cached `CachedEvent` and `CachedTeam` instances. Strongly prefer this over calling `getEvent()` /
`getTeam()` separately or writing manual database queries.

## Header and metadata
Each page in `app/admin/` must start with a `<Section>` component that includes breadcrumbs. It must
also export a `generateMetadata` constant that calls into `createGenerateMetadataFn()` with those
same breadcrumbs in the reverse order. OK to use numeric parameters where substitutions are not
available.

## Logging
Use `LogBuilder` with a `LogDescriptor` entry added in the appropriate section. Avoid superfluous
conditionals around the recording call by using `withCondition()`.

## Dialogs
Outside of `app/admin/components`, use `<ResponsiveConfirmationDialog>`, `<ResponsiveFormDialog>`
or `<ResponsiveDialog>` instead of manual dialogs.

## Sections
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
