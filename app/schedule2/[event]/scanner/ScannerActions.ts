// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use server';

import { z } from 'zod/v4';

import { executeServerAction } from '@lib/serverAction';
import { readCachedSetting } from '@lib/Settings';
import { requireVolunteerAuthenticationWithEvent } from '@lib/auth';

/**
 * Zod schema describing the data accepted by `recordScannedBarcode`.
 */
const kRecordScannedBarcodeData = z.object({
    barcode: z.string().trim().min(1).max(1024),
    event: z.string().min(1),
});

/**
 * Server Action receiving a scanned QR code barcode from the schedule portal scanner.
 */
export async function recordScannedBarcode(event: string, barcode: string) {
    return executeServerAction(
        { barcode, event }, kRecordScannedBarcodeData, async (data, props) =>
    {
        const { event } = await requireVolunteerAuthenticationWithEvent(
            props.authenticationContext, data.event);

        const scannerEnabled = await readCachedSetting('schedule-enable-scanner', false);
        if (!scannerEnabled)
            return { success: false, error: 'The scanner is currently disabled.' };

        console.log('[Scanner]', {
            barcode: data.barcode,
            event: event.slug,
            userId: props.user.id,
        });

        return { success: true };
    });
}
