# Project instructions

Always verify that the code builds and passes tests before considering a task done.

## Running the code
Run "npm run serve" to start the development server. It will serve the application on "http://localhost:3000", and will automatically rebuild and reload the browser when files change.

## Building the code
Run "npm run build" to build the code.

## Linting the code
Run "npm run lint" to lint the code. Only fix lint errors that you introduced.

## Running tests
Run "npm run tests" to run all the tests.

# Coding rules

## Think Before Coding
No silent assumptions. State what you're assuming. Surface tradeoffs. Ask before guessing. Push back when a simpler approach exists.

## Simplicity First
Minimum code that solves the problem. No speculative features. No abstractions for single-use code. If a senior engineer would call it overcomplicated — simplify.

## Surgical Changes
Touch only what you must. Don't "improve" adjacent code, comments, or formatting. Don't refactor what isn't broken. Match existing style.

## Surface conflicts, don't average them
If two existing patterns in the codebase contradict, don't blend them.
Pick one (the more recent / more tested), explain why, and flag the other for cleanup.

## Read before you write
Before adding code in a file, read the file's exports, the immediate caller, and any obvious shared utilities.
If you don't understand why existing code is structured the way it is, ask before adding to it.

## Match the codebase's conventions, even if you disagree
If the codebase uses snake_case and you'd prefer camelCase: snake_case.
Disagreement is a separate conversation. Inside the codebase, conformance > taste.
If you genuinely think the convention is harmful, surface it. Don't fork it silently.

## Fail visibly, not silently
If you can't be sure something worked, say so explicitly.
