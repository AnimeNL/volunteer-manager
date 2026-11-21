// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type SessionData, kSessionCookieName, sealSession } from './Session';
import { getSessionFromCookieStore } from './getSession';

describe('getSession', () => {
    it('is able to get session information from NextJS cookies store', async () => {
        const sessionData: SessionData = {
            sessionId: 7,
            userId: 42,
            secret: 'per-device-secret',
        };

        const sealedSession = await sealSession(sessionData);
        expect(sealedSession.length).toBeGreaterThan(0);

        const retrievedSessionData = await getSessionFromCookieStore(new class {
            get(name: string) {
                if (name !== kSessionCookieName)
                    return undefined;

                return {
                    name: kSessionCookieName,
                    value: sealedSession,
                };
            }
        } as any);

        expect(retrievedSessionData).not.toBeUndefined();
        expect(retrievedSessionData).toEqual(sessionData);
    });
});
