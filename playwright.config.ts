// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const url = `http://localhost:${process.env.PORT || 3000}`;

/**
 * Configuration for our Playwright-based E2E tests. The tests themselves are located in the `e2e`
 * directory.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
    outputDir: path.join(__dirname, 'e2e', 'results'),
    testDir: path.join(__dirname, 'e2e'),
    retries: 3,
    timeout: 15 * 1000,  // 15 seconds,

    projects: [
        {
            name: 'Desktop Firefox',
            use: devices['Desktop Firefox'],
        },
        {
            name: 'Desktop Chrome',
            use: devices['Desktop Chrome'],
        },
        {
            name: 'Mobile Chrome',
            use: devices['Pixel 5'],
        },
        {
            name: 'Mobile Safari',
            use: devices['iPhone 13'],
        }
    ],

    reporter: [
        [ 'line' ],
        [ 'html', { outputFolder: path.join(__dirname, 'e2e', 'reports') } ],
    ],

    use: {
        baseURL: url
    },

    webServer: {
        env: {
            APP_RUNNING_PLAYWRIGHT_TEST: '1',
        },
        stdout: 'pipe',
        stderr: 'pipe',
        command: 'npm run serve',
        timeout: 5 * 60 * 1000,  // 5 minutes
        url,
    },
});
