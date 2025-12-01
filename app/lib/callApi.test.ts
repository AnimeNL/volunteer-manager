// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { callApi, injectFetch } from './callApi';

import { kContentType } from './database/Types';

describe('callApi', () => {
    let latestRequestInput: RequestInfo | URL | undefined;
    let latestRequestInit: RequestInit | undefined;
    let scheduledResponse: Response | undefined;

    async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        latestRequestInput = input;
        latestRequestInit = init;

        const response = scheduledResponse ?? new Response(undefined, { status: 404 });
        scheduledResponse = undefined;

        return response;
    }

    beforeEach(() => {
        injectFetch(mockFetch);

        latestRequestInput = undefined;
        latestRequestInit = undefined;
        scheduledResponse = undefined;
    })

    it('is able to issue POST requests', async () => {
        scheduledResponse = new Response(JSON.stringify({
            slug: 'response-event',
        }), { status: 200 });

        const response = await callApi('post', '/api/admin/create-event', {
            name: 'My Event: The Long Theme',
            shortName: 'My Event',
            slug: 'event',
            startTime: '2024-01-01 12:00:00',
            endTime: '2024-01-03 18:00:00'
        });

        expect(latestRequestInput).not.toBeUndefined();
        expect(latestRequestInput).toEqual('/api/admin/create-event');

        expect(latestRequestInit).not.toBeUndefined();
        expect(latestRequestInit?.body).toContain('My Event: The Long Theme');
        expect(latestRequestInit?.headers).toEqual({
            'Content-Type': 'application/json',
        });

        expect(response.slug).toEqual('response-event');
    });

    it('throws an exception when non-OK response statuses are seen', async () => {
        scheduledResponse = new Response(null, { status: 500 });

        const responsePromise = callApi('post', '/api/admin/create-event', {
            name: 'My Event: The Long Theme',
            shortName: 'My Event',
            slug: 'event',
            startTime: '2024-01-01 12:00:00',
            endTime: '2024-01-03 18:00:00'
        });

        expect(responsePromise).rejects.toThrow();
    });

    it('is able to substitute REST path parameters from the request to the endpoint', async () => {
        scheduledResponse = new Response(JSON.stringify({ success: true }), { status: 200 });

        const response = await callApi('delete', '/api/admin/content/:id', {
            id: 42,
            context: {
                type: kContentType.Page,
                eventId: 1,
                teamId: 2,
            }
        });

        expect(latestRequestInput).not.toBeUndefined();
        expect(latestRequestInput).toEqual('/api/admin/content/42');

        expect(latestRequestInit).not.toBeUndefined();
        expect(latestRequestInit?.body).toEqual(
            '{"context":{"type":"Page","eventId":1,"teamId":2}}');
        expect(latestRequestInit?.headers).toEqual({
            'Content-Type': 'application/json',
        });

        expect(response.success).toBeTruthy();
    });

    it('confirms that REST path parameters are present in the request', async () => {
        scheduledResponse = new Response(JSON.stringify({ success: true }), { status: 200 });

        const responsePromise = callApi('post', '/api/:foo' as any, {
            /* `foo` is missing */
        });

        expect(responsePromise).rejects.toThrow(/doesn't exist/)
    });

    it('confirms that REST path parameters are limited to scalar types', async () => {
        scheduledResponse = new Response(JSON.stringify({ success: true }), { status: 200 });

        const responsePromise = callApi('post', '/api/:foo' as any, {
            foo: { a: 1, b: 2 }  // `foo` is not a scalar
        });

        expect(responsePromise).rejects.toThrow(/must be scalars/)
    });
});
