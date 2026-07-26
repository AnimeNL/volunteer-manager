---
name: data-table-migration
description: Explains how to migrate functionality to the <DataTable> component. Trigger this skill with "migrate to <DataTable>".
---

# Skill Name: Migrate to <DataTable>

## Instructions & Core Logic
Your objective is to migrate from an older data table component (<OldDataTable>, <RemoteDataTable>)
to the new <DataTable> component. This has two benefits:

1. The data source (using `createDataSource`) can live with the component, often in page.tsx
2. There don't need to be additional API endpoints to support this API.

The <DataTable> component does not yet support reordering entries or treeview display. If you are
asked to migrate a table using those features, abort and explain that this is not yet possible.

If that is not the case, you must:

1. Identify the best way to implement the new data source:
   - Place the `createDataSource` in the same file as the `<DataTable>` component usage unless told
     otherwise.
   - Implement filtering in `list()` if possible using `params.search`. This should always be case
     insensitive. If filtering is not possible or excessively complicated, ask me how to proceed.
   - Use `executeAccessCheck()` in `authorize()` to avoid excess database queries.
   - Use `kEventTransformer` or `kTeamTransformer` when the context given to a data source is either
     an event or a team. Use of `getEventBySlug()` is strictly prohibited.

2. Identify the best way to implement the new <DataTable>:
   - Try to match existing columns when you can. `renderCell` and `renderHeader` must not be used,
     and custom components are necessary for those. DO NOT ADD CUSTOM COMPONENTS WITHOUT ASKING.
     Rather, use the templates when available, or ask for confirmation to add one. When adding a new
     component, create a new file "FeatureCells.tsx" (where "Feature" is something applicable) that
     has a 'use client' directive at the top.
   - Date columns must have a width of 185. Icon-only columns a width of 50. All other columns must
     have a "flex" width defined.
   - Think carefully about relevant `listViewProps` for the mobile display. Mobile users should see
     less information, so display must focus on the key, relevant data.

3. Clean up the existing code:
   - APIs to support the old data table should be removed unless they're used by something else. In
     that case, remove any and all functionality that's no longer necessary without affecting the
     other user.
   - Consider simplifications in the code that you've written. Is there unnecessary duplication? Is
     there usage of TypeScript's "as any" that can be removed? If there excessive nesting? Fix it.
   - Consider performance improvements in the code that you've written.

Always run the tests and build to confirm that the change is functional.

In your implementation, you must match the existing code style: no lines longer than 100 characters,
match naming and line wrapping conventions, write concise but effective comments focusing on the
"why" or "how" rather than the "what". When in doubt, ask me.
