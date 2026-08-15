# Project instructions

Always verify changes prior to considering a task complete. Use the "/self-verify" skill for this.

Always self review changes prior to considering a task complete. Use the "/self-review" skill for
this.

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
