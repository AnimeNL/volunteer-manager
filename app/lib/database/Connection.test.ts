// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { MockQueryRunner } from 'ts-sql-query/queryRunners/MockQueryRunner';

import { ErrorReportingQueryRunner, useMockConnection } from './Connection';
import db, { tHotels, tLogs } from './index';

import { kLogSeverity } from '@lib/Log';
import { kLogType } from '@lib/log/index';
import { kMaxTextColumnByteLength } from './index';

describe('Connection', () => {
    const mockConnection = useMockConnection();

    it('is able to intercept queries using the `useMockConnection` mechanism', async () => {
        mockConnection.expect('selectOneRow');
        {
            const result = await db.selectFrom(tHotels).select({
                eventId: tHotels.eventId,
                hotelName: tHotels.hotelName,
            }).executeSelectNoneOrOne();

            expect(result).toBeNull();
        }

        mockConnection.expect('selectOneRow',
            (query, params) => ({ eventId: 42, hotelName: 'Fancy Hotel' }));
        {
            const result = await db.selectFrom(tHotels).select({
                eventId: tHotels.eventId,
                hotelName: tHotels.hotelName,
            }).executeSelectNoneOrOne();

            expect(result).not.toBeNull();
            expect(result?.eventId).toBe(42);
            expect(result?.hotelName).toBe('Fancy Hotel');
        }

        mockConnection.expect('insertReturningLastInsertedId', (query, params) => 42);
        {
            const result = await db.insertInto(tHotels).values({
                eventId: 1,
                hotelName: 'Fancy Hotel',
                hotelDescription: 'A super fancy hotel',
                hotelRoomName: 'Fancy Room',
                hotelRoomPeople: 2,
                hotelRoomPrice: 18000,
                hotelRoomPrivate: 0,
            }).returningLastInsertedId().executeInsert();

            expect(result).toEqual(42);
        }
    });

    it('should be able to work with custom enums we include in the generation tool', async () => {
        mockConnection.expect('insert', () => /* insertId= */ 9001);
        mockConnection.expect('selectOneRow', () => ({ severity: kLogSeverity.Warning }));

        const insertResult = await db.insertInto(tLogs).values({
            logType: 'my-log-type',
            logSeverity: kLogSeverity.Info,
        }).executeInsert();

        expect(insertResult).toEqual(9001);

        const selectResult = await db.selectFrom(tLogs).select({
            severity: tLogs.logSeverity,
        }).executeSelectOne();

        expect(selectResult.severity).toEqual(kLogSeverity.Warning);
    });

    it('truncates oversized DatabaseError log payloads and avoids recursion', async () => {
        let recordedParams: unknown[] | undefined;
        const done = new Promise<void>(resolve => {
            mockConnection.expect('insert', (_query, params) => {
                recordedParams = params;
                resolve();
                return 1;
            });
        });

        const failingRunner = new ErrorReportingQueryRunner(new MockQueryRunner(() => {
            throw new Error('Data too long for column \'log_output\' at row 1');
        }));

        // Should not trigger any `mockConnection` query when `'DatabaseError'` is in params.
        await expect(
            failingRunner.executeInsert('insert into logs values (?)', [ kLogType.DatabaseError ])
        ).rejects.toThrow('Data too long');

        // Should truncate `log_data` to fit within MariaDB's `TEXT` byte limit.
        await expect(
            failingRunner.executeInsert(
                'insert into integrations_logs (log_output, row_id) values (?, ?)',
                [ 'あ'.repeat(30000), 42 ])
        ).rejects.toThrow('Data too long');

        await done;

        expect(recordedParams).toBeDefined();
        expect(recordedParams![0]).toBe(kLogType.DatabaseError);

        const serializedData = recordedParams![6] as string;
        expect(Buffer.byteLength(serializedData, 'utf8')).toBeLessThanOrEqual(
            kMaxTextColumnByteLength);
        expect(serializedData).not.toContain('\ufffd');
    });
});
