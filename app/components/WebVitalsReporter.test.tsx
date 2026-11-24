// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { cleanup, render } from '@testing-library/react';
import { vi } from 'vitest';

import { WebVitalsReporter } from './WebVitalsReporter';

let capturedCallback: ((metric: any) => void) | undefined;

vi.mock('next/web-vitals', () => ({
    useReportWebVitals: (callback: (metric: any) => void) => {
        capturedCallback = callback;
    },
}));

describe('WebVitalsReporter', () => {
    const sendBeaconMock = vi.fn().mockReturnValue(true);

    beforeEach(() => {
        vi.useFakeTimers();
        capturedCallback = undefined;
        sendBeaconMock.mockClear();

        Object.defineProperty(navigator, 'sendBeacon', {
            configurable: true,
            value: sendBeaconMock,
        });

        window.history.replaceState({}, '', '/example');
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    async function readBeaconPayload(callIndex = 0) {
        const [ url, blob ] = sendBeaconMock.mock.calls[callIndex];
        expect(url).toEqual('/api/vitals');
        expect(blob).toBeInstanceOf(Blob);
        return JSON.parse(await (blob as Blob).text());
    }

    it('coalesces initial load metrics into a single beacon after the flush delay', async () => {
        render(<WebVitalsReporter />);
        expect(capturedCallback).toBeDefined();

        capturedCallback!({
            name: 'TTFB',
            value: 120.5,
            navigationType: 'navigate',
        });
        capturedCallback!({
            name: 'FCP',
            value: 350.2,
            navigationType: 'navigate',
        });
        capturedCallback!({
            name: 'LCP',
            value: 980.1,
            navigationType: 'soft-navigation',
            navigationURL: 'https://example.test/example/items/42?tab=info',
        });

        expect(sendBeaconMock).not.toHaveBeenCalled();

        vi.advanceTimersByTime(5_000);
        expect(sendBeaconMock).toHaveBeenCalledTimes(1);

        const payload = await readBeaconPayload(0);
        expect(payload).toEqual({
            buildHash: process.env.NEXT_PUBLIC_PROJECT_BUILD_HASH || 'dev',
            deviceType: 'Desktop',
            vitals: [
                {
                    metric: 'TTFB',
                    value: 120.5,
                    navigationType: 'navigate',
                    pathname: '/example',
                },
                {
                    metric: 'FCP',
                    value: 350.2,
                    navigationType: 'navigate',
                    pathname: '/example',
                },
                {
                    metric: 'LCP',
                    value: 980.1,
                    navigationType: 'soft-navigation',
                    pathname: '/example/items/42',
                },
            ],
        });
    });

    it('flushes buffered metrics immediately when the page becomes hidden', async () => {
        render(<WebVitalsReporter />);

        capturedCallback!({
            name: 'INP',
            value: 48,
            navigationType: 'navigate',
        });
        capturedCallback!({
            name: 'CLS',
            value: 0.02,
            navigationType: 'back_forward',
        });

        expect(sendBeaconMock).not.toHaveBeenCalled();

        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value: 'hidden',
        });
        document.dispatchEvent(new Event('visibilitychange'));

        expect(sendBeaconMock).toHaveBeenCalledTimes(1);

        const payload = await readBeaconPayload(0);
        expect(payload.vitals).toEqual([
            {
                metric: 'INP',
                value: 48,
                navigationType: 'navigate',
                pathname: '/example',
            },
            {
                metric: 'CLS',
                value: 0.02,
                navigationType: 'back-forward',
                pathname: '/example',
            },
        ]);
    });

    it('ignores unsupported metrics and invalid values', () => {
        render(<WebVitalsReporter />);

        capturedCallback!({
            name: 'Next.js-hydration',
            value: 50,
            navigationType: 'navigate',
        });
        capturedCallback!({
            name: 'LCP',
            value: -10,
            navigationType: 'navigate',
        });

        vi.advanceTimersByTime(5_000);
        expect(sendBeaconMock).not.toHaveBeenCalled();
    });
});
