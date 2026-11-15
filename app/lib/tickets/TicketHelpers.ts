// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EventTicketCategory, EventTicketProvider } from '@lib/database/Types';
import type { ProviderSale, TicketConfiguration, TicketSearchSortField } from './Types';
import db, { tEventsTicketsConfiguration } from '@lib/database';

/**
 * Formatter to display a price in euros.
 */
const kPriceFormatter = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
});

/**
 * Formats a ticket or product price given in `cents` as a EUR currency string.
 */
export function formatTicketPrice(cents: number): string {
    return kPriceFormatter.format(cents / 100);
}

/**
 * Maps `TicketSearchSortField` values from the UI/API to database projection column names.
 */
export const kTicketSearchSortFieldMap: Record<TicketSearchSortField,
    'cancelled' | 'holder' | 'purchaseId' | 'purchased' | 'ticketName'> =
{
    cancelled: 'cancelled',
    holder: 'holder',
    order: 'purchaseId',
    purchased: 'purchased',
    ticket: 'ticketName',
};

/**
 * Groups raw daily sale rows into a `Map` keyed by the value returned by `getKey`, skipping rows
 * without a valid date.
 */
export function groupSalesByKey<
    T extends { date?: string; complimentary: boolean; count: number },
    K,
>(rows: T[], getKey: (row: T) => K): Map<K, ProviderSale[]> {
    const salesByKey = new Map<K, ProviderSale[]>();
    for (const row of rows) {
        if (!row.date)
            continue;

        const key = getKey(row);
        let bucket = salesByKey.get(key);
        if (!bucket) {
            bucket = [];
            salesByKey.set(key, bucket);
        }

        bucket.push({
            date: row.date,
            complimentary: row.complimentary,
            count: row.count,
        });
    }

    return salesByKey;
}

/**
 * Lists the `TicketConfiguration` entries for `eventId` associated with the given `provider`.
 */
export async function listTicketConfigurationsByProvider(
    eventId: number, provider: EventTicketProvider): Promise<TicketConfiguration[]>
{
    const ticketTypeIdColumn = provider === 'Weeztix'
        ? tEventsTicketsConfiguration.eventTicketWeeztixGuid
        : tEventsTicketsConfiguration.eventTicketYtpId;

    const rows = await db.selectFrom(tEventsTicketsConfiguration)
        .where(tEventsTicketsConfiguration.eventId.equals(eventId))
            .and(ticketTypeIdColumn.isNotNull())
        .select({
            id: tEventsTicketsConfiguration.eventTicketId,
            ticketTypeId: ticketTypeIdColumn,
            category: tEventsTicketsConfiguration.eventTicketCategory,
            activityId: tEventsTicketsConfiguration.eventTicketActivityId,
        })
        .executeSelectMany();

    return rows.map(row => ({
        ...row,
        ticketTypeId: row.ticketTypeId!,
    }));
}

/**
 * Creates or updates the configuration for `ticketTypeId` in `eventId` for the given `provider`.
 */
export async function upsertTicketConfigurationByProvider(
    eventId: number,
    provider: EventTicketProvider,
    ticketTypeId: number | string,
    config: { activityId: number | null; category: EventTicketCategory | null }): Promise<boolean>
{
    if (provider === 'Weeztix' && (typeof ticketTypeId !== 'string' || !ticketTypeId.length))
        return false;

    if (provider === 'YourTicketProvider' &&
        (typeof ticketTypeId !== 'number' || !Number.isSafeInteger(ticketTypeId)))
    {
        return false;
    }

    const providerColumn = provider === 'Weeztix'
        ? { eventTicketWeeztixGuid: ticketTypeId as string }
        : { eventTicketYtpId: ticketTypeId as number };

    const affectedRows = await db.insertInto(tEventsTicketsConfiguration)
        .set({
            eventId,
            ...providerColumn,
            eventTicketActivityId: config.activityId,
            eventTicketCategory: config.category,
        })
        .onConflictDoUpdateSet({
            eventTicketActivityId: config.activityId,
            eventTicketCategory: config.category,
        })
        .executeInsert();

    return !!affectedRows;
}
