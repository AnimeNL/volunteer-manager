// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { YourTicketProviderTicketsResponse } from '@lib/integrations/yourticketprovider/YourTicketProviderTypes';
import { ImportYourTicketProviderTask } from './ImportYourTicketProviderTask';
import { TaskContext } from '../TaskContext';
import { Temporal, formatDate } from '@lib/Temporal';
import { useMockConnection } from '@lib/database/Connection';

describe('ImportYourTicketProviderTask', () => {
    const kEndTimeTwoWeeksFromNow =
        formatDate(Temporal.Now.zonedDateTimeISO('UTC').add({ days: 42 }), 'YYYY-MM-DD HH:mm:ss');

    const mockConnection = useMockConnection();

    interface FestivalOptions {
        id: number;
        slug: string;
        name: string;
        endTime: string;  // YYYY-MM-DD HH:mm:ss
        yourTicketProviderId: number;

        apiTickets?: YourTicketProviderTicketsResponse;

        existingProducts?: {
            id: number;
            description?: string;
            limit?: number;
            price?: number;
            product: string;
        }[];

        existingSales?: {
            id: number;
            total: number;
        }[];
    }

    function createImportYourTicketProviderTask(
        options: FestivalOptions[], skipUpdate?: boolean, interval?: number)
    {
        const context = TaskContext.forEphemeralTask('ImportYourTicketProviderTask', {});
        if (!!interval)
            context.setIntervalForRepeatingTask(interval, /* force= */ true);

        const task = new class extends ImportYourTicketProviderTask {
            constructor() {
                super(context);
            }

            override async executeForEvent(dbInstance: any, event: any): Promise<void> {
                if (!skipUpdate)
                    await super.executeForEvent(dbInstance, event);
            }

            override async fetchEventTicketsFromApi(forYourTicketProviderId: number) {
                for (const { apiTickets, yourTicketProviderId } of options) {
                    if (yourTicketProviderId === forYourTicketProviderId)
                        return apiTickets;
                }

                // Note: Never call super.fetchEventTicketsFromApi(), as we do not want tests to
                // reach the production API server.
                return undefined;
            }
        };

        expect(task.isComplexTask()).toBeFalse();

        mockConnection.expect('selectManyRows', () =>  options);
        for (const { existingProducts, existingSales } of options) {
            if (Array.isArray(existingProducts))
                mockConnection.expect('selectManyRows', () => existingProducts);
            if (Array.isArray(existingSales))
                mockConnection.expect('selectManyRows', () => existingSales);
        }

        return task;
    }

    it('should skip when there are no upcoming festivals', async () => {
        const task = createImportYourTicketProviderTask(
            [ /* no events */ ],
            /* skipUpdate= */ false,
            /* interval=*/ ImportYourTicketProviderTask.kIntervalMaximum);

        const result = await task.execute();
        expect(result).toBeTrue();

        expect(task.log.entries).toHaveLength(1);
        expect(task.log.entries[0].message).toInclude('No future events');

        expect(task.contextForTesting.intervalMsForTesting).toBe(
            ImportYourTicketProviderTask.kIntervalMaximum);
    });

    it('should scale the task interval based on duration until the festival', async () => {
        const finalTestCase =
            ImportYourTicketProviderTask.kIntervalConfiguration[
                ImportYourTicketProviderTask.kIntervalConfiguration.length - 1];

        const kTestCases = [
            ...ImportYourTicketProviderTask.kIntervalConfiguration,
            {
                maximumDays: finalTestCase.maximumDays + 2,
                intervalMs: ImportYourTicketProviderTask.kIntervalMaximum,
            },
        ];

        expect(kTestCases.length).toBeGreaterThan(0);

        for (const { maximumDays, intervalMs } of kTestCases) {
            const task = createImportYourTicketProviderTask([
                {
                    id: 100,
                    slug: 'event',
                    name: 'AnimeCon',
                    endTime: formatDate(
                        Temporal.Now.zonedDateTimeISO('UTC').add({ days: maximumDays }),
                        'YYYY-MM-DD HH:mm:ss'),
                    yourTicketProviderId: 1337,
                }
            ],
            /* skipUpdate= */ true,
            /* interval= */ ImportYourTicketProviderTask.kIntervalMaximum);

            const result = await task.execute();
            expect(result).toBeTrue();

            expect(task.contextForTesting.intervalMsForTesting).toBe(intervalMs);
        }
    });

    it('should skip events for which no ticket information could be fetched', async () => {
        const task = createImportYourTicketProviderTask([
            {
                id: 100,
                slug: 'event',
                name: 'AnimeCon',
                endTime: kEndTimeTwoWeeksFromNow,
                yourTicketProviderId: 1337,

                apiTickets: [ /* no results */ ],
                existingProducts: [ /* no existing products */ ],
                existingSales: [ /* no existing sales */ ],
            }
        ]);

        const result = await task.execute();
        expect(result).toBeTrue();

        expect(task.log.entries).toHaveLength(3);
        expect(task.log.entries[2].message).toInclude('No tickets were returned');
    });

    it('should update the product name when it changed', async () => {
        const task = createImportYourTicketProviderTask([
            {
                id: 100,
                slug: 'event',
                name: 'AnimeCon',
                endTime: kEndTimeTwoWeeksFromNow,
                yourTicketProviderId: 1337,

                apiTickets: [
                    {
                        Id: 143341,
                        Name: 'Locker Sunday XL',  // <-- updated from "Locker Sunday"
                        Description: '35 x 28 x 50 cm. Can contain larger bags.',
                        Price: 12,
                        Amount: 100,
                        CurrentAvailable: 50,
                        Live: true,
                    }
                ],

                existingProducts: [
                    {
                        id: 143341,
                        description: '35 x 28 x 50 cm. Can contain larger bags.',
                        limit: 100,
                        price: 12,
                        product: 'Locker Sunday',
                    }
                ],

                existingSales: [ { id: 143341, total: 50 } ],
            }
        ]);

        let receivedUpdate = false;

        mockConnection.expect('update', (values: unknown) => { receivedUpdate = true; });
        mockConnection.expect('insert', (values: unknown) => { /* ticketSale */ });

        const result = await task.execute();
        expect(result).toBeTrue();

        expect(receivedUpdate).toBeTrue();

        expect(task.log.entries).toHaveLength(3);
        expect(task.log.entries[2].message).toInclude('Locker Sunday XL');
    });

    it('should update the product description when it changed', async () => {
        const task = createImportYourTicketProviderTask([
            {
                id: 100,
                slug: 'event',
                name: 'AnimeCon',
                endTime: kEndTimeTwoWeeksFromNow,
                yourTicketProviderId: 1337,

                apiTickets: [
                    {
                        Id: 143341,
                        Name: 'Locker Sunday',
                        Description: '35 x 28 x 500 cm. Can contain larger bags.',  // <-- updated
                        Price: 12,
                        Amount: 100,
                        CurrentAvailable: 50,
                        Live: true,
                    }
                ],

                existingProducts: [
                    {
                        id: 143341,
                        description: '35 x 28 x 50 cm. Can contain larger bags.',
                        limit: 100,
                        price: 12,
                        product: 'Locker Sunday',
                    }
                ],

                existingSales: [ { id: 143341, total: 50 } ],
            }
        ]);

        let receivedUpdate = false;

        mockConnection.expect('update', (values: unknown) => { receivedUpdate = true; });
        mockConnection.expect('insert', (values: unknown) => { /* ticketSale */ });

        const result = await task.execute();
        expect(result).toBeTrue();

        expect(receivedUpdate).toBeTrue();

        expect(task.log.entries).toHaveLength(3);
        expect(task.log.entries[2].message).toInclude('Locker Sunday');
    });

    it('should update the price when it changed', async () => {
        const task = createImportYourTicketProviderTask([
            {
                id: 100,
                slug: 'event',
                name: 'AnimeCon',
                endTime: kEndTimeTwoWeeksFromNow,
                yourTicketProviderId: 1337,

                apiTickets: [
                    {
                        Id: 143341,
                        Name: 'Locker Sunday',
                        Description: '35 x 28 x 50 cm. Can contain larger bags.',
                        Price: 14,  // <-- updated from "12"
                        Amount: 100,
                        CurrentAvailable: 50,
                        Live: true,
                    },
                    {
                        Id: 152224,
                        Name: 'History and Tasting of Chuhi',
                        Price: 20.0018,  // <-- floating points bite again
                        Amount: 100,
                        CurrentAvailable: 50,
                        Live: true,
                    }
                ],

                existingProducts: [
                    {
                        id: 143341,
                        description: '35 x 28 x 50 cm. Can contain larger bags.',
                        limit: 100,
                        price: 12,
                        product: 'Locker Sunday',
                    },
                    {
                        id: 152224,
                        limit: 100,
                        price: 20,
                        product: 'History and Tasting of Chuhi',
                    }
                ],

                existingSales: [
                    { id: 143341, total: 50 },
                    { id: 152224, total: 50 },
                ],
            }
        ]);

        let receivedUpdate = false;

        mockConnection.expect('update', (values: unknown) => { receivedUpdate = true; });
        mockConnection.expect('insert', (values: unknown) => { /* ticketSale */ });
        mockConnection.expect('insert', (values: unknown) => { /* ticketSale */ });

        const result = await task.execute();
        expect(result).toBeTrue();

        expect(receivedUpdate).toBeTrue();

        expect(task.log.entries).toHaveLength(3);
        expect(task.log.entries[2].message).toInclude('Locker Sunday');
    });

    it('should update maximum ticket information in the database when it changed', async () => {
        const task = createImportYourTicketProviderTask([
            {
                id: 100,
                slug: 'event',
                name: 'AnimeCon',
                endTime: kEndTimeTwoWeeksFromNow,
                yourTicketProviderId: 1337,

                apiTickets: [
                    {
                        Id: 143341,
                        Name: 'Locker Sunday',
                        Description: '35 x 28 x 50 cm. Can contain larger bags.',
                        Price: 12,
                        Amount: 120,  // <-- updated from "100"
                        CurrentAvailable: 70,
                        Live: true,
                    }
                ],

                existingProducts: [
                    {
                        id: 143341,
                        description: '35 x 28 x 50 cm. Can contain larger bags.',
                        limit: 100,
                        price: 12,
                        product: 'Locker Sunday',
                    }
                ],

                existingSales: [ { id: 143341, total: 50 } ],
            }
        ]);

        let receivedUpdate = false;

        mockConnection.expect('update', (values: unknown) => { receivedUpdate = true; });
        mockConnection.expect('insert', (values: unknown) => { /* ticketSale */ });

        const result = await task.execute();
        expect(result).toBeTrue();

        expect(receivedUpdate).toBeTrue();

        expect(task.log.entries).toHaveLength(3);
        expect(task.log.entries[2].message).toInclude('Locker Sunday');
    });

    it('should create product information when a new product is seen', async () => {
        const task = createImportYourTicketProviderTask([
            {
                id: 100,
                slug: 'event',
                name: 'AnimeCon',
                endTime: kEndTimeTwoWeeksFromNow,
                yourTicketProviderId: 1337,

                apiTickets: [
                    {
                        Id: 143341,
                        Name: 'Locker Sunday',
                        Description: '35 x 28 x 50 cm. Can contain larger bags.',
                        Price: 12,
                        Amount: 100,
                        CurrentAvailable: 50,
                        Live: true,
                    }
                ],

                existingProducts: [ /* no existing products */ ],
                existingSales: [ /* no existing sales */ ],
            }
        ]);

        let receivedInsert = false;

        mockConnection.expect('insert', (values: unknown) => { receivedInsert = true; });
        mockConnection.expect('insert', (values: unknown) => { /* ticketSale */ });

        const result = await task.execute();
        expect(result).toBeTrue();

        expect(receivedInsert).toBeTrue();

        expect(task.log.entries).toHaveLength(4);
        expect(task.log.entries[2].message).toInclude('Locker Sunday');  // created
        expect(task.log.entries[3].message).toInclude('Locker Sunday');  // sales
    });

    it('should upsert information retrieved from the API in the database', async () => {
        const task = createImportYourTicketProviderTask([
            {
                id: 100,
                slug: 'event',
                name: 'AnimeCon',
                endTime: kEndTimeTwoWeeksFromNow,
                yourTicketProviderId: 1337,

                apiTickets: [
                    {
                        Id: 143341,
                        Name: 'Locker Sunday',
                        Description: '35 x 28 x 50 cm. Can contain larger bags.',
                        Price: 12,
                        Amount: 100,
                        CurrentAvailable: 50,
                        Live: true,
                    },
                    {
                        Id: 143338,
                        Name: 'Locker Weekend',
                        Description: '35 x 28 x 50 cm. Can contain larger bags.',
                        Price: 12,
                        Amount: 100,
                        CurrentAvailable: 50,
                        Live: true,
                    },
                ],

                existingProducts: [
                    {
                        id: 143341,
                        description: '35 x 28 x 50 cm. Can contain larger bags.',
                        limit: 100,
                        price: 12,
                        product: 'Locker Sunday',
                    },
                    {
                        id: 143338,
                        description: '35 x 28 x 50 cm. Can contain larger bags.',
                        limit: 100,
                        price: 12,
                        product: 'Locker Weekend',
                    }
                ],
                existingSales: [
                    { id: 143341, total: 50 },
                    { id: 143338, total: 48 },  // <-- two have been sold
                ],
            }
        ]);

        mockConnection.expect('insert', (values: unknown) => { /* ticketSale 143341 */ });
        mockConnection.expect('insert', (values: unknown) => { /* ticketSale 143338 */ });

        const result = await task.execute();
        expect(result).toBeTrue();

        expect(task.log.entries).toHaveLength(3);
        expect(task.log.entries[2].message).toInclude('Locker Weekend');
        expect(task.log.entries[2].message).toInclude('48 -> 50');
    });
});
