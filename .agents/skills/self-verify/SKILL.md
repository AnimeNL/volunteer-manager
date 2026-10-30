---
name: self-verify
description: Explains how to verify changes prior to considering a task complete.
---

# Skill Name: Verify code changes

## Instructions & Core Logic
You must always verify code changes before considering a task complete. In this project, three steps
are mandatory, one step is optional.

1. You must build (`npx next build --experimental-build-mode compile`) and type-check
   (`npx tsc --project tsconfig.build.json`) the code sequentially, and verify that both complete
   successfully. This is expected to take approximately 10 seconds.
2. You must test the code (`npm run test`) and verify that there are no tests that have started
   failing due to your changes. This is expected to take approximately 10 seconds.
3. You must lint the code (`npm run lint`) and verify that there are no lint failures due to your
   changes. This is expected to take approximately 5 seconds.

These three steps may run in parallel.

When you've made substantial changes to a React component or something that may affect rendering of
the page, it's imperative that you also confirm the page loads successfully in a browser. In this
case, you must run the development server (`npm run serve`) if it's not running already, which will
serve the application on "http://localhost:3000". Load the appropriate page, and use Chrome's MCP to
confirm that no (client) errors are seen.
