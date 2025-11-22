// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { PromptParser } from './PromptParser';

describe('PromptParser', () => {
    it('should reject invalid input', () => {
        expect(() => PromptParser.compile(undefined as unknown as string)).toThrow();
        expect(() => PromptParser.compile(null as unknown as string)).toThrow();
        expect(() => PromptParser.compile(3.1415 as unknown as string)).toThrow();
        expect(() => PromptParser.compile({ value: true } as unknown as string)).toThrow();
        expect(() => PromptParser.compile([ 'hello' ] as unknown as string)).toThrow();
    });
    it('should be able to deal with simple strings', () => {
        {
            const parser = PromptParser.compile(/* empty= */ '');
            expect(parser.ok).toBeTrue();

            expect(parser.parameters).toBeArrayOfSize(0);
            expect(parser.evaluate()).toBe('');
        }
        {
            const parser = PromptParser.compile('Hello, world!');
            expect(parser.ok).toBeTrue();

            expect(parser.parameters).toBeArrayOfSize(0);
            expect(parser.evaluate()).toBe('Hello, world!');
        }
    });

    it('should be able to identify substitution parameters', () => {
        {
            const parser = PromptParser.compile('Hello, {{world}}');
            expect(parser.ok).toBeTrue();

            expect(parser.errors).toBeArrayOfSize(0);

            expect(parser.parameters).toBeArrayOfSize(1);
            expect(parser.parameters[0]).toBe('world');
        }
        {
            const parser = PromptParser.compile('Hello, {{world}} & {{world}}');
            expect(parser.ok).toBeTrue();

            expect(parser.errors).toBeArrayOfSize(0);

            expect(parser.parameters).toBeArrayOfSize(1);
            expect(parser.parameters[0]).toBe('world');
        }
        {
            const parser = PromptParser.compile('Hello, {{world}} & {{planet}}');
            expect(parser.ok).toBeTrue();

            expect(parser.errors).toBeArrayOfSize(0);

            expect(parser.parameters).toBeArrayOfSize(2);
            expect(parser.parameters[0]).toBe('planet');
            expect(parser.parameters[1]).toBe('world');
        }
    });

    it('should be able to detect compilation issues regarding substitution parameters', () => {
        {
            const parser = PromptParser.compile('Hello, {{');
            expect(parser.ok).toBeFalse();

            expect(parser.errors).toBeArrayOfSize(1);
            expect(parser.errors[0]).toBe('Missing parameter closing token ("}}") at index 7');

            expect(parser.parameters).toBeArrayOfSize(0);
        }
        {
            const parser = PromptParser.compile('Hello, {{}}');
            expect(parser.ok).toBeFalse();

            expect(parser.errors).toBeArrayOfSize(1);
            expect(parser.errors[0]).toBe('Missing parameter name at index 9');

            expect(parser.parameters).toBeArrayOfSize(0);
        }
        {
            const parser = PromptParser.compile('Hello, {{]]}}');
            expect(parser.ok).toBeFalse();

            expect(parser.parameters).toBeArrayOfSize(0);

            expect(parser.errors).toBeArrayOfSize(1);
            expect(parser.errors[0]).toBe('Invalid parameter name ("]]") at index 9');

            expect(parser.parameters).toBeArrayOfSize(0);
        }
        {
            const parser = PromptParser.compile('Hello, {{1}} {{2}}');
            expect(parser.ok).toBeFalse();

            expect(parser.parameters).toBeArrayOfSize(0);

            expect(parser.errors).toBeArrayOfSize(2);
            expect(parser.errors[0]).toBe('Invalid parameter name ("1") at index 9');
            expect(parser.errors[1]).toBe('Invalid parameter name ("2") at index 15');

            expect(parser.parameters).toBeArrayOfSize(0);
        }
    });

    it('should be able to replace substitution parameters', () => {
        {
            const parser = PromptParser.compile('Hello, {{name}}!');
            expect(parser.ok).toBeTrue();

            expect(parser.parameters).toBeArrayOfSize(1);
            expect(parser.parameters[0]).toBe('name');

            expect(parser.evaluate({ name: 'World' })).toBe('Hello, World!');
        }
        {
            const parser = PromptParser.compile('Hello, {{person.name}}!');
            expect(parser.ok).toBeTrue();

            expect(parser.parameters).toBeArrayOfSize(1);
            expect(parser.parameters[0]).toBe('person.name');

            expect(parser.evaluate({ person: { name: 'John' } })).toBe('Hello, John!');
        }
    });

    it('should be able to replace substitution parameters that are not provided', () => {
        {
            const parser = PromptParser.compile('Hello, {{name}}!');
            expect(parser.ok).toBeTrue();

            expect(parser.parameters).toBeArrayOfSize(1);
            expect(parser.parameters[0]).toBe('name');

            expect(parser.evaluate({ /* no name */ })).toBe('Hello, [undefined]!');
        }
        {
            const parser = PromptParser.compile('Hello, {{person.name}}!');
            expect(parser.ok).toBeTrue();

            expect(parser.parameters).toBeArrayOfSize(1);
            expect(parser.parameters[0]).toBe('person.name');

            expect(parser.evaluate({ person: { /* no name */ } })).toBe('Hello, [undefined]!');
        }
    });

    it('should be able to replace substitution parameters that resolve to an object', () => {
        const parser = PromptParser.compile('Hello, {{person}}!');
        expect(parser.ok).toBeTrue();

        expect(parser.parameters).toBeArrayOfSize(1);
        expect(parser.parameters[0]).toBe('person');

        expect(parser.evaluate({ person: { /* no properties */ } })).toBe('Hello, [object]!');
    });

    it('should be able to deal with binary conditionals', () => {
        // todo
    });

    it('should be able to deal with if-else statements', () => {
        // todo
    });

    it('should be able to recognise and reject on invalid directives', () => {
        // todo
    });
});
