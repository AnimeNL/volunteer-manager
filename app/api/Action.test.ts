// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { NextRequest } from 'next/server';
import { forbidden } from 'next/navigation';
import { serialize } from 'cookie';
import { z } from 'zod/v4';

import type { User } from '@lib/auth/User';
import { SetRecordErrorLogDeferDelegate } from '@lib/Log';
import { type ActionProps, executeAction } from './Action';
import { expectAuthenticationQuery } from '@lib/auth/AuthenticationTestHelpers';
import { kSessionCookieName, sealSession } from '@lib/auth/Session';
import { useMockConnection } from '@lib/database/Connection';

describe('Action', () => {
    const mockConnection = useMockConnection();

    let errorLogDelegateInvoked: boolean = false;

    beforeEach(() => {
        errorLogDelegateInvoked = false;
        SetRecordErrorLogDeferDelegate(async () => { errorLogDelegateInvoked = true });
    });

    afterEach(() => SetRecordErrorLogDeferDelegate(/* default= */ undefined));

    /**
     * Creates a NextRequest instance based on the given `body`, which will be stored as the request
     * body in a JSON-serialized representation.
     *
     * @param method The request method that should be used.
     * @param body The request body that should be included.
     * @param url The URL to which the request should be made, if any.
     * @param headers The headers to include with the request, if any.
     * @returns A NextRequest instance representing a POST request containing the given body.
     */
    function createRequest(method: string, body: any, url?: string, headers?: Headers)
        : NextRequest
    {
        if (method.toLocaleUpperCase() === 'GET' && !!body)
            throw new Error('Request payloads are not supported for GET requests');

        return new class extends NextRequest {
            override set url(value: string) { /* ignore */ }
        }(url ?? 'https://example.com/api', {
            method,
            body: body ? JSON.stringify(body) : undefined,
            headers,
        });
    }

    it('is able to validate properties stored in the incoming request', async () => {
        const interfaceDefinition = z.object({
            request: z.object({
                first: z.string(),
                second: z.number().optional(),
            }),
            response: z.strictObject({ success: z.boolean() }),
        });

        type RequestType = z.infer<typeof interfaceDefinition>['request'];
        type ResponseType = z.infer<typeof interfaceDefinition>['response'];

        let invocationCounter = 0;
        let latestRequest: RequestType | undefined;

        async function MyAction(request: RequestType, props: ActionProps): Promise<ResponseType> {
            invocationCounter++;
            latestRequest = request;

            return { success: true };
        }

        // Case 1: Valid requests are recognised as such.
        {
            const request = createRequest('POST', { first: 'foo', second: 42 });
            const response = await executeAction(request, interfaceDefinition, MyAction);
            const responseBody = await response.json();

            expect(invocationCounter).toBe(1);
            expect(responseBody.success).toBeTruthy();

            expect(latestRequest).not.toBeUndefined();
            expect(latestRequest?.first).toEqual('foo');
            expect(latestRequest?.second).toEqual(42);
        }

        // Case 2: Optional parameters can be omitted.
        {
            const request = createRequest('POST', { first: 'foo' });
            const response = await executeAction(request, interfaceDefinition, MyAction);
            const responseBody = await response.json();

            expect(invocationCounter).toBe(2);
            expect(responseBody.success).toBeTruthy();
        }

        // Case 3: Extra parameters will be ignored.
        {
            const request = createRequest('POST', { first: 'foo', third: 'baz' });
            const response = await executeAction(request, interfaceDefinition, MyAction);
            const responseBody = await response.json();

            expect(invocationCounter).toBe(3);
            expect(responseBody.success).toBeTruthy();
        }

        // Case 4: Missing parameters will count as an error.
        {
            const request = createRequest('POST', { second: 42 });
            const response = await executeAction(request, interfaceDefinition, MyAction);
            const responseBody = await response.json();

            expect(invocationCounter).toBe(3);
            expect(responseBody.success).toBeFalsy();
        }

        // Case 5: Parameters of an invalid type will count as an error.
        {
            const request = createRequest('POST', { first: 42 });
            const response = await executeAction(request, interfaceDefinition, MyAction);
            const responseBody = await response.json();

            expect(invocationCounter).toBe(3);
            expect(responseBody.success).toBeFalsy();
        }
    });

    it('validates the action return value prior to sending it to the client', async () => {
        const interfaceDefinition = z.object({
            request: z.object({ /* no input necessary */ }),
            response: z.strictObject({
                first: z.string(),
                second: z.number().optional(),
            }),
        });

        type RequestType = z.infer<typeof interfaceDefinition>['request'];
        type ResponseType = z.infer<typeof interfaceDefinition>['response'];

        let invocationCounter = 0;
        let responseValue: any;

        async function MyAction(request: RequestType, props: ActionProps): Promise<ResponseType> {
            ++invocationCounter;
            return responseValue;
        }

        // Case 1: Valid responses are recognised as such.
        {
            responseValue = { first: 'hello!', second: 42 };

            const request = createRequest('POST', { /* no payload */ });
            const response = await executeAction(request, interfaceDefinition, MyAction);
            const responseBody = await response.json();

            expect(invocationCounter).toBe(1);
            expect(responseBody.first).toEqual('hello!');
            expect(responseBody.second).toEqual(42);
        }

        // Case 2: Optional parameters can be omitted.
        {
            responseValue = { first: 'world!' };

            const request = createRequest('POST', { /* no payload */ });
            const response = await executeAction(request, interfaceDefinition, MyAction);
            const responseBody = await response.json();

            expect(invocationCounter).toBe(2);
            expect(responseBody.first).toEqual('world!');
            expect(responseBody.second).toBeUndefined();
        }

        // Case 3: Extra parameters will be seen as an error.
        {
            responseValue = { first: 'foobar!', third: 'baz' };

            const request = createRequest('POST', { /* no payload */ });
            const response = await executeAction(request, interfaceDefinition, MyAction);
            const responseBody = await response.json();

            expect(responseBody.success).toBeFalsy();
            expect(responseBody.error).toContain('Unrecognized key');

            expect(invocationCounter).toBe(3);
        }

        // Case 4: Missing parameters will be seen as an error.
        {
            responseValue = { second: 42 };

            const request = createRequest('POST', { /* no payload */ });
            const response = await executeAction(request, interfaceDefinition, MyAction);
            const responseBody = await response.json();

            expect(responseBody.success).toBeFalsy();
            expect(responseBody.error).toContain('(response/first): Invalid input');

            expect(invocationCounter).toBe(4);
        }

        // Case 5: Parameters of an invalid type will be seen as an error.
        {
            responseValue = { first: 42 };

            const request = createRequest('POST', { /* no payload */ });
            const response = await executeAction(request, interfaceDefinition, MyAction);
            const responseBody = await response.json();

            expect(responseBody.success).toBeFalsy();
            expect(responseBody.error).toContain('(response/first): Invalid input');

            expect(invocationCounter).toBe(5);
        }
    });

    it('is able to provide access to the request and response headers', async () => {
        const interfaceDefinition = z.object({
            request: z.object({ /* no input necessary */ }),
            response: z.object({ /* no response necessary */ }),
        });

        type RequestType = z.infer<typeof interfaceDefinition>['request'];
        type ResponseType = z.infer<typeof interfaceDefinition>['response'];

        let invocationCounter = 0;

        async function MyAction(request: RequestType, props: ActionProps): Promise<ResponseType> {
            ++invocationCounter;

            const { requestHeaders, responseHeaders } = props;

            responseHeaders.set('X-Third', 'header');

            for (const [ name, value ] of requestHeaders.entries())
                responseHeaders.set(name, 'says ' + value);

            return { /* empty response */ };
        }

        const requestHeaders = new Headers([
            [ 'X-First', '1' ],
            [ 'X-Second', 'banana' ],
        ]);

        const request =
            createRequest('POST', { /* no payload */ }, /* url= */ undefined, requestHeaders);
        const response = await executeAction(request, interfaceDefinition, MyAction);
        const responseBody = await response.json();

        expect(invocationCounter).toEqual(1);
        expect(responseBody).toEqual({ /* empty response */ });
        expect(response.headers.get('X-First')).toEqual('says 1');
        expect(response.headers.get('X-Second')).toEqual('says banana');
        expect(response.headers.get('X-Third')).toEqual('header');
    });

    it('is able to automatically identify the user from the Action call', async () => {
        const sealedSession = await sealSession({ id: 42, token: 9001 });
        const sealedCookie = serialize(kSessionCookieName, sealedSession, { httpOnly: true });
        const headers = new Headers([ ['Cookie', sealedCookie ] ]);

        expectAuthenticationQuery(mockConnection, {
            username: 'joe@example.com',
            firstName: 'Joe',
            lastName: 'Example',
        });

        const interfaceDefinition = z.object({
            request: z.object({ /* no input necessary */ }),
            response: z.object({ /* no response necessary */ }),
        });

        type RequestType = z.infer<typeof interfaceDefinition>['request'];
        type ResponseType = z.infer<typeof interfaceDefinition>['response'];

        let user: User | undefined;

        async function MyAction(request: RequestType, props: ActionProps): Promise<ResponseType> {
            user = props.user;
            return { /* empty response */ };
        }

        const request = createRequest('POST', { /* no payload */ }, /* url= */ undefined, headers);
        const response = await executeAction(request, interfaceDefinition, MyAction);

        await expect(response.json()).resolves.toEqual({ /* empty response */ });

        expect(user).not.toBeUndefined();
        expect(user?.username).toEqual('joe@example.com');
        expect(user?.firstName).toEqual('Joe');
        expect(user?.lastName).toEqual('Example');
    });

    it('is able to easily issue no access (403) errors', async () => {
        const interfaceDefinition = z.object({
            request: z.object({ /* no input necessary */ }),
            response: z.object({ /* no response necessary */ }),
        });

        type RequestType = z.infer<typeof interfaceDefinition>['request'];
        type ResponseType = z.infer<typeof interfaceDefinition>['response'];

        async function MyAction(request: RequestType, props: ActionProps): Promise<ResponseType> {
            forbidden();
        }

        const request = createRequest('POST', { /* no payload */ });
        const response = await executeAction(request, interfaceDefinition, MyAction);

        expect(response.ok).toBeFalsy();
        expect(response.status).toBe(403);
    });

    it('understands how to derive request parameters from GET requests', async () => {
        const interfaceDefinition = z.object({
            request: z.object({
                name: z.string(),
                child: z.object({
                    number: z.coerce.number(),  // coercion is necessary as params are strings
                }),
            }),
            response: z.object({
                value: z.string(),
            }),
        });

        type RequestType = z.infer<typeof interfaceDefinition>['request'];
        type ResponseType = z.infer<typeof interfaceDefinition>['response'];

        async function MyAction(request: RequestType, props: ActionProps): Promise<ResponseType> {
            return { value: `${request.name}-${request.child.number}` };
        }

        const request = createRequest(
            'GET', /* body= */ undefined, 'https://example.com/?name=Joe&child.number=42');

        const response = await executeAction(request, interfaceDefinition, MyAction);

        expect(response.ok).toBeTruthy();
        expect(response.status).toBe(200);

        const responseBody = await response.json();
        expect(responseBody.value).toEqual('Joe-42');
    });

    it('considers route parameters as part of the input request payload', async () => {
        const interfaceDefinition = z.object({
            request: z.object({
                id: z.coerce.number(),  // coercion is necessary as request params are strings
                name: z.string(),
            }),
            response: z.object({
                value: z.string(),
            }),
        });

        type RequestType = z.infer<typeof interfaceDefinition>['request'];
        type ResponseType = z.infer<typeof interfaceDefinition>['response'];

        async function MyAction(request: RequestType, props: ActionProps): Promise<ResponseType> {
            return { value: `${request.id}-${request.name}` };
        }

        const request = createRequest(
            'GET', /* body= */ undefined, 'https://example.com/21/?name=Joe');

        // Single value (i.e. NextJS' `[id]` route property)
        {
            const response =
                await executeAction(request, interfaceDefinition, MyAction, { id: '21' });

            expect(response.ok).toBeTruthy();
            expect(response.status).toBe(200);

            const responseBody = await response.json();
            expect(responseBody.value).toEqual('21-Joe');
        }

        // Multie value (i.e. NextJS' `[...id]` route property)
        {
            const response =
                await executeAction(request, interfaceDefinition, MyAction, { id: [ '21' ] });

            expect(response.ok).toBeTruthy();
            expect(response.status).toBe(200);

            const responseBody = await response.json();
            expect(responseBody.value).toEqual('21-Joe');
        }
    });

    it('logs exceptions thrown during API input validation in the database', async () => {
        const interfaceDefinition = z.object({
            request: z.object({
                value: z.number(),
            }),
            response: z.object({
                value: z.boolean(),
            }),
        });

        type RequestType = z.infer<typeof interfaceDefinition>['request'];
        type ResponseType = z.infer<typeof interfaceDefinition>['response'];

        async function MyAction(request: RequestType, props: ActionProps): Promise<ResponseType> {
            return { value: true };
        }

        // Step 0: Validate preconditions
        expect(errorLogDelegateInvoked).toBeFalsy();

        // Step 1: Issue the request with an invalid payload (string instead of number)
        const request = createRequest('POST', { value: '21' }, 'https://example.com/api');
        const response = await executeAction(request, interfaceDefinition, MyAction);

        expect(response.ok).toBeFalsy();
        expect(response.status).toBe(500);

        const responseBody = await response.json();
        expect(responseBody.error).toContain('The server was not able to validate the request');

        // Step 2: Validate that a database query was issued by the Action runner
        expect(errorLogDelegateInvoked).toBeTruthy();
    });

    it('logs exceptions thrown during API output validation in the database', async () => {
        const interfaceDefinition = z.object({
            request: z.object({
                value: z.number(),
            }),
            response: z.object({
                value: z.boolean(),
            }),
        });

        type RequestType = z.infer<typeof interfaceDefinition>['request'];
        type ResponseType = z.infer<typeof interfaceDefinition>['response'];

        async function MyAction(request: RequestType, props: ActionProps): Promise<ResponseType> {
            return { value: 21 } as any;  // note: number (actual) rather than boolean (expected)
        }

        // Step 0: Validate preconditions
        expect(errorLogDelegateInvoked).toBeFalsy();

        // Step 1: Issue the request with an invalid response data
        const request = createRequest('POST', { value: 21 }, 'https://example.com/api');
        const response = await executeAction(request, interfaceDefinition, MyAction);

        expect(response.ok).toBeFalsy();
        expect(response.status).toBe(500);

        const responseBody = await response.json();
        expect(responseBody.error).toContain('Action response validation failed');

        // Step 2: Validate that a database query was issued by the Action runner
        expect(errorLogDelegateInvoked).toBeTruthy();
    });

    it('logs exceptions thrown in API actions in the database', async () => {
        const interfaceDefinition = z.object({
            request: z.object({ /* no data */ }),
            response: z.object({ /* no data */ }),
        });

        type RequestType = z.infer<typeof interfaceDefinition>['request'];
        type ResponseType = z.infer<typeof interfaceDefinition>['response'];

        async function MyAction(request: RequestType, props: ActionProps): Promise<ResponseType> {
            throw new Error('Something went wrong');
        }

        // Step 0: Validate preconditions
        expect(errorLogDelegateInvoked).toBeFalsy();

        // Step 1: Issue the request, with the action throwing an exception
        const request = createRequest('GET', /* payload= */ undefined, 'https://example.com/api');
        const response = await executeAction(request, interfaceDefinition, MyAction);

        expect(response.ok).toBeFalsy();
        expect(response.status).toBe(500);

        const responseBody = await response.json();
        expect(responseBody.error).toContain('The server was not able to handle the request');
        expect(responseBody.error).toContain('Something went wrong');

        // Step 2: Validate that a database query was issued by the Action runner
        expect(errorLogDelegateInvoked).toBeTruthy();
    });
});
