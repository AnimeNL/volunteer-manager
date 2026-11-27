// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { describe, expect, it } from 'vitest';

describe('DateTime', () => {
    it('preserves custom English locale formats when AdapterDayjs is loaded afterwards', async () => {
        await import('./DateTime');
        const { AdapterDayjs } = await import('@mui/x-date-pickers/AdapterDayjs');

        const adapter = new AdapterDayjs();
        expect(adapter.expandFormat(adapter.formats.keyboardDate)).toEqual('YYYY-MM-DD');
        expect(adapter.is12HourCycleInCurrentLocale()).toBe(false);
    });
});
