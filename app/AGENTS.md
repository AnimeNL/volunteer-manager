# Agent Guidelines (`app`)

## Use of React Server Components
Pages and layouts should be React Server Components (no `'use client'` at the top). Each page and
layout must begin with an access check, unless it's a public page (for example in the `/welcome`
directory).

## Database access
Code interacting with the database must do so using `db` from `@lib/database`. When multiple queries
or transactions are run in a single function or system, store `db` in a local `dbInstance` so that
the same connection is used throughout.

## Cached event and team data
Prefer `getEvent()` and `getTeam()` from `@lib/cache` over manual database queries when obtaining
event or team metadata:

* When data is missing from `CachedEvent` or `CachedTeam`, ask the user whether it should be added.
* When neither is an option, ask the user for confirmation on whether a manual database query is
  preferred over another approach, and consider one or two alternatives.

## Server Actions
Convention is to add a local `FeatureActions.ts` (where "Feature" is the name of the page you're
editing) with a top-level `'use server';` directive. Each Server Action should:

1. Have a clear Zod-based validation protocol, using transformers where applicable.
2. Wrap the Server Action implementation itself in `executeServerAction()` to run our access and
   security checks.
3. Lead the implementation with an applicable authentication check.

It should be rare for a Server Action to not write a log message. Ask the user for confirmation when
this is omitted.

## Minimal Exports
Only export types, interfaces, functions, classes, and constants that are imported by another
module. Do not add `export` to types or interfaces that are only used within their own file.
