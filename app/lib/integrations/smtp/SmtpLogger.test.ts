// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { User } from '@lib/auth';
import { SmtpLoggerImpl } from './SmtpLogger';
import { SmtpMessage } from './SmtpMessage';
import { useMockConnection } from '@lib/database/Connection';

describe('SmtpLoggerImpl', () => {
    const mockConnection = useMockConnection();

    function createMessage(): SmtpMessage {
        return new SmtpMessage()
            .setTo('user@example.com')
            .setSubject('Test Subject')
            .setText('Hello, world!');
    }

    function createUser(id: number): User {
        return {
            id,
            name: 'Jane Doe',
            firstName: 'Jane',
            nameOrFirstName: 'Jane',
            lastName: 'Doe',
        };
    }

    it('attributes User objects by their id when initialising', async () => {
        const logger = new SmtpLoggerImpl();

        mockConnection.expect('insertReturningLastInsertedId', (query, params) => {
            expect(query).toContain('insert into outbox_email');
            expect(params[2]).toBe(101);  // outboxSenderUserId
            expect(params[5]).toBe(202);  // outboxToUserId
            return 1;
        });

        await logger.initialise(42, {
            sender: 'AnimeCon',
            message: createMessage(),
            sourceUser: createUser(101),
            targetUser: createUser(202),
        });
    });

    it('attributes numeric user IDs when initialising', async () => {
        const logger = new SmtpLoggerImpl();

        mockConnection.expect('insertReturningLastInsertedId', (query, params) => {
            expect(query).toContain('insert into outbox_email');
            expect(params[2]).toBe(303);  // outboxSenderUserId
            expect(params[5]).toBe(404);  // outboxToUserId
            return 2;
        });

        await logger.initialise(42, {
            sender: 'AnimeCon',
            message: createMessage(),
            sourceUser: 303,
            targetUser: 404,
        });
    });

    it('stores null user IDs when sourceUser and targetUser are omitted', async () => {
        const logger = new SmtpLoggerImpl();

        mockConnection.expect('insertReturningLastInsertedId', (query, params) => {
            expect(query).toContain('insert into outbox_email');
            expect(params[2]).toBeNull();  // outboxSenderUserId
            expect(params[5]).toBeNull();  // outboxToUserId
            return 3;
        });

        await logger.initialise(42, {
            sender: 'AnimeCon',
            message: createMessage(),
        });
    });
});
