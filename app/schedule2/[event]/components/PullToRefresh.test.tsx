// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import { PullToRefresh } from './PullToRefresh';
import { computeM3ColorScheme } from '../lib/m3ColorScheme';

import { kDefaultThemeColor } from '../Constants';

const mockRefresh = vi.fn();
const mockRouter = { refresh: mockRefresh };

vi.mock('next/navigation', () => ({
    useRouter: () => mockRouter,
}));

function createTestTheme() {
    const scheme = computeM3ColorScheme(kDefaultThemeColor);
    return createTheme({
        palette: {
            m3: scheme.light,
        } as never,
    });
}

function renderInsideSheet(overflowY: string = 'auto') {
    const originalGetComputedStyle = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElt) => {
        const computed = originalGetComputedStyle(element, pseudoElt);
        if ((element as HTMLElement).dataset?.testid === 'sheet') {
            return { ...computed, overflowY } as CSSStyleDeclaration;
        }
        return computed;
    });

    const result = render(
        <ThemeProvider theme={createTestTheme()}>
            <div data-testid="sheet">
                <PullToRefresh />
                <div data-testid="content">Schedule content</div>
            </div>
        </ThemeProvider>,
    );

    return {
        ...result,
        sheet: result.getByTestId('sheet'),
    };
}

function dispatchTouch(
    element: HTMLElement,
    type: 'touchstart' | 'touchmove' | 'touchend',
    points: { clientX: number; clientY: number }[] = [],
) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', { value: points });
    element.dispatchEvent(event);
}

describe('PullToRefresh', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockRefresh.mockReset();
        Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('triggers router.refresh() when pulled past the threshold at scrollTop === 0', () => {
        const { sheet } = renderInsideSheet('auto');

        act(() => {
            dispatchTouch(sheet, 'touchstart', [ { clientX: 100, clientY: 50 } ]);
            dispatchTouch(sheet, 'touchmove', [ { clientX: 100, clientY: 260 } ]);
        });

        expect(sheet.firstElementChild?.getAttribute('aria-hidden')).toBe('false');

        act(() => {
            dispatchTouch(sheet, 'touchend');
            vi.runAllTimers();
        });

        expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    it('does not trigger router.refresh() when pull distance is below the threshold', () => {
        const { sheet } = renderInsideSheet('auto');

        act(() => {
            dispatchTouch(sheet, 'touchstart', [ { clientX: 100, clientY: 50 } ]);
            dispatchTouch(sheet, 'touchmove', [ { clientX: 100, clientY: 100 } ]);
            dispatchTouch(sheet, 'touchend');
            vi.runAllTimers();
        });

        expect(mockRefresh).not.toHaveBeenCalled();
    });

    it('ignores horizontal swipes', () => {
        const { sheet } = renderInsideSheet('auto');

        act(() => {
            dispatchTouch(sheet, 'touchstart', [ { clientX: 100, clientY: 50 } ]);
            dispatchTouch(sheet, 'touchmove', [ { clientX: 160, clientY: 70 } ]);
            dispatchTouch(sheet, 'touchmove', [ { clientX: 160, clientY: 300 } ]);
            dispatchTouch(sheet, 'touchend');
            vi.runAllTimers();
        });

        expect(mockRefresh).not.toHaveBeenCalled();
    });

    it('does not trigger when the sheet is already scrolled down', () => {
        const { sheet } = renderInsideSheet('auto');
        Object.defineProperty(sheet, 'scrollTop', { configurable: true, value: 40 });

        act(() => {
            dispatchTouch(sheet, 'touchstart', [ { clientX: 100, clientY: 50 } ]);
            dispatchTouch(sheet, 'touchmove', [ { clientX: 100, clientY: 300 } ]);
            dispatchTouch(sheet, 'touchend');
            vi.runAllTimers();
        });

        expect(mockRefresh).not.toHaveBeenCalled();
    });

    it('does not trigger on desktop where the sheet is not a scroll container', () => {
        const { sheet } = renderInsideSheet('visible');

        act(() => {
            dispatchTouch(sheet, 'touchstart', [ { clientX: 100, clientY: 50 } ]);
            dispatchTouch(sheet, 'touchmove', [ { clientX: 100, clientY: 300 } ]);
            dispatchTouch(sheet, 'touchend');
            vi.runAllTimers();
        });

        expect(mockRefresh).not.toHaveBeenCalled();
    });
});
