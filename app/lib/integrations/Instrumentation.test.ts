// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { vi } from 'vitest';

import { Instrumentation, runWithTaskContext } from './Instrumentation';

describe('Instrumentation', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;
    let recordSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        fetchSpy = vi.spyOn(globalThis, 'fetch');
        recordSpy = vi.spyOn(Instrumentation.prototype as any, 'record').mockResolvedValue();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('captures context including taskId from AsyncLocalStorage', async () => {
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
    });

    it('populates status and calls record() on a successful fetch', async () => {
        fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'application/json' },
        }));

        const instrumentation = Instrumentation.withContext({
            integration: 'AnimeCon',
            operation: 'TestSuccess',
        });

        const response = await instrumentation.instrumentedFetch('https://example.com/api', {
            method: 'POST',
            headers: { Authorization: 'Bearer secret-token' },
            body: JSON.stringify({ query: 'floors' }),
        });

        expect(await response.json()).toEqual({ ok: true });
        await instrumentation.completionPromise;

        expect(recordSpy).toHaveBeenCalledTimes(1);

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

    it('marks non-2xx responses as Failure and calls record() even if body is unread', async () => {
        const formData = new FormData();
        formData.set('grant_type', 'password');
        formData.set('client_secret', 'top-secret');

        fetchSpy.mockResolvedValueOnce(new Response('Unauthorized access', {
            status: 401,
            statusText: 'Unauthorized',
        }));

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

        expect(recordSpy).toHaveBeenCalledTimes(1);

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
    });

    it('captures exceptions thrown by fetch() and still calls record()', async () => {
        const networkError = new Error('connect ECONNREFUSED');
        fetchSpy.mockRejectedValueOnce(networkError);

        const instrumentation = Instrumentation.withContext({
            integration: 'AnimeCon',
            operation: 'NetworkFailure',
        });

        await expect(
            instrumentation.instrumentedFetch('https://example.com/unreachable')
        ).rejects.toThrow('connect ECONNREFUSED');

        await instrumentation.completionPromise;

        expect(recordSpy).toHaveBeenCalledTimes(1);

        const status = instrumentation.statusForTesting;
        expect(status.status).toBe('Exception');
        expect(status.exception).toBe(networkError);
        expect(status.durationMs).toBeGreaterThanOrEqual(0);
        expect(status.durationTimeToFirstByteMs).toBeUndefined();
        expect(status.output).toBeUndefined();
    });

    it('does not block streaming responses and records only after stream completion', async () => {
        let controller!: ReadableStreamDefaultController<Uint8Array>;
        const stream = new ReadableStream<Uint8Array>({
            start(c) {
                controller = c;
            },
        });

        fetchSpy.mockResolvedValueOnce(new Response(stream, { status: 200 }));

        const instrumentation = Instrumentation.withContext({
            integration: 'AnimeCon',
            operation: 'StreamingCall',
        });

        // `instrumentedFetch` must resolve immediately before any stream chunks are enqueued.
        const response = await instrumentation.instrumentedFetch('https://example.com/stream');
        expect(recordSpy).not.toHaveBeenCalled();

        const reader = response.body!.getReader();
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        controller.enqueue(encoder.encode('Hello, '));
        const firstChunk = await reader.read();
        expect(decoder.decode(firstChunk.value)).toBe('Hello, ');
        expect(recordSpy).not.toHaveBeenCalled();

        controller.enqueue(encoder.encode('world!'));
        const secondChunk = await reader.read();
        expect(decoder.decode(secondChunk.value)).toBe('world!');

        controller.close();
        const finalRead = await reader.read();
        expect(finalRead.done).toBe(true);

        await instrumentation.completionPromise;
        expect(recordSpy).toHaveBeenCalledTimes(1);

        const status = instrumentation.statusForTesting;
        expect(status.status).toBe('Success');
        expect(status.durationTimeToFirstByteMs).toBeGreaterThanOrEqual(0);
        expect(status.durationMs).toBeGreaterThanOrEqual(status.durationTimeToFirstByteMs!);
        expect(JSON.parse(status.output!)).toEqual({
            status: 200,
            body: 'Hello, world!',
        });
    });

    it('records stream errors as Exception and still calls record()', async () => {
        let controller!: ReadableStreamDefaultController<Uint8Array>;
        const stream = new ReadableStream<Uint8Array>({
            start(c) {
                controller = c;
            },
        });

        fetchSpy.mockResolvedValueOnce(new Response(stream, { status: 200 }));

        const instrumentation = Instrumentation.withContext({
            integration: 'AnimeCon',
            operation: 'BrokenStream',
        });

        await instrumentation.instrumentedFetch('https://example.com/stream');

        const streamError = new Error('Stream abruptly terminated');
        controller.error(streamError);

        await instrumentation.completionPromise;
        expect(recordSpy).toHaveBeenCalledTimes(1);

        const status = instrumentation.statusForTesting;
        expect(status.status).toBe('Exception');
        expect(status.exception).toBe(streamError);
        expect(status.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('throws when an Instrumentation instance is reused across multiple calls', async () => {
        fetchSpy.mockResolvedValueOnce(new Response('ok', { status: 200 }));

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

        expect(recordSpy).toHaveBeenCalledTimes(1);

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
});
