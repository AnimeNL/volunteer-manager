// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { NextRequest, NextResponse } from 'next/server';
import type { AnyZodObject, ZodObject, ZodRawShape, z } from 'zod';

import type { User } from '@lib/auth/User';
import { getUserFromHeaders } from '@lib/auth/getUser';

/**
 * Route parameters that can be included in the action request payload, based on REST principles.
 */
export type ActionRouteParams = {
    [key: string]: string | string[];
};

/**
 * Additional properties made available to actions that allow actions to use or manipulate lasting
 * state, such as understanding who the signed in user is and getting or setting headers.
 */
export interface ActionProps {
    /**
     * IP address of the computer who issued this request.
     */
    ip?: string;

    /**
     * Origin of the server to which the request has been issued. (https://example.com).
     */
    origin: string;

    /**
     * Provides access to the request headers. Contents are provided by the client, thus unverified.
     */
    requestHeaders: Headers;

    /**
     * Provides access to the response headers. Will be set directly on the resulting NextResponse.
     */
    responseHeaders: Headers;

    /**
     * The user for whom the request is being made, if any.
     */
    user?: User;
}

/**
 * An Action is an asynchronous function that receives validated request data according to a given
 * type, and returns success data according to another given type. Errors that occur during the
 * action must be thrown as an exception.
 *
 * Optionally, an action may consume the `props` object, which enables it to understand who is
 * making the request and alter their state (e.g. sign them out), among other things.
 */
export type Action<T extends ZodObject<ZodRawShape, any, any>> =
    (request: z.infer<T>['request'], props: ActionProps) => Promise<z.infer<T>['response']>;

/**
 * Error thrown when an HTTP 403 No Access response should be returned instead.
 */
class NoAccessError extends Error {}

/**
 * Creates a response for the given `status` and `payload`. Necessary as the Jest test environment
 * does not provide the latest Response.json() static method yet.
 */
function createResponse(status: number, payload: any): NextResponse {
    return new NextResponse(JSON.stringify(payload), {
        status,
    });
}

/**
 * Distills the request parameters based on the `request`, inferred by the `definition`. When the
 * GET request method is used the parameters must be included in the URL search parameters, whereas
 * other types of requests will carry it as part of the request payload.
 */
async function distillAndValidateRequestParams(
    request: NextRequest, definition: AnyZodObject, routeParams?: ActionRouteParams)
{
    let requestPayload: Record<string, any>;
    switch (request.method) {
        case 'GET':
            requestPayload = { /* empty object */ };
            request.nextUrl.searchParams.forEach((value, key) => {
                const path = key.split('.');
                const property = path.pop();

                // (1) Establish the base reference within the `requestPayload` to write to.
                let baseReference = requestPayload;
                for (const component of path) {
                    if (!Object.hasOwn(baseReference, component))
                        baseReference[component] = {};

                    if (typeof baseReference[component] === 'object')
                        baseReference = baseReference[component];
                    else
                        console.warn(`Ignoring property ${key}: would override other parameters`);
                }

                // (2) Write the `value` to that reference.
                if (Object.hasOwn(baseReference, property!)) {
                    console.warn(`Ignoring property ${key}: the parameter already exists`);
                    return;
                }

                baseReference[property!] = value;
            });

            break;

        case 'DELETE':
        case 'POST':
        case 'PUT':
            requestPayload = await request.json();
            break;

        default:
            return {
                success: false,
                data: undefined,
                error: new Error(`Unsupported request method: ${request.method}`),
            };
    }

    // Inject the `routeParams` in the request payload. Route parameters will be ignored when a
    // property with the same key is already present in the `requestPayload`.
    if (typeof routeParams !== 'undefined') {
        for (const [ key, value ] of Object.entries(routeParams)) {
            if (Object.hasOwn(requestPayload, key))
                continue;  // the `key` already exists on the `requestPayload`, ignore it

            requestPayload[key] = value;
        }
    }

    return definition.safeParse({ request: requestPayload });
}

/**
 * Executes the given `action` for the given `request`, which should validate according to the given
 * `interfaceDefinition`. Both the input coming from the request and the output coming from the
 * action will be validated according to the defined scheme.
 *
 * @param request The NextRequest that was issued
 * @param interfaceDefinition The zod-based definition of the interface, both request and response.
 * @param action The action that is to be executed on the validated request.
 * @param routeParams Route parameters, when REST-style request paths are used.
 * @param userForTesting The user for whom this request is issued, only valid for testing.
 * @returns A NextResponse populated with the resulting information.
 */
export async function executeAction<T extends ZodObject<ZodRawShape, any, any>>(
    request: NextRequest, interfaceDefinition: T, action: Action<T>,
    routeParams?: ActionRouteParams, userForTesting?: User)
        : Promise<NextResponse>
{
    const requestInterfaceDefinition = interfaceDefinition.pick({ request: true });
    const responseInterfaceDefinition = interfaceDefinition.pick({ response: true });

    try {
        const result =
            await distillAndValidateRequestParams(request, requestInterfaceDefinition, routeParams);
        if (!result.success) {
            return createResponse(500, {
                success: false,
                error: `The server was not able to validate the request. (${result.error.message})`,
            });
        }

        const responseHeaders = new Headers();
        const response = await action((result.data as any).request, {
            ip: request.ip ?? request.headers.get('x-forwarded-for') ?? undefined,
            origin: request.nextUrl.origin,
            requestHeaders: request.headers,
            responseHeaders,
            user: userForTesting ?? await getUserFromHeaders(request.headers),
        });

        const responseValidation = responseInterfaceDefinition.safeParse({ response });
        if (responseValidation.success) {
            const nextResponse = createResponse(200, (responseValidation.data as any).response);
            for (const [ name, value ] of responseHeaders)
                nextResponse.headers.append(name, value);

            return nextResponse;
        }

        const issues = [];
        for (const { message, path } of responseValidation.error.issues)
            issues.push(`(${path.join('/')}): ${message}`);

        throw new Error(`Action response validation failed (${issues})`);

    } catch (error: any) {
        if (error instanceof NoAccessError)
            return createResponse(403, { success: false });

        if (!process.env.JEST_WORKER_ID)
            console.error(`Action(${request.nextUrl.pathname}) threw an Exception:`, error);

        return createResponse(500, {
            success: false,
            error: `The server was not able to handle the request: ${error.message}`,
        });
    }
}

/**
 * Aborts execution of the rest of the Action, and completes the API call with an HTTP 403 Forbidden
 * response instead.
 */
export function noAccess(): never {
    throw new NoAccessError;
}
