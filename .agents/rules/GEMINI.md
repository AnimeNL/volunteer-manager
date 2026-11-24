# Project instructions

## Iterative development
Large changes are undesirable: always iterate with smaller, logical steps towards a broader goal.
Prefer 5 commits of 100 lines over one commit of 500 lines where such a sensible iteration approach
exists. Match what you would expect a really experienced engineer to do.

Always check in with the user between each iteration of a multi-step approach, so that they can
confirm and verify the changes, and commit them to Git.

## Verification, review, and commit messages
Prior to checking in at the end of an iteration, or considering a task complete, you must always:

1. Verify changes using the "/self-verify" skill.
2. Self-review changes using the "/self-review" skill.
3. Include a proposed commit message in the format of "what: Description", for example:
   * `fix: Improve permission checks on the ticket information page`
   * `faff: Simplify the code by removing redundant checks`
   * `perf: Improve the Next.js build time by 12% through improved inline caches`
   * `feat: Add a new section on the finance page displaying total revenue`

   For `perf:` commit messages, include measured performance gains (e.g. percentage or wall-clock
   deltas) whenever possible.

# Coding rules

## Think Before Coding
No silent assumptions. State what you're assuming. Surface tradeoffs. Ask before guessing. Push back
when a simpler approach exists.

## Simplicity First
Minimum code that solves the problem. No speculative features. No abstractions for single-use code.
If a senior engineer would call it overcomplicated — simplify.

## Surgical Changes
Touch only what you must. Don't "improve" adjacent code, comments, or formatting. Don't refactor
what isn't broken. Match existing style.

## Surface conflicts, don't average them
If two existing patterns in the codebase contradict, don't blend them.
Pick one (the more recent / more tested), explain why, and flag the other for cleanup.

## Read before you write
Before adding code in a file, read the file's exports, the immediate caller, and any obvious shared
utilities. If you don't understand why existing code is structured the way it is, ask before adding to it.

## Match the codebase's conventions, even if you disagree
You must match the codebase's naming and styling conventions, line length limits, and so on.
Disagreement is a separate conversation. Inside the codebase, conformance > taste.
If you genuinely think the convention is harmful, surface it. Don't fork it silently.

## Fail visibly, not silently
If you can't be sure something worked, say so explicitly.
