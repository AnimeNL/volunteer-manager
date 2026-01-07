// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z, type ZodObject, type ZodRawShape } from 'zod/v4';

import type { User } from './auth/User';
import { SetRecordErrorLogDeferDelegate } from './Log';
import { executeServerAction, type ServerActionImplementation } from './serverAction';

describe('serverAction', () => {
    function toFormData(data: Record<string, any>) {
        const formData = new FormData;
        for (const [ key, value ] of Object.entries(data)) {
            if (Array.isArray(value)) {
                for (const v of value)
                    formData.append(key, v);
            } else {
                formData.set(key, value);
            }
        }

        return formData;
    }

    // Wrapper function around `executeServerAction` that encapsulates the necessary information in
    // an asynchronous closure, that can be invoked multiple times for testing purposes.
    function serverAction<T extends ZodObject<ZodRawShape>>(
        scheme: T, action: ServerActionImplementation<T, false>)
    {
        const user: User = {
            id: 101,
            firstName: 'John',
            lastName: 'Doe',
            name: 'John Doe',
            nameOrFirstName: 'John',
        };

        return async (formData: unknown) =>
            executeServerAction(formData, scheme, action, /* allowVisitor= */ undefined, user);
    }

    let errorLogDelegateInvoked: boolean = false;

    beforeEach(() => {
        errorLogDelegateInvoked = false;
        SetRecordErrorLogDeferDelegate(async () => { errorLogDelegateInvoked = true });
    });

    afterEach(() => SetRecordErrorLogDeferDelegate(/* default= */ undefined));

    it('should reject invalid form data types', async () => {
        let invocations = 0;

        const scheme = z.object({ /* empty */ });
        const action = serverAction(scheme, async () => { ++invocations; });

        {
            const result = await action(/* formData= */ undefined as any);
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);

            !result.success && expect(result.error).toBe('Invalid data received from Next.js');
        }
        {
            const result = await action(/* formData= */ null as any);
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);

            !result.success && expect(result.error).toBe('Invalid data received from Next.js');
        }
        {
            const result = await action(/* formData= */ {} as any);
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(1);
        }
        {
            const result = await action(/* formData= */ new FormData);
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(2);
        }
    });

    it('should reject form data with missing fields', async () => {
        let invocations = 0;

        const scheme = z.object({
            a: z.coerce.number(),
            b: z.coerce.number(),
        });

        const action = serverAction(scheme, async () => { ++invocations; });

        {
            const result = await action(toFormData({ a: 42 }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);

            !result.success && expect(result.error).toBe(
                'Field b: Invalid input: expected number, received NaN');
        }
        {
            const result = await action(toFormData({ b: 101 }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);

            !result.success && expect(result.error).toBe(
                'Field a: Invalid input: expected number, received NaN');
        }
        {
            const result = await action(toFormData({ a: 42, b: 101 }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(1);
        }
    });

    it('should reject form data with fields having invalid types', async () => {
        let invocations = 0;

        const scheme = z.object({
            a: z.coerce.number(),
            b: z.boolean(),
        });

        const action = serverAction(scheme, async () => { ++invocations; });

        {
            const result = await action(toFormData({ a: 42, b: 121 }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);

            !result.success && expect(result.error).toBe(
                'Field b: Invalid input: expected boolean, received string');
        }
        {
            const result = await action(toFormData({ a: '42', b: 121 }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);

            !result.success && expect(result.error).toBe(
                'Field b: Invalid input: expected boolean, received string');
        }
        {
            const result = await action(toFormData({ a: 42, b: true }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(1);
        }
    });

    it('should be able to coerce arrays from FormData input', async () => {
        let a: number[] | undefined;
        let invocations = 0;

        const scheme = z.object({
            a: z.array(z.coerce.number()),
        });

        const action = serverAction(scheme, async (data) => { a = data.a; ++invocations; });

        {
            const result = await action(toFormData({ a: 'banana' }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);

            !result.success && expect(result.error).toBe(
                'Field a.0: Invalid input: expected number, received NaN');
        }
        {
            const result = await action(toFormData({ a: false }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);

            !result.success && expect(result.error).toBe(
                'Field a.0: Invalid input: expected number, received NaN');
        }
        {
            const result = await action(toFormData({ a: [ 'banana' ] }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);

            !result.success && expect(result.error).toBe(
                'Field a.0: Invalid input: expected number, received NaN');
        }
        {
            const result = await action(toFormData({ a: [ 42, 'banana' ] }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);

            !result.success && expect(result.error).toBe(
                'Field a.1: Invalid input: expected number, received NaN');
        }
        {
            const result = await action(toFormData({ a: 42 }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(1);
            expect(a).toEqual([ 42 ]);
        }
        {
            const result = await action(toFormData({ a: [ 42 ] }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(2);
            expect(a).toEqual([ 42 ]);
        }
        {
            const result = await action(toFormData({ a: [ 42, 101 ] }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(3);
            expect(a).toEqual([ 42, 101 ]);
        }
    });

    it('should be able to coerce booleans from FormData input', async () => {
        let a: boolean | undefined;
        let invocations = 0;

        const scheme = z.object({
            a: z.boolean(),
        });

        const action = serverAction(scheme, async (data) => { a = data.a; ++invocations; });

        {
            const result = await action(toFormData({ a: 42 }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);

            !result.success && expect(result.error).toBe(
                'Field a: Invalid input: expected boolean, received string');
        }
        {
            const result = await action(toFormData({ /* missing property */ }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);

            !result.success && expect(result.error).toBe(
                'Field a: Invalid input: expected boolean, received undefined');
        }
        {
            const result = await action(toFormData({ a: { /* object */ } }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);

            !result.success && expect(result.error).toBe(
                'Field a: Invalid input: expected boolean, received string');
        }
        {
            const result = await action(toFormData({ a: undefined }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);

            !result.success && expect(result.error).toBe(
                'Field a: Invalid input: expected boolean, received string');
        }
        {
            const result = await action(toFormData({ a: null }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);

            !result.success && expect(result.error).toBe(
                'Field a: Invalid input: expected boolean, received string');
        }
        {
            const result = await action(toFormData({ a: 'on' }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(1);
            expect(a).toBeTruthy();
        }
        {
            const result = await action(toFormData({ a: 'true' }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(2);
            expect(a).toBeTruthy();
        }
        {
            const result = await action(toFormData({ a: /* "true"= */ true }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(3);
            expect(a).toBeTruthy();
        }
        {
            const result = await action(toFormData({ a: 'off' }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(4);
            expect(a).toBeFalsy();
        }
        {
            const result = await action(toFormData({ a: 'false' }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(5);
            expect(a).toBeFalsy();
        }
        {
            const result = await action(toFormData({ a: false }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(6);
            expect(a).toBeFalsy();
        }
    });

    it('should be able to deal with nullable and optional values', async () => {
        let invocations = 0;
        let value: any = undefined;

        const nullableScheme = z.object({ a: z.boolean().nullable() });
        const nullableAction = serverAction(nullableScheme, async (data) => {
            value = data.a;
            ++invocations;
        });

        {
            const result = await nullableAction(toFormData({ /* missing property */ }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);
            expect(value).toBeUndefined();
        }
        {
            const result = await nullableAction(toFormData({ a: undefined }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);
            expect(value).toBeUndefined();
        }
        {
            const result = await nullableAction(toFormData({ a: 'bananas' }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);
            expect(value).toBeUndefined();
        }
        {
            const result = await nullableAction(toFormData({ a: null }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(1);
            expect(value).toBeNull();
        }
        {
            const result = await nullableAction(toFormData({ a: false }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(2);
            expect(value).toBeFalsy();
        }

        const nullishScheme = z.object({ a: z.boolean().nullish() });
        const nullishAction = serverAction(nullishScheme, async (data) => {
            value = data.a;
            ++invocations;
        });

        value = undefined;

        {
            const result = await nullishAction(toFormData({ /* missing property */ }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(3);
            expect(value).toBeUndefined();
        }
        {
            const result = await nullishAction(toFormData({ a: undefined }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(4);
            expect(value).toBeUndefined();
        }
        {
            const result = await nullishAction(toFormData({ a: 'bananas' }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(4);
            expect(value).toBeUndefined();
        }
        {
            const result = await nullishAction(toFormData({ a: null }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(5);
            expect(value).toBeNull();
        }
        {
            const result = await nullishAction(toFormData({ a: false }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(6);
            expect(value).toBeFalsy();
        }

        const optionalScheme = z.object({ a: z.boolean().optional() });
        const optionalAction = serverAction(optionalScheme, async (data) => {
            value = data.a;
            ++invocations;
        });

        value = undefined;

        {
            const result = await optionalAction(toFormData({ /* missing property */ }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(7);
            expect(value).toBeUndefined();
        }
        {
            const result = await optionalAction(toFormData({ a: undefined }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(8);
            expect(value).toBeUndefined();
        }
        {
            const result = await optionalAction(toFormData({ a: 'bananas' }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(8);
            expect(value).toBeUndefined();
        }
        {
            const result = await optionalAction(toFormData({ a: null }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(8);
            expect(value).toBeUndefined();
        }
        {
            const result = await optionalAction(toFormData({ a: false }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(9);
            expect(value).toBeFalsy();
        }

        const arrayScheme = z.object({ a: z.array(z.coerce.number()).nullish() });
        const arrayAction = serverAction(arrayScheme, async (data) => {
            value = data.a;
            ++invocations;
        });

        value = undefined;

        {
            const result = await arrayAction(toFormData({ /* missing property */ }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(10);
            expect(value).toBeUndefined();
        }
        {
            const result = await arrayAction(toFormData({ a: undefined }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(11);
            expect(value).toBeUndefined();
        }
        {
            const result = await arrayAction(toFormData({ a: '15' }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(12);
            expect(value).toEqual([ 15 ]);
        }
        {
            const result = await arrayAction(toFormData({ a: null }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(13);
            expect(value).toBeNull();
        }
        {
            const result = await arrayAction(toFormData({ a: [ '15', '42' ] }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(14);
            expect(value).toEqual([ 15, 42 ]);
        }
        {
            const result = await arrayAction(toFormData({ a: [ '15', null, '42' ] }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(14);
        }

        const nullArrayScheme = z.object({ a: z.array(z.coerce.number().nullish()) });
        const nullArrayAction = serverAction(nullArrayScheme, async (data) => {
            value = data.a;
            ++invocations;
        });

        value = undefined;

        {
            const result = await nullArrayAction(toFormData({ /* missing property */ }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(14);
            expect(value).toBeUndefined();
        }
        {
            const result = await nullArrayAction(toFormData({ a: undefined }));
            expect(result.success).toBeTruthy();  // single values are automatically array-ified
            expect(invocations).toBe(15);
            expect(value).toEqual([ undefined ]);
        }
        {
            const result = await nullArrayAction(toFormData({ a: '15' }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(16);
            expect(value).toEqual([ 15 ]);
        }
        {
            const result = await nullArrayAction(toFormData({ a: 'banana' }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(16);
        }
        {
            const result = await nullArrayAction(toFormData({ a: null }));
            expect(result.success).toBeTruthy();  // single values are automatically array-ified
            expect(invocations).toBe(17);
            expect(value).toEqual([ null ]);
        }
        {
            const result = await nullArrayAction(toFormData({ a: [ '15', '42' ] }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(18);
            expect(value).toEqual([ 15, 42 ]);
        }
        {
            const result = await nullArrayAction(toFormData({ a: [ '15', null, '42' ] }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(19);
            expect(value).toEqual([ 15, null, 42 ]);
        }
    });

    it('should be able to use Zod custom error messages', async () => {
        let invocations = 0;

        const scheme = z.object({
            a: z.coerce.number({
                error: issue => issue.input === undefined
                    ? 'Value must be provided'
                    : 'Value must be a number',
            })
            .min(10, { message: 'Value must be ten or more' })
            .max(20, { message: 'Value must be twenty or less' })
        });

        const action = serverAction(scheme, async (data) => { ++invocations; });

        {
            const result = await action(toFormData({ /* missing property */ }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);

            !result.success &&
                expect(result.error).toBe('Field a: Value must be a number');
        }
        {
            const result = await action(toFormData({ a: 'bananas' }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);

            !result.success &&
                expect(result.error).toBe('Field a: Value must be a number');
        }
        {
            const result = await action(toFormData({ a: '5' }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);

            !result.success &&
                expect(result.error).toBe('Field a: Value must be ten or more');
        }
        {
            const result = await action(toFormData({ a: '25' }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);

            !result.success &&
                expect(result.error).toBe('Field a: Value must be twenty or less');
        }
        {
            const result = await action(toFormData({ a: '15' }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(1);
        }
    });

    it('should be able to transform the input/output using Zod', async () => {
        let value: any;
        let invocations = 0;

        const sameTypeScheme = z.object({
            a: z.coerce.number().transform(v => v * 2),
        });

        const sameTypeAction =
            serverAction(sameTypeScheme, async (data) => { value = data.a; ++invocations; });

        {
            const result = await sameTypeAction(toFormData({ a: '15' }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(1);
            expect(value).toBe(30);
        }
        {
            const result = await sameTypeAction(toFormData({ a: 'banana' }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(1);
        }

        const differentTypeScheme = z.object({
            a: z.boolean().transform(v => !!v ? 'yay' : 'nay'),
        });

        const differentTypeAction =
            serverAction(differentTypeScheme, async (data) => { value = data.a; ++invocations; });

        {
            const result = await differentTypeAction(toFormData({ a: undefined }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(1);
        }
        {
            const result = await differentTypeAction(toFormData({ a: true }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(2);
            expect(value).toBe('yay');
        }
        {
            const result = await differentTypeAction(toFormData({ a: false }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(3);
            expect(value).toBe('nay');
        }
        {
            const result = await differentTypeAction(toFormData({ a: 'banana' }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(3);
        }
    });

    it('should fail invocations where an exception is thrown', async () => {
        const schema = z.object({ a: z.coerce.number() });
        const action = serverAction(schema, async (data) => {
            if (data.a === 42)
                throw new Error('This is an Error exception');
            if (data.a === 101)
                throw 'This is a string exception';
        });

        {
            const result = await action(toFormData({ a: 32 }));
            expect(result.success).toBeTruthy();
        }
        {
            const result = await action(toFormData({ a: /* Error exception= */ 42 }));
            expect(result.success).toBeFalsy();
            !result.success && expect(result.error).toBe('This is an Error exception');
        }
        {
            const result = await action(toFormData({ a: /* string exception= */ 101 }));
            expect(result.success).toBeFalsy();
            !result.success && expect(result.error).toBe('This is a string exception');
        }
    });

    it('should fail when the action manually invokes failure', async () => {
        const schema = z.object({ /* no properties */ });
        const action = serverAction(schema, async (data) => {
            return { success: false, error: 'Not yet implemented' };
        });

        const result = await action(toFormData({ /* no properties */ }));
        expect(result.success).toBeFalsy();
        !result.success && expect(result.error).toBe('Not yet implemented');
    });

    it('should succeed when the action manually invokes success', async () => {
        const schema = z.object({ /* no properties */ });
        const action = serverAction(schema, async (data) => {
            return { success: true };
        });

        const result = await action(toFormData({ /* no properties */ }));
        expect(result.success).toBeTruthy();
    });

    it('should succeed when the action manually returns additional data', async () => {
        const schema = z.object({ /* no properties */ });
        const action = serverAction(schema, async (data) => {
            return {
                success: true,
                value: 42,
            };
        });

        const result = await action(toFormData({ /* no properties */ })) as any;
        expect(result.success).toBeTruthy();
        expect(result.value).toBe(42);
    });

    it('should represent uploaded files as File instances', async () => {
        let value: any;
        let invocations = 0;

        const data = new ArrayBuffer(/* byteLength= */ 8);
        const dataUint32 = new Uint32Array(data);
        dataUint32[0] = 1048576;
        dataUint32[1] = 2097152;

        const scheme = z.object({ a: z.instanceof(Blob) });
        const action = serverAction(scheme, async (data) => { value = data.a; ++invocations; });

        {
            const result = await action(toFormData({ /* missing property */ }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);
        }
        {
            const result = await action(toFormData({ a: undefined }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);
        }
        {
            const result = await action(toFormData({ a: null }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);
        }
        {
            const result = await action(toFormData({ a: 'filez' }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(0);
        }
        {
            const result = await action(toFormData({
                a: new Blob([ data ], { type: 'image/png' })
            }));

            expect(result.success).toBeTruthy();
            expect(invocations).toBe(1);
            expect(value).toBeInstanceOf(Blob);
            expect(value.size).toBe(8);
            expect(value.type).toBe('image/png');
        }
        {
            const result = await action(toFormData({
                a: new File([ data ], 'myfile.jpg', { type: 'image/jpg' })
            }));

            expect(result.success).toBeTruthy();
            expect(invocations).toBe(2);
            expect(value).toBeInstanceOf(Blob);
            expect(value.size).toBe(8);
            expect(value.type).toBe('image/jpg');
        }

        const nullableScheme = z.object({ a: z.instanceof(Blob).nullable() });
        const nullableAction =
            serverAction(nullableScheme, async (data) => { value = data.a; ++invocations; });

        {
            const result = await nullableAction(toFormData({ /* missing property */ }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(2);
        }
        {
            const result = await nullableAction(toFormData({ a: undefined }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(2);
        }
        {
            const result = await nullableAction(toFormData({ a: null }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(3);
            expect(value).toBeNull();
        }
        {
            const result = await nullableAction(toFormData({ a: 'filez' }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(3);
        }
        {
            const result = await nullableAction(toFormData({
                a: new Blob([ data ], { type: 'image/png' })
            }));

            expect(result.success).toBeTruthy();
            expect(invocations).toBe(4);
            expect(value).toBeInstanceOf(Blob);
            expect(value.size).toBe(8);
            expect(value.type).toBe('image/png');
        }
        {
            const result = await nullableAction(toFormData({
                a: new File([ data ], 'myfile.jpg', { type: 'image/jpg' })
            }));

            expect(result.success).toBeTruthy();
            expect(invocations).toBe(5);
            expect(value).toBeInstanceOf(Blob);
            expect(value.size).toBe(8);
            expect(value.type).toBe('image/jpg');
        }

        const optionalScheme = z.object({ a: z.instanceof(Blob).optional() });
        const optionalAction =
            serverAction(optionalScheme, async (data) => { value = data.a; ++invocations; });

        {
            const result = await optionalAction(toFormData({ /* missing property */ }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(6);
            expect(value).toBeUndefined();
        }
        {
            const result = await optionalAction(toFormData({ a: undefined }));
            expect(result.success).toBeTruthy();
            expect(invocations).toBe(7);
            expect(value).toBeUndefined();
        }
        {
            const result = await optionalAction(toFormData({ a: null }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(7);
        }
        {
            const result = await optionalAction(toFormData({ a: 'filez' }));
            expect(result.success).toBeFalsy();
            expect(invocations).toBe(7);
        }
        {
            const result = await optionalAction(toFormData({
                a: new Blob([ data ], { type: 'image/png' })
            }));

            expect(result.success).toBeTruthy();
            expect(invocations).toBe(8);
            expect(value).toBeInstanceOf(Blob);
            expect(value.size).toBe(8);
            expect(value.type).toBe('image/png');
        }
        {
            const result = await optionalAction(toFormData({
                a: new File([ data ], 'myfile.jpg', { type: 'image/jpg' })
            }));

            expect(result.success).toBeTruthy();
            expect(invocations).toBe(9);
            expect(value).toBeInstanceOf(Blob);
            expect(value.size).toBe(8);
            expect(value.type).toBe('image/jpg');
        }
    });

    it('logs exceptions thrown during input validation in the database', async () => {
        const scheme = z.object({
            a: z.boolean(),
        });

        let invocations = 0;

        const action = serverAction(scheme, async (data) => { ++invocations; });

        // Step 0: Validate preconditions
        expect(errorLogDelegateInvoked).toBeFalsy();

        // Step 1: Execute the Server Action and verify the input could not be validated
        const result = await action(toFormData({ a: 42 }));
        expect(result.success).toBeFalsy();
        expect(result.error).toContain('Invalid input: expected boolean, received string');

        expect(invocations).toBe(0);

        // Step 2: Validate that a database query was issued by the Server Action runner
        expect(errorLogDelegateInvoked).toBeTruthy();
    });

    it('logs access exceptions for unidentified users in the database', async () => {
        const scheme = z.object({ /* no data */ });

        let invocations = 0;

        const action = async (formData: unknown) =>
            executeServerAction(formData, scheme, async (data) => { ++invocations; }, false, null);

        // Step 0: Validate preconditions
        expect(errorLogDelegateInvoked).toBeFalsy();

        // Step 1: Execute the Server Action and verify the input could not be validated
        const result = await action(new FormData);
        expect(result.success).toBeFalsy();
        expect(result.error).toContain('NEXT_HTTP_ERROR_FALLBACK;401');

        expect(invocations).toBe(0);

        // Step 2: Validate that a database query was issued by the Server Action runner
        expect(errorLogDelegateInvoked).toBeTruthy();
    });

    it('logs exceptions thrown in server actions in the database', async () => {
        const scheme = z.object({ /* no data */ });

        const action = serverAction(scheme, async (data) => {
            throw new Error('Something went wrong')
        });

        // Step 0: Validate preconditions
        expect(errorLogDelegateInvoked).toBeFalsy();

        // Step 1: Execute the Server Action and verify the input could not be validated
        const result = await action(new FormData);
        expect(result.success).toBeFalsy();
        expect(result.error).toContain('Something went wrong');

        // Step 2: Validate that a database query was issued by the Server Action runner
        expect(errorLogDelegateInvoked).toBeTruthy();
    });
});
