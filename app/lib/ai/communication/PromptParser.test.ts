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
        // todo
    });

    it('should be able to replace substitution parameters', () => {
        // todo
    });

    it('should be able to replace substitution parameters that are not provided', () => {
        // todo
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
