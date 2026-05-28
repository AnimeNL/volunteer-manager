// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { PromptTemplate } from './PromptTemplate';

describe('PromptTemplate', () => {
    it('should reject invalid input', () => {
        expect(() => PromptTemplate.compile(undefined as unknown as string)).toThrow();
        expect(() => PromptTemplate.compile(null as unknown as string)).toThrow();
        expect(() => PromptTemplate.compile(1.2345 as unknown as string)).toThrow();
        expect(() => PromptTemplate.compile({ value: true } as unknown as string)).toThrow();
        expect(() => PromptTemplate.compile([ 'hello' ] as unknown as string)).toThrow();
    });
    it('should be able to deal with simple strings', () => {
        {
            const template = PromptTemplate.compile(/* empty= */ '');
            expect(template.ok).toBeTruthy();

            expect(template.parameters).toHaveLength(0);
            expect(template.evaluate()).toBe('');
        }
        {
            const template = PromptTemplate.compile('Hello, world!');
            expect(template.ok).toBeTruthy();

            expect(template.parameters).toHaveLength(0);
            expect(template.evaluate()).toBe('Hello, world!');
        }
    });

    it('should be able to identify substitution parameters', () => {
        {
            const template = PromptTemplate.compile('Hello, {{world}}');
            expect(template.ok).toBeTruthy();

            expect(template.errors).toHaveLength(0);

            expect(template.parameters).toHaveLength(1);
            expect(template.parameters[0]).toBe('world');
        }
        {
            const template = PromptTemplate.compile('Hello, {{world}} & {{world}}');
            expect(template.ok).toBeTruthy();

            expect(template.errors).toHaveLength(0);

            expect(template.parameters).toHaveLength(1);
            expect(template.parameters[0]).toBe('world');
        }
        {
            const template = PromptTemplate.compile('Hello, {{world}} & {{planet}}');
            expect(template.ok).toBeTruthy();

            expect(template.errors).toHaveLength(0);

            expect(template.parameters).toHaveLength(2);
            expect(template.parameters[0]).toBe('planet');
            expect(template.parameters[1]).toBe('world');
        }
    });

    it('should be able to detect compilation issues regarding substitution parameters', () => {
        {
            const template = PromptTemplate.compile('Hello, {{');
            expect(template.ok).toBeFalsy();

            expect(template.errors).toHaveLength(1);
            expect(template.errors[0]).toBe('Missing parameter closing token ("}}") at index 7');

            expect(template.parameters).toHaveLength(0);
        }
        {
            const template = PromptTemplate.compile('Hello, {{}}');
            expect(template.ok).toBeFalsy();

            expect(template.errors).toHaveLength(1);
            expect(template.errors[0]).toBe('Missing parameter name at index 9');

            expect(template.parameters).toHaveLength(0);
        }
        {
            const template = PromptTemplate.compile('Hello, {{]]}}');
            expect(template.ok).toBeFalsy();

            expect(template.parameters).toHaveLength(0);

            expect(template.errors).toHaveLength(1);
            expect(template.errors[0]).toBe('Invalid parameter name ("]]") at index 9');

            expect(template.parameters).toHaveLength(0);
        }
        {
            const template = PromptTemplate.compile('Hello, {{1}} {{2}}');
            expect(template.ok).toBeFalsy();

            expect(template.parameters).toHaveLength(0);

            expect(template.errors).toHaveLength(2);
            expect(template.errors[0]).toBe('Invalid parameter name ("1") at index 9');
            expect(template.errors[1]).toBe('Invalid parameter name ("2") at index 15');

            expect(template.parameters).toHaveLength(0);
        }
    });

    it('should be able to replace substitution parameters', () => {
        {
            const template = PromptTemplate.compile('{{value}}');
            expect(template.ok).toBeTruthy();

            expect(template.parameters).toHaveLength(1);
            expect(template.parameters[0]).toBe('value');

            expect(template.evaluate({ value: 42 })).toBe('42');
        }
        {
            const template = PromptTemplate.compile('{{value}}{{value}}');
            expect(template.ok).toBeTruthy();

            expect(template.parameters).toHaveLength(1);
            expect(template.parameters[0]).toBe('value');

            expect(template.evaluate({ value: 9001 })).toBe('90019001');
        }
        {
            const template = PromptTemplate.compile('Hello, {{name}}!');
            expect(template.ok).toBeTruthy();

            expect(template.parameters).toHaveLength(1);
            expect(template.parameters[0]).toBe('name');

            expect(template.evaluate({ name: 'World' })).toBe('Hello, World!');
        }
        {
            const template = PromptTemplate.compile('Hello, {{person.name}}!');
            expect(template.ok).toBeTruthy();

            expect(template.parameters).toHaveLength(1);
            expect(template.parameters[0]).toBe('person.name');

            expect(template.evaluate({ person: { name: 'John' } })).toBe('Hello, John!');
        }
    });

    it('should be able to replace substitution parameters that are not provided', () => {
        {
            const template = PromptTemplate.compile('Hello, {{name}}!');
            expect(template.ok).toBeTruthy();

            expect(template.parameters).toHaveLength(1);
            expect(template.parameters[0]).toBe('name');

            expect(template.evaluate({ /* no name */ })).toBe('Hello, [undefined]!');
        }
        {
            const template = PromptTemplate.compile('Hello, {{person.name}}!');
            expect(template.ok).toBeTruthy();

            expect(template.parameters).toHaveLength(1);
            expect(template.parameters[0]).toBe('person.name');

            expect(template.evaluate({ person: { /* no name */ } })).toBe('Hello, [undefined]!');
        }
    });

    it('should be able to replace substitution parameters that resolve to an object', () => {
        const template = PromptTemplate.compile('Hello, {{person}}!');
        expect(template.ok).toBeTruthy();

        expect(template.parameters).toHaveLength(1);
        expect(template.parameters[0]).toBe('person');

        expect(template.evaluate({ person: { /* no properties */ } })).toBe('Hello, [object]!');
    });

    it('should be able to deal with binary conditionals', () => {
        const template = PromptTemplate.compile('Today is [[if warm]]great[[else]]ok[[/if]]!');
        expect(template.ok).toBeTruthy();

        expect(template.parameters).toHaveLength(1);
        expect(template.parameters[0]).toBe('warm');

        // Present and true
        expect(template.evaluate({ warm: true })).toBe('Today is great!');

        // Present and truthy
        expect(template.evaluate({ warm: 'foobar' })).toBe('Today is great!');

        // Present and falsy
        expect(template.evaluate({ warm: false })).toBe('Today is ok!');

        // Missing, thus falsy
        expect(template.evaluate({ /* no `warm` */ })).toBe('Today is ok!');
    });

    it('should be able to deal with nested binary conditionals', () => {
        const template = PromptTemplate.compile(
            '[[if red]][[if yellow]]orange[[else]]red[[/if]][[else]][[if yellow]]yellow[[else]]' +
            'white[[/if]][[/if]]');
        expect(template.ok).toBeTruthy();

        expect(template.parameters).toHaveLength(2);
        expect(template.parameters[0]).toBe('red');
        expect(template.parameters[1]).toBe('yellow');

        expect(template.evaluate({ /* no red */ yellow: true })).toBe('yellow');
        expect(template.evaluate({ /* no red */ yellow: false })).toBe('white');
        expect(template.evaluate({ /* no red & no yellow */ })).toBe('white');
        expect(template.evaluate({ red: false, yellow: false })).toBe('white');
        expect(template.evaluate({ red: false, yellow: true })).toBe('yellow');
        expect(template.evaluate({ red: false /* no yellow */ })).toBe('white');
        expect(template.evaluate({ red: true, yellow: false })).toBe('red');
        expect(template.evaluate({ red: true, yellow: true })).toBe('orange');
        expect(template.evaluate({ red: true /* no yellow */ })).toBe('red');
    });

    it('should be able to deal with basic comparison operator conditionals', () => {
        // -----------------------------------------------------------------------------------------
        // IMPLICIT EQUALITY
        // -----------------------------------------------------------------------------------------
        {
            const template = PromptTemplate.compile('[[if value]]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.parameters).toHaveLength(1);
            expect(template.parameters[0]).toBe('value');

            expect(template.evaluate({ value: true })).toBe('true');
            expect(template.evaluate({ value: false })).toBe('false');
            expect(template.evaluate({ /* no value */ })).toBe('false');
            expect(template.evaluate({ /* truthy= */ value: 15 })).toBe('true');
            expect(template.evaluate({ /* truthy= */ value: 'text' })).toBe('true');
        }

        // -----------------------------------------------------------------------------------------
        // IMPLICIT NON-EQUALITY
        // -----------------------------------------------------------------------------------------
        {
            const template = PromptTemplate.compile('[[if !value]]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate({ value: true })).toBe('false');
            expect(template.evaluate({ value: false })).toBe('true');
            expect(template.evaluate({ /* no value */ })).toBe('true');
            expect(template.evaluate({ /* truthy= */ value: 15 })).toBe('false');
            expect(template.evaluate({ /* truthy= */ value: 'text' })).toBe('false');
        }

        // -----------------------------------------------------------------------------------------
        // EQUALITY
        // -----------------------------------------------------------------------------------------
        {
            const template = PromptTemplate.compile('[[if value == true]]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.parameters).toHaveLength(1);
            expect(template.parameters[0]).toBe('value');

            expect(template.evaluate({ value: true })).toBe('true');
            expect(template.evaluate({ value: 'aye' })).toBe('true');

            expect(template.evaluate({ value: false })).toBe('false');
            expect(template.evaluate({ /* no value */ })).toBe('false');
        }
        {
            const template =
                PromptTemplate.compile('[[if value == false]]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate({ value: true })).toBe('false');
            expect(template.evaluate({ value: 'aye' })).toBe('false');

            expect(template.evaluate({ value: false })).toBe('true');
            expect(template.evaluate({ /* no value */ })).toBe('true');
        }
        {
            const template = PromptTemplate.compile('[[if value == 25]]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate({ value: 25 })).toBe('true');
            expect(template.evaluate({ value: '25' })).toBe('true');
            expect(template.evaluate({ value: 14 })).toBe('false');
            expect(template.evaluate({ value: '14' })).toBe('false');
        }
        {
            const template =
                PromptTemplate.compile('[[if value == "text"]]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate({ value: 'text' })).toBe('true');
            expect(template.evaluate({ value: 'other' })).toBe('false');
        }
        {
            const template =
                PromptTemplate.compile('[[if value == \'text\']]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate({ value: 'text' })).toBe('true');
            expect(template.evaluate({ value: 'other' })).toBe('false');
        }
        {
            const template =
                PromptTemplate.compile('[[if "text" == "text"]]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate()).toBe('true');
        }
        {
            const template = PromptTemplate.compile('[[if true == true]]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate()).toBe('true');
        }
        {
            const template =
                PromptTemplate.compile('[[if value == value]]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate({ value: 25 })).toBe('true');
        }

        // -----------------------------------------------------------------------------------------
        // NON-EQUALITY
        // -----------------------------------------------------------------------------------------
        {
            const template = PromptTemplate.compile('[[if value != true]]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate({ value: true })).toBe('false');
            expect(template.evaluate({ value: 'aye' })).toBe('false');

            expect(template.evaluate({ value: false })).toBe('true');
            expect(template.evaluate({ /* no value */ })).toBe('true');
        }
        {
            const template =
                PromptTemplate.compile('[[if value != false]]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate({ value: true })).toBe('true');
            expect(template.evaluate({ value: 'aye' })).toBe('true');

            expect(template.evaluate({ value: false })).toBe('false');
            expect(template.evaluate({ /* no value */ })).toBe('false');
        }
        {
            const template = PromptTemplate.compile('[[if value != 25]]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate({ value: 25 })).toBe('false');
            expect(template.evaluate({ value: '25' })).toBe('false');
            expect(template.evaluate({ value: 14 })).toBe('true');
            expect(template.evaluate({ value: '14' })).toBe('true');
        }
        {
            const template =
                PromptTemplate.compile('[[if value != "text"]]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate({ value: 'text' })).toBe('false');
            expect(template.evaluate({ value: 'other' })).toBe('true');
        }
        {
            const template =
                PromptTemplate.compile('[[if "text" != "text"]]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate()).toBe('false');
        }
        {
            const template = PromptTemplate.compile('[[if true != true]]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate()).toBe('false');
        }
        {
            const template =
                PromptTemplate.compile('[[if value != value]]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate({ value: 25 })).toBe('false');
        }

        // -----------------------------------------------------------------------------------------
        // LESS THAN
        // -----------------------------------------------------------------------------------------
        {
            const template = PromptTemplate.compile('[[if value < 25]]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate({ /* no value */ })).toBe('false');
            expect(template.evaluate({ value: 26 })).toBe('false');
            expect(template.evaluate({ value: 25 })).toBe('false');
            expect(template.evaluate({ value: 24 })).toBe('true');

            expect(template.evaluate({ value: 'text' })).toBe('false');
            expect(template.evaluate({ value: { num: 24 } })).toBe('false');
            expect(template.evaluate({ value: true })).toBe('false');
        }

        // -----------------------------------------------------------------------------------------
        // LESS THAN EQUAL
        // -----------------------------------------------------------------------------------------
        {
            const template = PromptTemplate.compile('[[if value <= 25]]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate({ /* no value */ })).toBe('false');
            expect(template.evaluate({ value: 26 })).toBe('false');
            expect(template.evaluate({ value: 25 })).toBe('true');
            expect(template.evaluate({ value: 24 })).toBe('true');

            expect(template.evaluate({ value: 'text' })).toBe('false');
            expect(template.evaluate({ value: { num: 24 } })).toBe('false');
            expect(template.evaluate({ value: true })).toBe('false');
        }

        // -----------------------------------------------------------------------------------------
        // GREATER THAN
        // -----------------------------------------------------------------------------------------
        {
            const template = PromptTemplate.compile('[[if value > 25]]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate({ /* no value */ })).toBe('false');
            expect(template.evaluate({ value: 26 })).toBe('true');
            expect(template.evaluate({ value: 25 })).toBe('false');
            expect(template.evaluate({ value: 24 })).toBe('false');

            expect(template.evaluate({ value: 'text' })).toBe('false');
            expect(template.evaluate({ value: { num: 24 } })).toBe('false');
            expect(template.evaluate({ value: true })).toBe('false');
        }

        // -----------------------------------------------------------------------------------------
        // GREATER THAN EQUAL
        // -----------------------------------------------------------------------------------------
        {
            const template = PromptTemplate.compile('[[if value >= 25]]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate({ /* no value */ })).toBe('false');
            expect(template.evaluate({ value: 26 })).toBe('true');
            expect(template.evaluate({ value: 25 })).toBe('true');
            expect(template.evaluate({ value: 24 })).toBe('false');

            expect(template.evaluate({ value: 'text' })).toBe('false');
            expect(template.evaluate({ value: { num: 24 } })).toBe('false');
            expect(template.evaluate({ value: true })).toBe('false');
        }
    });

    it('should support else if ("elif") statements in conditionals', () => {
        {
            const template = PromptTemplate.compile(
                '[[if value < 25]]low[[elif value == 25]]mid[[else]]high[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate({ /* no value */ })).toBe('high');

            expect(template.evaluate({ value: 26 })).toBe('high');
            expect(template.evaluate({ value: 25 })).toBe('mid');
            expect(template.evaluate({ value: 24 })).toBe('low');
        }
        {
            const template = PromptTemplate.compile(
                '[[if value < 25]]low[[elif value == 25]]mid-low[[elif value == 26]]mid-high' +
                '[[else]]high[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate({ /* no value */ })).toBe('high');

            expect(template.evaluate({ value: 27 })).toBe('high');
            expect(template.evaluate({ value: 26 })).toBe('mid-high');
            expect(template.evaluate({ value: 25 })).toBe('mid-low');
            expect(template.evaluate({ value: 24 })).toBe('low');
        }
        {
            const template = PromptTemplate.compile('[[if a]]a[[elif b]]b[[elif c]]c[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate({ /* no value */ })).toBe(/* empty= */ '');

            expect(template.evaluate({ a: true, b: false, c: false })).toBe('a');
            expect(template.evaluate({ a: true, b: false, c: true })).toBe('a');
            expect(template.evaluate({ a: true, b: true, c: false })).toBe('a');
            expect(template.evaluate({ a: true, b: true, c: true })).toBe('a');

            expect(template.evaluate({ a: false, b: false, c: false })).toBe(/* empty= */ '');
            expect(template.evaluate({ a: false, b: false, c: true })).toBe('c');
            expect(template.evaluate({ a: false, b: true, c: false })).toBe('b');
            expect(template.evaluate({ a: false, b: true, c: true })).toBe('b');
        }
        {
            const template = PromptTemplate.compile(
                '[[if first]]first[[elif a and b]]compound-elif[[else]]other[[/if]]');
            expect(template.ok).toBeTruthy();
            expect(template.parameters).toHaveLength(3);
            expect(template.parameters[0]).toBe('a');
            expect(template.parameters[1]).toBe('b');
            expect(template.parameters[2]).toBe('first');

            expect(template.evaluate({ first: true })).toBe('first');
            expect(template.evaluate({ first: false, a: true, b: true })).toBe('compound-elif');
            expect(template.evaluate({ first: false, a: true, b: false })).toBe('other');
            expect(template.evaluate({ first: false, a: false, b: true })).toBe('other');
            expect(template.evaluate({ first: false, a: false, b: false })).toBe('other');
        }
    });

    it('should ignore whitespace in the middle of directives', () => {
        const template = PromptTemplate.compile('[[  if   value  ]]true[[ else  ]]false[[ /if ]]');
        expect(template.ok).toBeTruthy();

        expect(template.parameters).toHaveLength(1);
        expect(template.parameters[0]).toBe('value');

        expect(template.evaluate({ value: true })).toBe('true');
    });

    it('should ignore whitespace in the middle of parameters', () => {
        const template = PromptTemplate.compile('a {{  value  }} b');
        expect(template.ok).toBeTruthy();

        expect(template.evaluate({ value: 25 })).toBe('a 25 b');
    });

    it('should be able to recognise and reject unbalanced conditionals', () => {
        {
            const template = PromptTemplate.compile('[[if foo]]');
            expect(template.ok).toBeFalsy();
        }
        {
            const template = PromptTemplate.compile('[[if foo]]bar[[else]]');
            expect(template.ok).toBeFalsy();
        }
        {
            const template = PromptTemplate.compile('[[if foo]]bar[[elif bar]]baz');
            expect(template.ok).toBeFalsy();
        }
        {
            const template = PromptTemplate.compile('[[if foo]]bar[[elif bar]]baz[[else]]');
            expect(template.ok).toBeFalsy();
        }
        {
            const template = PromptTemplate.compile('[[if foo]]a[[else]]b[[elif qux]]c[[/if]]');
            expect(template.ok).toBeFalsy();
        }
        {
            const template = PromptTemplate.compile('[[if foo]][[if bar]]baz[[/if]]');
            expect(template.ok).toBeFalsy();
        }
        {
            const template = PromptTemplate.compile('[[if foo]]a[[else]]b[[else]]c[[/if]]');
            expect(template.ok).toBeFalsy();
        }
        {
            const template = PromptTemplate.compile('[[elif]]');
            expect(template.ok).toBeFalsy();
        }
        {
            const template = PromptTemplate.compile('[[else]]');
            expect(template.ok).toBeFalsy();
        }
        {
            const template = PromptTemplate.compile('[[/if]]');
            expect(template.ok).toBeFalsy();
        }
    });

    it('should deal properly with escaped string values in conditionals', () => {
        {
            const template =
                PromptTemplate.compile('[[if "\\"foo\\"" == bar]]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate({ bar: 'foo' })).toBe('false');
            expect(template.evaluate({ bar: '"foo"' })).toBe('true');
        }
        {
            const template =
                PromptTemplate.compile('[[if "\\\'foo\\\'" == bar]]true[[else]]false[[/if]]');
            expect(template.ok).toBeTruthy();

            expect(template.evaluate({ bar: 'foo' })).toBe('false');
            expect(template.evaluate({ bar: '\'foo\'' })).toBe('true');
        }
    });

    it('should compile conditions without operator ambiguity', () => {
        const template = PromptTemplate.compile('[[if "==" != ">="]]true[[else]]false[[/if]]');
        expect(template.ok).toBeTruthy();

        expect(template.evaluate()).toBe('true');
    });

    it('should support compound conditionals separated by and/or', () => {
        // Simple "and" boolean check
        {
            const template = PromptTemplate.compile('[[if a and b]]yes[[else]]no[[/if]]');
            expect(template.ok).toBeTruthy();
            expect(template.parameters).toHaveLength(2);
            expect(template.parameters[0]).toBe('a');
            expect(template.parameters[1]).toBe('b');

            expect(template.evaluate({ a: true, b: true })).toBe('yes');
            expect(template.evaluate({ a: true, b: false })).toBe('no');
            expect(template.evaluate({ a: false, b: true })).toBe('no');
            expect(template.evaluate({ a: false, b: false })).toBe('no');
        }

        // Simple "or" boolean check
        {
            const template = PromptTemplate.compile('[[if a or b]]yes[[else]]no[[/if]]');
            expect(template.ok).toBeTruthy();
            expect(template.parameters).toHaveLength(2);

            expect(template.evaluate({ a: true, b: true })).toBe('yes');
            expect(template.evaluate({ a: true, b: false })).toBe('yes');
            expect(template.evaluate({ a: false, b: true })).toBe('yes');
            expect(template.evaluate({ a: false, b: false })).toBe('no');
        }

        // Variable comparison separated by "or"
        {
            const template = PromptTemplate.compile(
                '[[if var >= 24 or anotherVar >= 10]]yes[[else]]no[[/if]]');
            expect(template.ok).toBeTruthy();
            expect(template.parameters).toHaveLength(2);
            expect(template.parameters[0]).toBe('anotherVar');
            expect(template.parameters[1]).toBe('var');

            expect(template.evaluate({ var: 25, anotherVar: 5 })).toBe('yes');
            expect(template.evaluate({ var: 20, anotherVar: 12 })).toBe('yes');
            expect(template.evaluate({ var: 20, anotherVar: 5 })).toBe('no');
        }

        // Logical operator with multiple whitespaces
        {
            const template = PromptTemplate.compile('[[if a   and    b]]yes[[else]]no[[/if]]');
            expect(template.ok).toBeTruthy();
            expect(template.evaluate({ a: true, b: true })).toBe('yes');
            expect(template.evaluate({ a: true, b: false })).toBe('no');
        }

        // Logical operator in quotes should not trigger compound parsing
        {
            const template = PromptTemplate.compile('[[if "and" == "and"]]yes[[else]]no[[/if]]');
            expect(template.ok).toBeTruthy();
            expect(template.parameters).toHaveLength(0);
            expect(template.evaluate()).toBe('yes');
        }

        // Operator name as part of variable name should not trigger compound parsing
        {
            const template = PromptTemplate.compile('[[if android]]yes[[else]]no[[/if]]');
            expect(template.ok).toBeTruthy();
            expect(template.parameters).toHaveLength(1);
            expect(template.parameters[0]).toBe('android');
            expect(template.evaluate({ android: true })).toBe('yes');
            expect(template.evaluate({ android: false })).toBe('no');
        }

        // Multiple compound conditionals (left-to-right evaluation)
        {
            const template = PromptTemplate.compile('[[if a and b or c]]yes[[else]]no[[/if]]');
            expect(template.ok).toBeTruthy();
            expect(template.parameters).toHaveLength(3);
            expect(template.evaluate({ a: true, b: false, c: true })).toBe('yes');
            expect(template.evaluate({ a: true, b: true, c: false })).toBe('yes');
            expect(template.evaluate({ a: false, b: false, c: false })).toBe('no');
        }
    });

    it('should be able to recognise and reject on invalid directives', () => {
        const template = PromptTemplate.compile('Foo [[invalid]] Baz');
        expect(template.ok).toBeFalsy();

        expect(template.errors).toHaveLength(1);
        expect(template.errors[0]).toBe('Invalid directive ("invalid") at index 6');
    });
});
