// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

import { Instrumentation, runWithTaskContext, runWithUserContext } from './Instrumentation';
import { useMockConnection } from '@lib/database/Connection';

describe('Instrumentation', () => {
    const mockConnection = useMockConnection();

    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        fetchSpy = vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('captures context including taskId and userId from AsyncLocalStorage', async () => {
        const direct = Instrumentation.withContext({
            integration: 'AnimeCon',
            operation: 'GetFloors',
            userId: 42,
        });

        expect(direct.contextForTesting).toEqual({
            integration: 'AnimeCon',
            operation: 'GetFloors',
            taskId: undefined,
            userId: 42,
        });

        await runWithTaskContext(99, async () => {
            const withinTask = Instrumentation.withContext({
                integration: 'AnimeCon',
                operation: 'SyncActivities',
            });

            expect(withinTask.contextForTesting).toEqual({
                integration: 'AnimeCon',
                operation: 'SyncActivities',
                taskId: 99,
            });
        });

        await runWithUserContext(77, async () => {
            const withinUser = Instrumentation.withContext({
                integration: 'AnimeCon',
                operation: 'GetFloors',
            });

            expect(withinUser.contextForTesting).toEqual({
                integration: 'AnimeCon',
                operation: 'GetFloors',
                taskId: undefined,
                userId: 77,
            });
        });
    });

    it('truncates operations exceeding 255 characters', () => {
        const instrumentation = Instrumentation.withContext({
            integration: 'AnimeCon',
            operation: 'a'.repeat(300),
        });

        expect(instrumentation.contextForTesting.operation).toHaveLength(255);
    });

    it('truncates input and output payloads exceeding 65,535 characters', async () => {
        fetchSpy.mockResolvedValueOnce(new Response('b'.repeat(70000), {
            status: 200,
        }));

        let insertedQuery = '';
        let insertedParams: any[] = [];
        mockConnection.expect('insert', (query, params) => {
            insertedQuery = query;
            insertedParams = params;
            return 1;
        });

        const instrumentation = Instrumentation.withContext({
            integration: 'AnimeCon',
            operation: 'LargePayload',
        });

        await instrumentation.instrumentedFetch('https://example.com/api', {
            method: 'POST',
            body: 'a'.repeat(70000),
        });

        await instrumentation.completionPromise;

        const status = instrumentation.statusForTesting;
        expect(status.input).toHaveLength(65535);
        expect(status.output).toHaveLength(65535);

        expect(insertedQuery).toContain('insert into integrations_logs');
        expect(insertedParams[5]).toHaveLength(65535);  // log_input
        expect(insertedParams[6]).toHaveLength(65535);  // log_output
    });

    it('populates status and records to the database on a successful fetch', async () => {
        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'application/json' },
        }));

        let insertedQuery = '';
        let insertedParams: any[] = [];
        mockConnection.expect('insert', (query, params) => {
            insertedQuery = query;
            insertedParams = params;
            return 1;
        });

        await runWithTaskContext(12, async () => {
            await runWithUserContext(34, async () => {
                const instrumentation = Instrumentation.withContext({
                    integration: 'AnimeCon',
                    operation: 'TestSuccess',
                });

                const response = await instrumentation.instrumentedFetch(
                    'https://example.com/api',
                    {
                        method: 'POST',
                        headers: { Authorization: 'Bearer secret-token' },
                        body: JSON.stringify({ query: 'floors' }),
                    });

                expect(await response.json()).toEqual({ ok: true });
                await instrumentation.completionPromise;

                const status = instrumentation.statusForTesting;
                expect(status.status).toBe('Success');
                expect(status.exception).toBeUndefined();
                expect(status.durationTimeToFirstByteMs).toBeGreaterThanOrEqual(0);
                expect(status.durationMs).toBeGreaterThanOrEqual(status.durationTimeToFirstByteMs!);

                expect(JSON.parse(status.input!)).toEqual({
                    url: 'https://example.com/api',
                    method: 'POST',
                    headers: { authorization: 'Bearer secret-token' },
                    body: { query: 'floors' },
                });

                expect(JSON.parse(status.output!)).toEqual({
                    status: 200,
                    statusText: 'OK',
                    headers: { 'content-type': 'application/json' },
                    body: { ok: true },
                });
            });
        });

        expect(insertedQuery).toContain('insert into integrations_logs');
        expect(insertedParams[0]).toBe('AnimeCon');
        expect(insertedParams[1]).toBe('TestSuccess');
        expect(insertedParams[2]).toBe(34);  // log_user_id
        expect(insertedParams[3]).toBe(12);  // log_task_id
        expect(insertedParams[4]).toBe('Success');
    });

    it('marks non-2xx responses as Failure and records even if body is unread', async () => {
        const formData = new FormData();
        formData.set('grant_type', 'password');
        formData.set('client_secret', 'top-secret');

        fetchSpy.mockResolvedValueOnce(new Response('Unauthorized access', {
            status: 401,
            statusText: 'Unauthorized',
        }));

        let insertedQuery = '';
        let insertedParams: any[] = [];
        mockConnection.expect('insert', (query, params) => {
            insertedQuery = query;
            insertedParams = params;
            return 1;
        });

        const instrumentation = Instrumentation.withContext({
            integration: 'AnimeCon',
            operation: 'Authentication',
        });

        const response = await instrumentation.instrumentedFetch('https://example.com/auth', {
            method: 'POST',
            body: formData,
        });

        // Intentionally do not consume `response.body` on the caller side.
        expect(response.ok).toBe(false);
        await instrumentation.completionPromise;

        const status = instrumentation.statusForTesting;
        expect(status.status).toBe('Failure');
        expect(status.exception).toBeUndefined();

        expect(JSON.parse(status.input!)).toEqual({
            url: 'https://example.com/auth',
            method: 'POST',
            body: {
                grant_type: 'password',
                client_secret: 'top-secret',
            },
        });

        expect(JSON.parse(status.output!)).toEqual({
            status: 401,
            statusText: 'Unauthorized',
            headers: { 'content-type': 'text/plain;charset=UTF-8' },
            body: 'Unauthorized access',
        });

        expect(insertedQuery).toContain('insert into integrations_logs');
        expect(insertedParams[0]).toBe('AnimeCon');
        expect(insertedParams[1]).toBe('Authentication');
        expect(insertedParams[4]).toBe('Failure');
    });

    it('captures exceptions thrown by fetch() and serializes error causes', async () => {
        const networkError = new Error('connect ECONNREFUSED', {
            cause: { code: 'ECONNREFUSED', port: 443 },
        });
        fetchSpy.mockRejectedValueOnce(networkError);

        let insertedQuery = '';
        let insertedParams: any[] = [];
        mockConnection.expect('insert', (query, params) => {
            insertedQuery = query;
            insertedParams = params;
            return 1;
        });

        const instrumentation = Instrumentation.withContext({
            integration: 'AnimeCon',
            operation: 'NetworkFailure',
        });

        await expect(
            instrumentation.instrumentedFetch('https://example.com/unreachable')
        ).rejects.toThrow('connect ECONNREFUSED');

        await instrumentation.completionPromise;

        const status = instrumentation.statusForTesting;
        expect(status.status).toBe('Exception');
        expect(status.exception).toBe(networkError);
        expect(status.durationMs).toBeGreaterThanOrEqual(0);
        expect(status.durationTimeToFirstByteMs).toBeUndefined();
        expect(status.output).toBeUndefined();

        expect(insertedQuery).toContain('log_error_name');
        expect(insertedQuery).toContain('log_error_message');
        expect(insertedQuery).toContain('log_error_cause');
        expect(insertedQuery).toContain('log_error_stack');
        expect(insertedParams).toContain('Error');
        expect(insertedParams).toContain('connect ECONNREFUSED');
        expect(insertedParams).toContain(JSON.stringify({ code: 'ECONNREFUSED', port: 443 }));
    });

    it('does not block streaming responses and records only after stream completion', async () => {
        let controller!: ReadableStreamDefaultController<Uint8Array>;
        const stream = new ReadableStream<Uint8Array>({
            start(c) {
                controller = c;
            },
        });

        fetchSpy.mockResolvedValueOnce(new Response(stream, { status: 200 }));

        let recorded = false;
        mockConnection.expect('insert', () => {
            recorded = true;
            return 1;
        });

        const instrumentation = Instrumentation.withContext({
            integration: 'AnimeCon',
            operation: 'StreamingCall',
        });

        // `instrumentedFetch` must resolve immediately before any stream chunks are enqueued.
        const response = await instrumentation.instrumentedFetch('https://example.com/stream');
        expect(recorded).toBe(false);

        const reader = response.body!.getReader();
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        controller.enqueue(encoder.encode('Hello, '));
        const firstChunk = await reader.read();
        expect(decoder.decode(firstChunk.value)).toBe('Hello, ');
        expect(recorded).toBe(false);

        controller.enqueue(encoder.encode('world!'));
        const secondChunk = await reader.read();
        expect(decoder.decode(secondChunk.value)).toBe('world!');

        controller.close();
        const finalRead = await reader.read();
        expect(finalRead.done).toBe(true);

        await instrumentation.completionPromise;
        expect(recorded).toBe(true);

        const status = instrumentation.statusForTesting;
        expect(status.status).toBe('Success');
        expect(status.durationTimeToFirstByteMs).toBeGreaterThanOrEqual(0);
        expect(status.durationMs).toBeGreaterThanOrEqual(status.durationTimeToFirstByteMs!);
        expect(JSON.parse(status.output!)).toEqual({
            status: 200,
            body: 'Hello, world!',
        });
    });

    it('records stream errors as Exception and still writes to the database', async () => {
        let controller!: ReadableStreamDefaultController<Uint8Array>;
        const stream = new ReadableStream<Uint8Array>({
            start(c) {
                controller = c;
            },
        });

        fetchSpy.mockResolvedValueOnce(new Response(stream, { status: 200 }));

        let insertedParams: any[] = [];
        mockConnection.expect('insert', (_query, params) => {
            insertedParams = params;
            return 1;
        });

        const instrumentation = Instrumentation.withContext({
            integration: 'AnimeCon',
            operation: 'BrokenStream',
        });

        await instrumentation.instrumentedFetch('https://example.com/stream');

        const streamError = new Error('Stream abruptly terminated');
        controller.error(streamError);

        await instrumentation.completionPromise;
        expect(insertedParams).toContain('Exception');
        expect(insertedParams).toContain('Stream abruptly terminated');

        const status = instrumentation.statusForTesting;
        expect(status.status).toBe('Exception');
        expect(status.exception).toBe(streamError);
        expect(status.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('throws when an Instrumentation instance is reused across multiple calls', async () => {
        fetchSpy.mockResolvedValueOnce(new Response('ok', { status: 200 }));
        mockConnection.expect('insert');

        const instrumentation = Instrumentation.withContext({
            integration: 'AnimeCon',
            operation: 'SingleUseCall',
        });

        const response = await instrumentation.instrumentedFetch('https://example.com/first');
        expect(await response.text()).toBe('ok');
        await instrumentation.completionPromise;

        await expect(
            instrumentation.instrumentedFetch('https://example.com/second')
        ).rejects.toThrow('This Instrumentation instance has already been consumed.');
    });

    it('omits the response body when omitResponseBody is set', async () => {
        fetchSpy.mockResolvedValueOnce(new Response('large-binary-payload', {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'application/octet-stream' },
        }));

        mockConnection.expect('insert');

        const instrumentation = Instrumentation.withContext({
            integration: 'GenAI',
            operation: 'https://example.com/generateImage',
        });

        const response = await instrumentation.instrumentedFetch(
            'https://example.com/generateImage',
            { method: 'POST' },
            { omitResponseBody: true });

        expect(await response.text()).toBe('large-binary-payload');
        await instrumentation.completionPromise;

        const status = instrumentation.statusForTesting;
        expect(status.status).toBe('Success');
        expect(status.durationTimeToFirstByteMs).toBeGreaterThanOrEqual(0);
        expect(status.durationMs).toBeGreaterThanOrEqual(status.durationTimeToFirstByteMs!);
        expect(JSON.parse(status.output!)).toEqual({
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'application/octet-stream' },
        });
    });

    it('swallows database errors in record() without rejecting completionPromise', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        fetchSpy.mockResolvedValueOnce(new Response('ok', { status: 200 }));

        mockConnection.expect('insert', () => {
            throw new Error('Database connection lost');
        });

        const instrumentation = Instrumentation.withContext({
            integration: 'AnimeCon',
            operation: 'DbFailure',
        });

        const response = await instrumentation.instrumentedFetch('https://example.com/api');
        expect(await response.text()).toBe('ok');

        await expect(instrumentation.completionPromise).resolves.toBeUndefined();
        expect(errorSpy).toHaveBeenCalledTimes(1);
    });
});
