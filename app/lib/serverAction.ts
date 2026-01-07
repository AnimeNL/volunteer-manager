// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { headers } from 'next/headers';
import { unauthorized } from 'next/navigation';

import type { ZodError, ZodObject, ZodRawShape, z } from 'zod/v4';
import type { $ZodArrayDef, $ZodNullableDef, $ZodOptionalDef, $ZodPipeDef, $ZodTypeDef } from 'zod/v4/core';

import type { User } from './auth/User';
import { AccessControl } from './auth/AccessControl';
import { RecordErrorLog } from './Log';
import { getAuthenticationContextFromHeaders, type AuthenticationContext }
    from './auth/AuthenticationContext';

import { kAuthType } from './database/Types';

/**
 * Type description for the information available regarding the signed in user, if any.
 */
type ServerActionUserProp<AllowVisitors extends boolean> =
    AllowVisitors extends false ? {
        /**
         * User descriptor when the visitor is signed in to an account.
         */
        user: User;
    } : {
        /**
         * User descriptor for the signed in to account.
         */
        user?: User;
    };

/**
 * Type definition for the props that will be made available to a server action implementation.
 */
type ServerActionProps<AllowVisitors extends boolean> = ServerActionUserProp<AllowVisitors> & {
    /**
     * Access control management for this user. Lives off the `authenticationContext`, but pulled to
     * the top-level as it's an object that will frequently be accessed.
     */
    access: AccessControl,

    /**
     * Authentication context describing the permissions of the visitor.
     */
    authenticationContext: AuthenticationContext;

    /**
     * Host that the request is targetted towards.
     */
    host?: string;

    /**
     * IP address of the source of the request.
     */
    ip?: string;
};

/**
 * Type definition that represents the result of a React server action function.
 */
export type ServerActionResult = {
    /**
     * Boolean indicating whether the server action was processed successfully.
     */
    success: true,

    /**
     * Whether the form that the action is serving, if any, should be cleared of any and all values.
     */
    clear?: boolean;

    /**
     * Optional message that can be presented to the user.
     */
    message?: string;

    /**
     * URL that the user should be redirected to now that this action has succeeded.
     */
    redirect?: string;

    /**
     * Whether the page, and its entire state, should be refreshed.
     */
    refresh?: boolean;

    /**
     * Arbitrary data that should be carried as part of the server action. Will not be consumed by
     * the `<FormProvider>` component & friends, but may be consumed by manual usage.
     */
    [key: string]: any;

} | {
    /**
     * Boolean indicating whether the server action was processed successfully.
     */
    success: false,

    /**
     * Optional error message that explains what went wrong.
     */
    error?: string;
};

/**
 * Type definition that represents a plain React server action.
 */
export type ServerAction = (formData: unknown) => Promise<ServerActionResult>;

/**
 * Type definition that represents a partial ServerAction, i.e. one to which other parameters still
 * have to be bound.
 */
export type PartialServerAction<T> = (param: T, formData: unknown) => Promise<ServerActionResult>;

/**
 * Type definition that represents a React server action. When the action does not return any value
 * success will be assumed, whereas exceptions will be represented as a failure.
 */
export type ServerActionImplementation<T extends ZodObject<ZodRawShape>,
                                       AllowVisitors extends boolean> =
    (data: z.output<T>, props: ServerActionProps<AllowVisitors>) =>
        Promise<ServerActionResult | undefined | void>;

/**
 * Basic types that the `coerceZodType` function can coerce string values to.
 */
type ServerActionCoercedBasicTypes = File | boolean | null | number | string | undefined;

/**
 * Types that the `coerceZodType` function can coerce string values to.
 */
type ServerActionCoercedTypes = ServerActionCoercedBasicTypes | ServerActionCoercedBasicTypes[];

/**
 * Coerces the given `value` to either a boolean, a string when it has an invalid value, or the
 * `undefined` value when it is something unparseable such as a file.
 */
function coerceZodBoolean(value: FormDataEntryValue): FormDataEntryValue | boolean {
    switch (value) {
        case 'on':  // checkboxes
        case 'true':
            return true;

        case 'off':  // for consistency with checkboxes
        case 'false':
            return false;
    }

    return value;
}

/**
 * Coerces the given `value` to the type represented by the given `def`, which is a Zod type
 * definition. The `typeName` field is not included in the base definition, but always exists.
 */
function coerceZodType(def: $ZodTypeDef, values: FormDataEntryValue[]): ServerActionCoercedTypes {
    do {
        if (def.type === 'nullable') {
            if (!!values.length && (values[0] === null || values[0] === 'null'))
                return null;

            const typedDef = def as $ZodNullableDef;
            def = typedDef.innerType._zod.def;
        }

        if (def.type === 'optional') {
            if (!values.length || (values[0] === undefined || values[0] === 'undefined'))
                return undefined;

            const typedDef = def as $ZodOptionalDef;
            def = typedDef.innerType._zod.def;
        }

        if (def.type === 'pipe') {
            const typedDef = def as $ZodPipeDef;
            def = typedDef.in._zod.def;
        }

    } while (def.type === 'nullable' || def.type === 'optional' || def.type === 'pipe');

    switch (def.type) {
        case 'array': {
            const typedDef = def as $ZodArrayDef;
            return values.map(value =>
                coerceZodType(typedDef.element._zod.def, [ value ])) as any[];
        }
        case 'boolean':
            return coerceZodBoolean(values[0]);

        default:
            break;
    }

    return values[0];
}

/**
 * Coerces the given `formData` into an object that roughly corresponds to the `scheme` without
 * invoking processing and transformation functions. This allows certain types such as arrays,
 * booleans and numbers to work as expected.
 */
function coerceFormData<T extends ZodObject<ZodRawShape>>(scheme: T, formData: FormData) {
    const unvalidatedData: Record<string, ServerActionCoercedTypes> = { /* empty */ };
    for (const key of formData.keys()) {
        const values = formData.getAll(key);
        if (Object.hasOwn(scheme.shape, key)) {
            if (values.length > 0)
                unvalidatedData[key] = coerceZodType(scheme.shape[key]._zod.def, values);
            else
                unvalidatedData[key] = undefined;

        } else if (values.length >= 1 && typeof values[0] === 'string') {
            // Only string values are supported as arbitrary key/value pass-through.
            unvalidatedData[key] = values[0];
        }
    }

    return unvalidatedData;
}

/**
 * Function that takes a Zod-created `error` and formats it into a single string, that's slightly
 * more user readable than the `error`'s own message.
 */
export function formatZodError(error: ZodError): string {
    const errors: string[] = [];
    for (const issue of error.issues)
        errors.push(`Field ${issue.path.join('.')}: ${issue.message}`);

    return errors.join('; ');
}

/**
 * Executes the server action implemented in the given `action`, ensuring consistent input (the
 * given `formData`, either a `FormData` instance or a POD object) and output across our system. The
 * input will be strongly validated, and the user will be authenticated.
 *
 * Authentication users are required, unless the `allowVisitor` argument is set to `true`.
 *
 * This function must only be called in asynchronous functions that have a 'use server' declaration
 * as the first statement in their body, per the rules of React's Server Actions. Furthermore, React
 * takes care of version skew and common attack types, which we build upon with further validation.
 */
export async function executeServerAction<T extends ZodObject<ZodRawShape>,
                                          AllowVisitors extends boolean = false>(
    formData: unknown, scheme: T, action: ServerActionImplementation<T, AllowVisitors>,
    allowVisitors?: AllowVisitors, userForTesting?: User | null)
        : Promise<ServerActionResult>
{
    let authenticationContext: AuthenticationContext | undefined;

    try {
        // -----------------------------------------------------------------------------------------
        // (1) Validate the input data for the incoming action
        // -----------------------------------------------------------------------------------------

        let unverifiedData: unknown;
        if (formData instanceof FormData)
            unverifiedData = coerceFormData(scheme, formData);
        else if (!!formData && typeof formData === 'object')
            unverifiedData = formData;
        else
            return { success: false, error: 'Invalid data received from Next.js' };

        const data = scheme.safeParse(unverifiedData);
        if (!data.success) {
            RecordErrorLog({
                error: data.error,
                requestUrl: undefined,  // not known for server actions
                user: undefined,
            });

            return {
                success: false,
                error: formatZodError(data.error)
            };
        }

        // -----------------------------------------------------------------------------------------
        // (2) Compose the request properties part of this action. The behaviour of this section
        // depends on whether a test is being executed, in which case we don't want to cause either
        // Next.js state access or database access directly.
        // -----------------------------------------------------------------------------------------

        const requestHeaders = userForTesting !== undefined ? new Headers : await headers();

        authenticationContext =
            userForTesting ?
                {
                    access: new AccessControl({ /* todo? */ }),
                    authType: kAuthType.password,
                    events: new Map,
                    user: userForTesting

                } : await getAuthenticationContextFromHeaders(requestHeaders);

        if (!allowVisitors && !authenticationContext.user)
            unauthorized();

        const props: ServerActionProps<AllowVisitors> = {
            access: authenticationContext.access,
            authenticationContext,
            host: requestHeaders.get('host') ?? 'animecon.team',
            ip: requestHeaders.get('x-forwarded-for') ?? undefined,
            user: authenticationContext.user!,
        };

        // -----------------------------------------------------------------------------------------
        // (3) Execute the actual server action with all validated and gathered data
        // -----------------------------------------------------------------------------------------

        const result = await action(data.data, props);
        if (typeof result === 'object')
            return result;

        return { success: true };

    } catch (error: any) {
        RecordErrorLog({
            error,
            requestUrl: undefined,  // not known for server actions
            user: authenticationContext?.user,
        });

        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
