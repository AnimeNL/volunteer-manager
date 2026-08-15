---
name: create-data-table
description: Explains how to introduce new usage of the <DataTable> component. Trigger this skill with "implement <DataTable>"
---

# Skill Name: Create a new <DataTable>

## Instructions & Core Logic
Your objective is to implement a new usage of the <DataTable> component. The following capabilities
are available, and you need to understand the requirements:

1. The context (`withContext()`) is used when the <DataTable> can have multiple data tenants, for
   example multiple events, or multiple event+team tuples. Always use transformers such as the
   `kEventTransformer` or `kTemporalZonedDateTime` when applicable.
2. Authorization (`authorize()`) is always required. You must use `executeAccessCheck()` matching
   the same permission as the page that embeds the <DataTable>. Use the `operations` parameter when
   a CRUD permission is used.
3. Listing data (`list()`) is always required. This operation supports pagination and search
   capabilities, which are usually required, but may be omitted for data tables with fewer (less
   than 50) entries. Ask the user when uncertain. Searching must always be case insensitive.
4. Creating data (`create()`), deleting data (`delete()`) and updating data (`update()`) may be
   considered. When used, these should always write a log entry. We exclusively use soft deletes,
   so the use of `DBConnection.delete()` is prohibited.

When any of the requirements are not clear, ask the user for confirmation.

You first implement the data source (using `createDataSource`). Do this in the same file as the page
that embeds it, unless there are reasons this is not possible, for example because the data source
has to be used by multiple pages. Ask the user for confirmation if so.

You then implement the `<DataTable>` component. There are a few considerations here:

1. Try to match existing columns in the system when you can. If you notice that a particular column
   type and content is used three or more times, tell me when (a) they use different width or
   positions, or (b) they use custom components that could be generalised.
2. `renderCell` and `renderHeader` must not be used, and custom components are necessary for those.
   DO NOT ADD CUSTOM COMPONENTS WITHOUT ASKING. Use the templates when available, or ask for
   confirmation to add one. When adding a new component, create a new file "FeatureCells.tsx" (where
   "Feature" is something applicable) that has a 'use client' directive at the top.
3. Date columns must have a width of 185. Icon-only columns a width of 50. All other columns must
   have a "flex" width defined.
4. Think carefully about relevant `listViewProps` for the mobile display. Mobile users should see
   less information, so display must focus on the key, relevant data.
