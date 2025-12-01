// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
 
export default defineConfig({
    plugins: [ tsconfigPaths(), react() ],
    test: {
        css: false,
        deps: {

            web: {
                transformCss: false,
            },
        },
        environment: 'jsdom',
        env: {
            APP_COOKIE_PASSWORD: '3P72PZv>)v42[GUS%(st[%<(o.^f58Vy',
            APP_PASSRESET_PASSWORD: 'kf205;e8.F*=AS9ItS(aQ$s;z&PM>6u?',
            APP_REGISTRATION_PASSWORD: 'fK&K4dK6zd7<&AXz$yi>}5Z=uoqbkfFR',
            APP_SMTP_HOST: 'mail.example.com',
            APP_SMTP_PORT: '587',
            APP_SMTP_USERNAME: 'user@example.com',
            APP_SMTP_PASSWORD: 'password',

            // TODO: Remove this once Next.js auth interrupts are stable.
            __NEXT_EXPERIMENTAL_AUTH_INTERRUPTS: 'true',
        },
        exclude: [
            '**/e2e/**',
            '**/node_modules/**',
        ],
        globals: true,
    },
});
