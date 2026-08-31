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

The <DataTable> component does not yet support treeview display. If you are asked to migrate a table
using that feature, abort and explain that this is not yet possible.

If that is not the case, you must execute the "/create-data-table" skill with the following nuances:

1. Use of `getEventBySlug()` and friends is strictly prohibited. Migrate to transformers, ideally,
   or `getEvent()` and `getTeam()` when there is no other option.

2. Identify the best way to implement the new <DataTable>:
   - Try to match existing columns when you can.
   - Think carefully about relevant `listViewProps` for the mobile display. Mobile users should see
     less information, so display must focus on the key, relevant data.

3. Clean up the existing code:
   - APIs to support the old data table should be removed unless they're used by something else. In
     that case, remove any and all functionality that's no longer necessary without affecting the
     other user.
   - Consider simplifications in the code that you've written. Is there unnecessary duplication? Is
     there usage of TypeScript's "as any" that can be removed? If there excessive nesting? Fix it.
   - Consider performance improvements in the code that you've written.
