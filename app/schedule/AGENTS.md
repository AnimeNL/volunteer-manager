# Agent Guidelines (`app/schedule`)

## Authentication
All entry points in `app/schedule/` (pages, layouts, and Server Actions) must use one of the
`requireVolunteerAuthentication` variants (such as
`requireVolunteerAuthentication(WithEvent(AndTeam?)?)`) from `@lib/requireAuthentication`.
