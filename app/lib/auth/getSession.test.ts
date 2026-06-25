// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type SessionData, kSessionCookieName, sealSession } from './Session';
import { getSessionFromCookieStore, getSessionFromHeaders } from './getSession';
import { stringifySetCookie } from 'cookie';

describe('getSession', () => {
    it('is able to get session information from NextJS cookies store', async () => {
        const sessionData: SessionData = {
            id: 42,
            token: 9001,
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

    it('is able to get session information from HTTP headers', async () => {
        const sessionData: SessionData = {
            id: 42,
            token: 9001,
        };

        const sealedSession = await sealSession(sessionData);
        expect(sealedSession.length).toBeGreaterThan(0);

        const sealedCookie = stringifySetCookie({
            name: kSessionCookieName,
            value: sealedSession,
            httpOnly: true,
        });
        expect(sealedCookie.length).toBeGreaterThan(0);

        const headers = new Headers([ ['Cookie', sealedCookie ] ]);
        expect(headers.has('Cookie')).toBeTruthy();

        const retrievedSessionData = await getSessionFromHeaders(headers);
        expect(retrievedSessionData).not.toBeUndefined();
        expect(retrievedSessionData).toEqual(sessionData);
    });
});
