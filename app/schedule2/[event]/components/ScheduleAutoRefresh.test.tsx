// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { cleanup, render } from '@testing-library/react';
import { vi } from 'vitest';

import { ScheduleAutoRefresh } from './ScheduleAutoRefresh';

const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        refresh: refreshMock,
    }),
}));

describe('ScheduleAutoRefresh', () => {
    let hasFocusValue = true;

    function setVisibilityState(state: DocumentVisibilityState) {
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            value: state,
        });
    }

    function setOnline(online: boolean) {
        Object.defineProperty(navigator, 'onLine', {
            configurable: true,
            value: online,
        });
    }

    beforeEach(() => {
        vi.useFakeTimers();
        refreshMock.mockClear();

        hasFocusValue = true;
        vi.spyOn(document, 'hasFocus').mockImplementation(() => hasFocusValue);
        setVisibilityState('visible');
        setOnline(true);
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('periodically refreshes at the configured interval while focused', () => {
        render(<ScheduleAutoRefresh intervalSeconds={60} />);

        vi.advanceTimersByTime(59_999);
        expect(refreshMock).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(refreshMock).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(60_000);
        expect(refreshMock).toHaveBeenCalledTimes(2);
    });

    it('pauses periodic refreshes while blurred or hidden', () => {
        render(<ScheduleAutoRefresh intervalSeconds={60} />);

        hasFocusValue = false;
        window.dispatchEvent(new Event('blur'));

        vi.advanceTimersByTime(300_000);
        expect(refreshMock).not.toHaveBeenCalled();

        hasFocusValue = true;
        setVisibilityState('hidden');
        document.dispatchEvent(new Event('visibilitychange'));

        vi.advanceTimersByTime(300_000);
        expect(refreshMock).not.toHaveBeenCalled();
    });

    it('refreshes on focus regain once half the interval has elapsed and resets the timer', () => {
        render(<ScheduleAutoRefresh intervalSeconds={60} />);

        hasFocusValue = false;
        window.dispatchEvent(new Event('blur'));

        vi.advanceTimersByTime(30_000);
        expect(refreshMock).not.toHaveBeenCalled();

        hasFocusValue = true;
        window.dispatchEvent(new Event('focus'));
        expect(refreshMock).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(59_999);
        expect(refreshMock).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(1);
        expect(refreshMock).toHaveBeenCalledTimes(2);
    });

    it('rate-limits focus regain refreshes to at most once per half interval', () => {
        render(<ScheduleAutoRefresh intervalSeconds={60} />);

        hasFocusValue = false;
        window.dispatchEvent(new Event('blur'));

        vi.advanceTimersByTime(20_000);
        hasFocusValue = true;
        window.dispatchEvent(new Event('focus'));
        expect(refreshMock).not.toHaveBeenCalled();

        // Remaining 40s until the regular 60s cadence completes.
        vi.advanceTimersByTime(39_999);
        expect(refreshMock).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(refreshMock).toHaveBeenCalledTimes(1);
    });

    it('deduplicates back-to-back visibilitychange and focus events', () => {
        render(<ScheduleAutoRefresh intervalSeconds={60} />);

        hasFocusValue = false;
        setVisibilityState('hidden');
        document.dispatchEvent(new Event('visibilitychange'));

        vi.advanceTimersByTime(45_000);

        hasFocusValue = true;
        setVisibilityState('visible');
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new Event('focus'));

        expect(refreshMock).toHaveBeenCalledTimes(1);
    });

    it('clamps intervalSeconds to the [5, 900] second range', () => {
        const { unmount } = render(<ScheduleAutoRefresh intervalSeconds={1} />);

        vi.advanceTimersByTime(4_999);
        expect(refreshMock).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(refreshMock).toHaveBeenCalledTimes(1);
        unmount();

        refreshMock.mockClear();
        render(<ScheduleAutoRefresh intervalSeconds={3600} />);

        vi.advanceTimersByTime(899_999);
        expect(refreshMock).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(refreshMock).toHaveBeenCalledTimes(1);
    });

    it('skips refreshes while offline and refreshes when connectivity returns', () => {
        render(<ScheduleAutoRefresh intervalSeconds={60} />);

        setOnline(false);
        vi.advanceTimersByTime(60_000);
        expect(refreshMock).not.toHaveBeenCalled();

        setOnline(true);
        window.dispatchEvent(new Event('online'));
        expect(refreshMock).toHaveBeenCalledTimes(1);
    });
});
