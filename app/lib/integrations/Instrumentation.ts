// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { AsyncLocalStorage } from 'node:async_hooks';

import type { IntegrationLogStatus, IntegrationLogTarget } from '@lib/database/Types';
import db, { tIntegrationsLogs } from '@lib/database';

/**
 * Async-local storage tracking the active database `taskId` during scheduled task execution.
 */
const kTaskContextStorage = new AsyncLocalStorage<number>();

/**
 * Maximum length of a serialized input or output payload, matching MariaDB's `TEXT` column limit.
 */
const kMaxPayloadLength = 65535;

/**
 * Runs the given `callback` with `taskId` bound in async-local storage so that any instrumented
 * external API calls made during the task are automatically attributed to `taskId`.
 */
export function runWithTaskContext<T>(taskId: number, callback: () => Promise<T>): Promise<T> {
    return kTaskContextStorage.run(taskId, callback);
}

/**
 * Context that should be available when creating an Instrumentation
 */
interface InstrumentationContext {
    /**
     * Integration that is being instrumented.
     */
    integration: IntegrationLogTarget;

    /**
     * Operation, as part of the integration, that is being instrumented.
     */
    operation: string;

    /**
     * Active task based on which the call is being made.
     */
    taskId?: number;

    /**
     * User on whose behalf the call is being made.
     */
    userId?: number;
}

/**
 * Status of an instrumented call, which will be updated at runtime for a given `Instrumentation`.
 */
interface InstrumentationStatus {
    /**
     * Status of the instrumented execution. Defaults to "Exception".
     */
    status: IntegrationLogStatus;

    /**
     * Input given to the call. May include both HTTP Headers and body context.
     */
    input?: string;

    /**
     * Output received by the call.
     */
    output?: string;

    /**
     * Duration of the call, from instigation to receiving the first byte of the response.
     */
    durationTimeToFirstByteMs?: number;

    /**
     * Duration of the call, from instigation to having received the full response.
     */
    durationMs?: number;

    /**
     * Exception thrown during the call, if any.
     */
    exception?: Error;
}

/**
 * Options that may be passed to `instrumentedFetch()` to customize how the call is recorded.
 */
interface InstrumentedFetchOptions {
    /**
     * Whether the response body should be omitted from the recorded output.
     */
    omitResponseBody?: boolean;
}

/**
 * Class responsible for instrumenting API calls made as part of our external integrations.
 */
export class Instrumentation {
    /**
     * Creates a new Instrumentation instance for the given `context`. The task ID will be injected
     * automatically when this can be derived from the execution context.
     */
    public static withContext(context: Omit<InstrumentationContext, 'taskId'>): Instrumentation {
        return new Instrumentation({
            ...context,
            operation: context.operation.substring(0, 255),
            taskId: kTaskContextStorage.getStore(),
        });
    }

    // ---------------------------------------------------------------------------------------------

    #context: InstrumentationContext;
    #status: InstrumentationStatus;

    #completionPromise: Promise<void> | undefined;

    private constructor(context: InstrumentationContext) {
        this.#context = context;
        this.#status = {
            status: 'Exception',
        };
    }

    /**
     * Context and status of the instrumented call, only exposed for testing purposes.
     */
    get contextForTesting(): Readonly<InstrumentationContext> { return this.#context; }
    get statusForTesting(): Readonly<InstrumentationStatus> { return this.#status; }

    /**
     * Promise that will be resolved when the instrumentation run has fully completed.
     */
    get completionPromise() { return this.#completionPromise; }

    /**
     * Executes an instrumented `fetch()`.
     *
     * This method is identical to the Web Platform's `fetch()` method, with the exception that its
     * result and behaviour will be instrumented and stored in the database.
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch
     */
    async instrumentedFetch(
        input: RequestInfo | URL, init?: RequestInit, options?: InstrumentedFetchOptions)
        : Promise<Response>
    {
        if (!!this.#completionPromise)
            throw new Error('This Instrumentation instance has already been consumed.');

        const startTime = performance.now();

        this.#status = {
            status: 'Exception',
            input: this.serializeInput(input, init),
        };

        let response: Response;
        try {
            response = await fetch(input, init);
        } catch (error: unknown) {
            this.#status.status = 'Exception';
            this.#status.durationMs = performance.now() - startTime;
            this.#status.exception = error instanceof Error ? error : new Error(String(error));

            this.#completionPromise = this.record();
            throw error;
        }

        this.#status.status = response.ok ? 'Success' : 'Failure';
        this.#status.durationTimeToFirstByteMs = performance.now() - startTime;

        this.#completionPromise =
            this.consumeResponse(response.clone(), startTime, options).finally(() => this.record());

        return response;
    }

    // ---------------------------------------------------------------------------------------------

    /**
     * Consumes the cloned response stream in the background to populate `output`, refine
     * `durationTimeToFirstByteMs`, and record `durationMs` without blocking the caller.
     */
    private async consumeResponse(
        response: Response, startTime: number, options?: InstrumentedFetchOptions): Promise<void>
    {
        try {
            const chunks: Uint8Array[] = [];
            let receivedFirstByte = false;

            if (response.body) {
                const reader = response.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (!receivedFirstByte && value?.byteLength) {
                        this.#status.durationTimeToFirstByteMs = performance.now() - startTime;
                        receivedFirstByte = true;
                    }
                    if (done)
                        break;

                    if (value && !options?.omitResponseBody)
                        chunks.push(value);
                }
            }

            this.#status.durationMs = performance.now() - startTime;
            this.#status.output = this.serializeOutput(response, chunks);

        } catch (error: unknown) {
            this.#status.status = 'Exception';
            this.#status.durationMs = performance.now() - startTime;
            this.#status.exception = error instanceof Error ? error : new Error(String(error));
        }
    }

    /**
     * Serializes the input of a `fetch()` request, including the URL, method, headers, and body.
     */
    private serializeInput(...[ input, init ]: Parameters<typeof fetch>): string {
        const request = input instanceof Request ? input : undefined;
        const url = request ? request.url : String(input);
        const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();

        const rawHeaders = new Headers(init?.headers ?? request?.headers);
        const headers = Object.fromEntries(rawHeaders.entries());

        let body: unknown;
        const rawBody = init?.body;
        if (typeof rawBody === 'string') {
            body = tryParseJson(rawBody);
        } else if (rawBody instanceof FormData || rawBody instanceof URLSearchParams) {
            body = Object.fromEntries(rawBody.entries());
        } else if (rawBody !== undefined && rawBody !== null) {
            body = String(rawBody);
        }

        return JSON.stringify({
            url,
            method,
            ...(Object.keys(headers).length > 0 ? { headers } : {}),
            ...(body !== undefined ? { body } : {}),
        }).substring(0, kMaxPayloadLength);
    }

    /**
     * Serializes the output of a `fetch()` response, including the status, headers, and body.
     */
    private serializeOutput(response: Response, chunks: Uint8Array[]): string {
        const headers = Object.fromEntries(response.headers.entries());

        let body: unknown;
        if (chunks.length > 0) {
            const text = Buffer.concat(chunks).toString('utf8');
            if (text.length > 0)
                body = tryParseJson(text);
        }

        return JSON.stringify({
            status: response.status,
            ...(response.statusText ? { statusText: response.statusText } : {}),
            ...(Object.keys(headers).length > 0 ? { headers } : {}),
            ...(body !== undefined ? { body } : {}),
        }).substring(0, kMaxPayloadLength);
    }

    /**
     * Records the instrumented call to the database. A query will be executed immediately, as we
     * cannot rely on Next.js being on the call path for use of e.g. `after()`.
     */
    private async record() {
        try {
            const dbInstance = db;
            await dbInstance.insertInto(tIntegrationsLogs)
                .set({
                    logDate: dbInstance.currentZonedDateTime(),
                    logIntegration: this.#context.integration,
                    logOperation: this.#context.operation,
                    logUserId: this.#context.userId,
                    logTaskId: this.#context.taskId,
                    logStatus: this.#status.status,
                    logInput: this.#status.input,
                    logOutput: this.#status.output,
                    logDurationMs: this.#status.durationMs,
                    logDurationTtfbMs: this.#status.durationTimeToFirstByteMs,
                    logErrorName: this.#status.exception?.name,
                    logErrorMessage: this.#status.exception?.message,
                    logErrorCause:
                        this.#status.exception?.cause
                            ? (this.#status.exception.cause instanceof Error
                                  ? String(this.#status.exception.cause)
                                  : (typeof this.#status.exception.cause === 'object'
                                         ? JSON.stringify(this.#status.exception.cause)
                                         : String(this.#status.exception.cause)))
                            : undefined,
                    logErrorStack: this.#status.exception?.stack,
                })
                .executeInsert();
        } catch (error) {
            console.error('Unable to record integration instrumentation log:', error);
        }
    }
}

/**
 * Parses `text` as JSON when valid, falling back to the raw string otherwise.
 */
function tryParseJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}
