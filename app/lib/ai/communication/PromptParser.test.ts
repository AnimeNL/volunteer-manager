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
            const parser = PromptParser.compile('{{value}}');
            expect(parser.ok).toBeTrue();

            expect(parser.parameters).toBeArrayOfSize(1);
            expect(parser.parameters[0]).toBe('value');

            expect(parser.evaluate({ value: 42 })).toBe('42');
        }
        {
            const parser = PromptParser.compile('{{value}}{{value}}');
            expect(parser.ok).toBeTrue();

            expect(parser.parameters).toBeArrayOfSize(1);
            expect(parser.parameters[0]).toBe('value');

            expect(parser.evaluate({ value: 9001 })).toBe('90019001');
        }
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
        const parser = PromptParser.compile('Today is [[if warm]]great[[else]]ok[[/if]]!');
        expect(parser.ok).toBeTrue();

        // Present and true
        expect(parser.evaluate({ warm: true })).toBe('Today is great!');

        // Present and truthy
        expect(parser.evaluate({ warm: 'foobar' })).toBe('Today is great!');

        // Present and falsy
        expect(parser.evaluate({ warm: false })).toBe('Today is ok!');

        // Missing, thus falsy
        expect(parser.evaluate({ /* no `warm` */ })).toBe('Today is ok!');
    });

    it('should be able to deal with nested binary conditionals', () => {
        const parser = PromptParser.compile(
            '[[if red]][[if yellow]]orange[[else]]red[[/if]][[else]][[if yellow]]yellow[[else]]' +
            'white[[/if]][[/if]]');
        expect(parser.ok).toBeTrue();

        expect(parser.evaluate({ /* no red */ yellow: true })).toBe('yellow');
        expect(parser.evaluate({ /* no red */ yellow: false })).toBe('white');
        expect(parser.evaluate({ /* no red & no yellow */ })).toBe('white');
        expect(parser.evaluate({ red: false, yellow: false })).toBe('white');
        expect(parser.evaluate({ red: false, yellow: true })).toBe('yellow');
        expect(parser.evaluate({ red: false /* no yellow */ })).toBe('white');
        expect(parser.evaluate({ red: true, yellow: false })).toBe('red');
        expect(parser.evaluate({ red: true, yellow: true })).toBe('orange');
        expect(parser.evaluate({ red: true /* no yellow */ })).toBe('red');
    });

    it('should be able to deal with basic comparison operator conditionals', () => {
        // -----------------------------------------------------------------------------------------
        // IMPLICIT EQUALITY
        // -----------------------------------------------------------------------------------------
        {
            const parser = PromptParser.compile('[[if value]]true[[else]]false[[/if]]');
            expect(parser.ok).toBeTrue();

            expect(parser.evaluate({ value: true })).toBe('true');
            expect(parser.evaluate({ value: false })).toBe('false');
            expect(parser.evaluate({ /* no value */ })).toBe('false');
            expect(parser.evaluate({ /* truthy= */ value: 15 })).toBe('true');
            expect(parser.evaluate({ /* truthy= */ value: 'text' })).toBe('true');
        }

        // -----------------------------------------------------------------------------------------
        // IMPLICIT NON-EQUALITY
        // -----------------------------------------------------------------------------------------
        {
            const parser = PromptParser.compile('[[if !value]]true[[else]]false[[/if]]');
            expect(parser.ok).toBeTrue();

            expect(parser.evaluate({ value: true })).toBe('false');
            expect(parser.evaluate({ value: false })).toBe('true');
            expect(parser.evaluate({ /* no value */ })).toBe('true');
            expect(parser.evaluate({ /* truthy= */ value: 15 })).toBe('false');
            expect(parser.evaluate({ /* truthy= */ value: 'text' })).toBe('false');
        }

        // -----------------------------------------------------------------------------------------
        // EQUALITY
        // -----------------------------------------------------------------------------------------
        {
            const parser = PromptParser.compile('[[if value == true]]true[[else]]false[[/if]]');
            expect(parser.ok).toBeTrue();

            expect(parser.evaluate({ value: true })).toBe('true');
            expect(parser.evaluate({ value: 'aye' })).toBe('true');

            expect(parser.evaluate({ value: false })).toBe('false');
            expect(parser.evaluate({ /* no value */ })).toBe('false');
        }
        {
            const parser = PromptParser.compile('[[if value == false]]true[[else]]false[[/if]]');
            expect(parser.ok).toBeTrue();

            expect(parser.evaluate({ value: true })).toBe('false');
            expect(parser.evaluate({ value: 'aye' })).toBe('false');

            expect(parser.evaluate({ value: false })).toBe('true');
            expect(parser.evaluate({ /* no value */ })).toBe('true');
        }
        {
            const parser = PromptParser.compile('[[if value == 25]]true[[else]]false[[/if]]');
            expect(parser.ok).toBeTrue();

            expect(parser.evaluate({ value: 25 })).toBe('true');
            expect(parser.evaluate({ value: '25' })).toBe('true');
            expect(parser.evaluate({ value: 14 })).toBe('false');
            expect(parser.evaluate({ value: '14' })).toBe('false');
        }
        {
            const parser = PromptParser.compile('[[if value == "text"]]true[[else]]false[[/if]]');
            expect(parser.ok).toBeTrue();

            expect(parser.evaluate({ value: 'text' })).toBe('true');
            expect(parser.evaluate({ value: 'other' })).toBe('false');
        }
        {
            const parser = PromptParser.compile('[[if value == \'text\']]true[[else]]false[[/if]]');
            expect(parser.ok).toBeTrue();

            expect(parser.evaluate({ value: 'text' })).toBe('true');
            expect(parser.evaluate({ value: 'other' })).toBe('false');
        }
        {
            const parser = PromptParser.compile('[[if "text" == "text"]]true[[else]]false[[/if]]');
            expect(parser.ok).toBeTrue();

            expect(parser.evaluate()).toBe('true');
        }
        {
            const parser = PromptParser.compile('[[if true == true]]true[[else]]false[[/if]]');
            expect(parser.ok).toBeTrue();

            expect(parser.evaluate()).toBe('true');
        }
        {
            const parser = PromptParser.compile('[[if value == value]]true[[else]]false[[/if]]');
            expect(parser.ok).toBeTrue();

            expect(parser.evaluate({ value: 25 })).toBe('true');
        }

        // -----------------------------------------------------------------------------------------
        // NON-EQUALITY
        // -----------------------------------------------------------------------------------------
        {
            const parser = PromptParser.compile('[[if value != true]]true[[else]]false[[/if]]');
            expect(parser.ok).toBeTrue();

            expect(parser.evaluate({ value: true })).toBe('false');
            expect(parser.evaluate({ value: 'aye' })).toBe('false');

            expect(parser.evaluate({ value: false })).toBe('true');
            expect(parser.evaluate({ /* no value */ })).toBe('true');
        }
        {
            const parser = PromptParser.compile('[[if value != false]]true[[else]]false[[/if]]');
            expect(parser.ok).toBeTrue();

            expect(parser.evaluate({ value: true })).toBe('true');
            expect(parser.evaluate({ value: 'aye' })).toBe('true');

            expect(parser.evaluate({ value: false })).toBe('false');
            expect(parser.evaluate({ /* no value */ })).toBe('false');
        }
        {
            const parser = PromptParser.compile('[[if value != 25]]true[[else]]false[[/if]]');
            expect(parser.ok).toBeTrue();

            expect(parser.evaluate({ value: 25 })).toBe('false');
            expect(parser.evaluate({ value: '25' })).toBe('false');
            expect(parser.evaluate({ value: 14 })).toBe('true');
            expect(parser.evaluate({ value: '14' })).toBe('true');
        }
        {
            const parser = PromptParser.compile('[[if value != "text"]]true[[else]]false[[/if]]');
            expect(parser.ok).toBeTrue();

            expect(parser.evaluate({ value: 'text' })).toBe('false');
            expect(parser.evaluate({ value: 'other' })).toBe('true');
        }
        {
            const parser = PromptParser.compile('[[if "text" != "text"]]true[[else]]false[[/if]]');
            expect(parser.ok).toBeTrue();

            expect(parser.evaluate()).toBe('false');
        }
        {
            const parser = PromptParser.compile('[[if true != true]]true[[else]]false[[/if]]');
            expect(parser.ok).toBeTrue();

            expect(parser.evaluate()).toBe('false');
        }
        {
            const parser = PromptParser.compile('[[if value != value]]true[[else]]false[[/if]]');
            expect(parser.ok).toBeTrue();

            expect(parser.evaluate({ value: 25 })).toBe('false');
        }

        // -----------------------------------------------------------------------------------------
        // LESS THAN
        // -----------------------------------------------------------------------------------------
        {
            const parser = PromptParser.compile('[[if value < 25]]true[[else]]false[[/if]]');
            expect(parser.ok).toBeTrue();

            expect(parser.evaluate({ /* no value */ })).toBe('false');
            expect(parser.evaluate({ value: 26 })).toBe('false');
            expect(parser.evaluate({ value: 25 })).toBe('false');
            expect(parser.evaluate({ value: 24 })).toBe('true');

            expect(parser.evaluate({ value: 'text' })).toBe('false');
            expect(parser.evaluate({ value: { num: 24 } })).toBe('false');
            expect(parser.evaluate({ value: true })).toBe('false');
        }

        // -----------------------------------------------------------------------------------------
        // LESS THAN EQUAL
        // -----------------------------------------------------------------------------------------
        {
            const parser = PromptParser.compile('[[if value <= 25]]true[[else]]false[[/if]]');
            expect(parser.ok).toBeTrue();

            expect(parser.evaluate({ /* no value */ })).toBe('false');
            expect(parser.evaluate({ value: 26 })).toBe('false');
            expect(parser.evaluate({ value: 25 })).toBe('true');
            expect(parser.evaluate({ value: 24 })).toBe('true');

            expect(parser.evaluate({ value: 'text' })).toBe('false');
            expect(parser.evaluate({ value: { num: 24 } })).toBe('false');
            expect(parser.evaluate({ value: true })).toBe('false');
        }

        // -----------------------------------------------------------------------------------------
        // GREATER THAN
        // -----------------------------------------------------------------------------------------
        {
            const parser = PromptParser.compile('[[if value > 25]]true[[else]]false[[/if]]');
            expect(parser.ok).toBeTrue();

            expect(parser.evaluate({ /* no value */ })).toBe('false');
            expect(parser.evaluate({ value: 26 })).toBe('true');
            expect(parser.evaluate({ value: 25 })).toBe('false');
            expect(parser.evaluate({ value: 24 })).toBe('false');

            expect(parser.evaluate({ value: 'text' })).toBe('false');
            expect(parser.evaluate({ value: { num: 24 } })).toBe('false');
            expect(parser.evaluate({ value: true })).toBe('false');
        }

        // -----------------------------------------------------------------------------------------
        // GREATER THAN EQUAL
        // -----------------------------------------------------------------------------------------
        {
            const parser = PromptParser.compile('[[if value >= 25]]true[[else]]false[[/if]]');
            expect(parser.ok).toBeTrue();

            expect(parser.evaluate({ /* no value */ })).toBe('false');
            expect(parser.evaluate({ value: 26 })).toBe('true');
            expect(parser.evaluate({ value: 25 })).toBe('true');
            expect(parser.evaluate({ value: 24 })).toBe('false');

            expect(parser.evaluate({ value: 'text' })).toBe('false');
            expect(parser.evaluate({ value: { num: 24 } })).toBe('false');
            expect(parser.evaluate({ value: true })).toBe('false');
        }
    });

    it('should ignore whitespace in the middle of directives', () => {
        const parser = PromptParser.compile('[[  if   value  ]]true[[ else  ]]false[[ /if ]]');
        expect(parser.ok).toBeTrue();

        expect(parser.evaluate({ value: true })).toBe('true');
    });

    it('should ignore whitespace in the middle of parameters', () => {
        const parser = PromptParser.compile('a {{  value  }} b');
        expect(parser.ok).toBeTrue();

        expect(parser.evaluate({ value: 25 })).toBe('a 25 b');
    });

    it('should be able to recognise and reject unbalanced conditionals', () => {
        // todo
    });

    it('should be able to recognise and reject on invalid directives', () => {
        const parser = PromptParser.compile('Foo [[invalid]] Baz');
        expect(parser.ok).toBeFalse();

        expect(parser.errors).toBeArrayOfSize(1);
        expect(parser.errors[0]).toBe('Invalid directive ("invalid") at index 6');
    });
});
