// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { TaskContext } from '../TaskContext';
import { WeeztixImportTask } from './WeeztixImportTask';
import { formatDate } from '@lib/Temporal';
import { useMockConnection } from '@lib/database/Connection';

const mockGetEvent = vi.fn();
const mockGetOrder = vi.fn();
const mockListOrders = vi.fn();

vi.mock('@lib/integrations/weeztix', () => ({
    createWeeztixClient: async () => ({
        getEvent: mockGetEvent,
        getOrder: mockGetOrder,
        listOrders: mockListOrders,
    }),
}));

describe('WeeztixImportTask', () => {
    const mockConnection = useMockConnection();

    let task: WeeztixImportTask;

    beforeEach(async () => {
        mockGetEvent.mockReset();
        mockGetOrder.mockReset();
        mockListOrders.mockReset();

        const context = TaskContext.forEphemeralTask('WeeztixImportTask', {});
        task = new WeeztixImportTask(context);
        await (task as any).initialise();
    });

    describe('execute', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('resets the interval and skips API calls when no active Weeztix events exist', async () => {
            task.contextForTesting.setIntervalForRepeatingTask(3600 * 1000, /* force= */ true);

            mockConnection.expect('selectManyRows', query => {
                expect(query).toContain('from events');
                expect(query).toContain('event_weeztix_guid is not null');
                return [];
            });

            const result = await task.execute();
            expect(result).toBe(true);

            expect(mockGetEvent).not.toHaveBeenCalled();
            expect(mockListOrders).not.toHaveBeenCalled();
            expect(mockGetOrder).not.toHaveBeenCalled();
            expect(task.contextForTesting.intervalMsForTesting).toBe(
                WeeztixImportTask.kIntervalMaximum);
        });

        it('synchronises orders using stored companyGuid and skips events missing it', async () => {
            task.contextForTesting.setIntervalForRepeatingTask(
                WeeztixImportTask.kIntervalMaximum, /* force= */ true);

            const soonEndTime = Temporal.Now.zonedDateTimeISO('UTC').add({ days: 7 });
            const laterEndTime = Temporal.Now.zonedDateTimeISO('UTC').add({ days: 90 });

            mockConnection.expect('selectManyRows', () => [
                {
                    slug: '2026',
                    name: 'AnimeCon 2026',
                    endTime: formatDate(soonEndTime.withTimeZone('UTC'), 'YYYY-MM-DD HH:mm:ss'),
                    context: {
                        companyGuid: 'company-guid-1',
                        eventGuid: 'event-guid-2026',
                    },
                },
                {
                    slug: '2027',
                    name: 'AnimeCon 2027',
                    endTime: formatDate(laterEndTime.withTimeZone('UTC'), 'YYYY-MM-DD HH:mm:ss'),
                    context: {
                        companyGuid: undefined,
                        eventGuid: 'event-guid-2027',
                    },
                },
            ]);

            mockListOrders.mockResolvedValueOnce([
                {
                    guid: 'order-guid-1',
                    updatedAt: '2026-08-05T12:00:00+00:00',
                },
            ]);
            mockGetOrder.mockResolvedValueOnce({
                guid: 'order-guid-1',
                status: 'paid',
                tickets: [],
            });

            const executePromise = task.execute();
            await vi.runAllTimersAsync();
            const result = await executePromise;

            expect(result).toBe(true);
            expect(mockGetEvent).not.toHaveBeenCalled();
            expect(mockListOrders).toHaveBeenCalledTimes(1);
            expect(mockListOrders).toHaveBeenCalledWith('company-guid-1', expect.objectContaining({
                offset: 0,
                limit: 100,
                timeunit: 'year',
                range_applies_to: 'updated_at',
                events: 'event-guid-2026',
            }));
            expect(mockGetOrder).toHaveBeenCalledTimes(1);
            expect(mockGetOrder).toHaveBeenCalledWith('order-guid-1');

            // Driven by `soonEndTime` (7 days -> 1 hour), not overwritten by `laterEndTime`.
            expect(task.contextForTesting.intervalMsForTesting).toBe(3600 * 1000);
        });
    });

    describe('importOrders', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('returns false when no orders are returned by the statistics API', async () => {
            mockListOrders.mockResolvedValueOnce([]);

            const result = await (task as any).importOrders('company-guid-1', 'event-guid-1');
            expect(result).toBe(false);
            expect(mockGetOrder).not.toHaveBeenCalled();
        });

        it('respects maximumOrderImportsPerExecution = 1 and 12h compensation', async () => {
            mockListOrders.mockResolvedValueOnce([
                { guid: 'order-0', updatedAt: '2026-08-05T12:00:00+00:00' },
                { guid: 'order-1', updatedAt: '2026-08-05T12:01:00+00:00' },
            ]);
            mockGetOrder.mockImplementation(async (guid: string) => ({
                guid,
                status: 'paid',
                tickets: [],
            }));

            const mostRecentUpdate =
                Temporal.Instant.from('2026-08-05T00:00:00Z').toZonedDateTimeISO('UTC');

            const importPromise = (task as any).importOrders(
                'company-guid-1', 'event-guid-1', mostRecentUpdate);
            await vi.runAllTimersAsync();
            const result = await importPromise;

            expect(result).toBe(true);
            expect(mockListOrders).toHaveBeenCalledWith('company-guid-1', expect.objectContaining({
                range_applies_to: 'updated_at',
                // 2026-08-05T00:00:00Z minus 12h race condition compensation:
                start: '2026-08-04T12:00:00+00:00',
            }));
            expect(mockGetOrder).toHaveBeenCalledTimes(1);
            expect(mockGetOrder).toHaveBeenCalledWith('order-0');
        });

        it('fails fatally when an order timestamp is missing or invalid', async () => {
            mockListOrders.mockResolvedValueOnce([
                { guid: 'order-missing-ts' },
            ]);

            await expect((task as any).importOrders('company-guid-1', 'event-guid-1'))
                .rejects.toThrow('missing a timestamp');

            mockListOrders.mockResolvedValueOnce([
                { guid: 'order-invalid-ts', updatedAt: 'not-a-valid-timestamp' },
            ]);

            await expect((task as any).importOrders('company-guid-1', 'event-guid-1'))
                .rejects.toThrow();

            expect(mockGetOrder).not.toHaveBeenCalled();
        });
    });

    describe('updateTaskIntervalForFestivalDate', () => {
        it('should scale the task interval based on duration until the festival', () => {
            task.contextForTesting.setIntervalForRepeatingTask(
                WeeztixImportTask.kIntervalMaximum, /* force= */ true);

            expect(task.contextForTesting.intervalMsForTesting).toBe(
                WeeztixImportTask.kIntervalMaximum);

            const anonymousTask = task as any;

            // 1. Event in the past
            anonymousTask.updateTaskIntervalForFestivalDate(
                Temporal.Now.zonedDateTimeISO('UTC').subtract({ days: 1 }));
            expect(task.contextForTesting.intervalMsForTesting).toBe(
                WeeztixImportTask.kIntervalMaximum);

            // 2. Within 14 days (e.g. 5 days)
            anonymousTask.updateTaskIntervalForFestivalDate(
                Temporal.Now.zonedDateTimeISO('UTC').add({ days: 5 }));
            expect(task.contextForTesting.intervalMsForTesting).toBe(3600 * 1000);

            // 3. Within 28 days (e.g. 20 days)
            anonymousTask.updateTaskIntervalForFestivalDate(
                Temporal.Now.zonedDateTimeISO('UTC').add({ days: 20 }));
            expect(task.contextForTesting.intervalMsForTesting).toBe(3 * 3600 * 1000);

            // 4. Within 56 days (e.g. 45 days)
            anonymousTask.updateTaskIntervalForFestivalDate(
                Temporal.Now.zonedDateTimeISO('UTC').add({ days: 45 }));
            expect(task.contextForTesting.intervalMsForTesting).toBe(6 * 3600 * 1000);

            // 5. Far in the future (e.g. 90 days)
            anonymousTask.updateTaskIntervalForFestivalDate(
                Temporal.Now.zonedDateTimeISO('UTC').add({ days: 90 }));
            expect(task.contextForTesting.intervalMsForTesting).toBe(
                WeeztixImportTask.kIntervalMaximum);
        });
    });
});
