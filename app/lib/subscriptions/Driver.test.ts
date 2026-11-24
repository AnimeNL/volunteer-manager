// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

import { Driver, type Message, type Recipient } from './Driver';
import { useMockConnection } from '@lib/database/Connection';

vi.mock('../Environment', () => ({
    determineEnvironment: vi.fn().mockResolvedValue({ domain: 'animecon.team' }),
}));

interface TestMessage extends Message {
    event: string;
}

class TestDriver extends Driver<TestMessage> {
    populateEmail(recipient: Recipient, message: TestMessage) {
        return this.getPopulatedTemplate('email', recipient, message);
    }

    populateSms(recipient: Recipient, message: TestMessage) {
        return this.getPopulatedTemplate('sms', recipient, message);
    }

    override async publishEmail(): Promise<boolean> { return true; }
    override async publishSms(): Promise<boolean> { return true; }
    override async publishWhatsapp(): Promise<boolean> { return true; }
}

describe('Driver', () => {
    const mockConnection = useMockConnection();

    it('should not leak recipient substitutions across multi-recipient fan-out', async () => {
        mockConnection.expect('selectManyRows', () => [
            {
                type: 'email',
                subject: 'Hello {recipient.shortName} for \\{message.event}',
                body: 'Hi {recipient.fullName}, welcome to {message.event} on {environment}!',
            },
        ]);

        const driver = new TestDriver();
        await driver.initialise('Application');

        const message: TestMessage = { event: 'AnimeCon 2026' };

        const firstRecipient: Recipient = {
            userId: 1,
            fullName: 'Alice Example',
            shortName: 'Alice',
            emailAddress: 'alice@example.com',
        };

        const secondRecipient: Recipient = {
            userId: 2,
            fullName: 'Bob Example',
            shortName: 'Bob',
            emailAddress: 'bob@example.com',
        };

        const firstTemplate = driver.populateEmail(firstRecipient, message);
        const secondTemplate = driver.populateEmail(secondRecipient, message);

        expect(firstTemplate).toEqual({
            subject: 'Hello Alice for AnimeCon 2026',
            body: 'Hi Alice Example, welcome to AnimeCon 2026 on animecon.team!',
        });

        expect(secondTemplate).toEqual({
            subject: 'Hello Bob for AnimeCon 2026',
            body: 'Hi Bob Example, welcome to AnimeCon 2026 on animecon.team!',
        });

        expect(driver.populateSms(firstRecipient, message)).toBeUndefined();
    });
});
