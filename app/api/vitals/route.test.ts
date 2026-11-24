// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { NextRequest } from 'next/server';

import { POST } from './route';
import { useMockConnection } from '@lib/database/Connection';

function createRequest(body: string, headers: Record<string, string> = {}): NextRequest {
    return new NextRequest('https://stewards.team/api/vitals', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            host: 'stewards.team',
            origin: 'https://stewards.team',
            ...headers,
        },
        body,
    });
}

describe('POST /api/vitals', () => {
    const mockConnection = useMockConnection();

    it('records a valid batch of Web Vitals and returns 204', async () => {
        let capturedQuery = '';
        let capturedParams: any[] = [];

        mockConnection.expect('insert', (query, params) => {
            capturedQuery = query;
            capturedParams = params;
            return 2;
        });

        const response = await POST(createRequest(JSON.stringify({
            buildHash: 'a1b2c3d',
            deviceType: 'Desktop',
            vitals: [
                {
                    metric: 'FCP',
                    value: 412.5,
                    navigationType: 'navigate',
                    pathname: '/example',
                },
                {
                    metric: 'LCP',
                    value: 1205.2,
                    navigationType: 'soft-navigation',
                    pathname: '/example/details?tab=info',
                },
            ],
        })));

        expect(response.status).toEqual(204);
        expect(capturedQuery).toContain('insert into web_vitals');
        expect(capturedParams).toEqual([
            'stewards.team',
            '/example',
            'FCP',
            412.5,
            'navigate',
            'Desktop',
            'a1b2c3d',
            'stewards.team',
            '/example/details',
            'LCP',
            1205.2,
            'soft-navigation',
            'Desktop',
            'a1b2c3d',
        ]);
    });

    it('accepts "dev" as buildHash and requests without an Origin header', async () => {
        mockConnection.expect('insert', () => 1);

        const request = new NextRequest('http://localhost:3000/api/vitals', {
            method: 'POST',
            headers: { host: 'localhost:3000' },
            body: JSON.stringify({
                buildHash: 'dev',
                deviceType: 'Mobile',
                vitals: [
                    {
                        metric: 'CLS',
                        value: 0.04,
                        navigationType: 'navigate',
                        pathname: '/',
                    },
                ],
            }),
        });

        const response = await POST(request);
        expect(response.status).toEqual(204);
    });

    it('rejects cross-origin requests with 403', async () => {
        const response = await POST(createRequest(
            JSON.stringify({
                buildHash: 'dev',
                deviceType: 'Desktop',
                vitals: [
                    { metric: 'FCP', value: 100, navigationType: 'navigate', pathname: '/' },
                ],
            }),
            { origin: 'https://evil.example' },
        ));

        expect(response.status).toEqual(403);
    });

    it('rejects malformed JSON and invalid payloads with 400', async () => {
        const badJson = await POST(createRequest('not-json'));
        expect(badJson.status).toEqual(400);

        const badHash = await POST(createRequest(JSON.stringify({
            buildHash: 'invalid-hash',
            deviceType: 'Desktop',
            vitals: [
                { metric: 'FCP', value: 100, navigationType: 'navigate', pathname: '/' },
            ],
        })));
        expect(badHash.status).toEqual(400);

        const emptyBatch = await POST(createRequest(JSON.stringify({
            buildHash: 'dev',
            deviceType: 'Desktop',
            vitals: [],
        })));
        expect(emptyBatch.status).toEqual(400);

        const negativeValue = await POST(createRequest(JSON.stringify({
            buildHash: 'dev',
            deviceType: 'Desktop',
            vitals: [
                { metric: 'INP', value: -5, navigationType: 'navigate', pathname: '/admin' },
            ],
        })));
        expect(negativeValue.status).toEqual(400);
    });
});
