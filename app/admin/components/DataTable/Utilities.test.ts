// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { resolveTemplate } from './Utilities';

describe('resolveTemplatedUrl', () => {
    it('returns "#" when the template is not provided', () => {
        expect(resolveTemplate({ id: 1 })).toBe('#');
        expect(resolveTemplate({ id: 1 }, undefined)).toBe('#');
    });

    it('returns the template unchanged if there are no variables', () => {
        expect(resolveTemplate({ id: 1 }, '/admin/events')).toBe('/admin/events');
    });

    it('substitutes basic values from the row', () => {
        const row = { id: 42, slug: 'animecon' };
        expect(resolveTemplate(row, '/events/{slug}/{id}')).toBe('/events/animecon/42');
    });

    it('supports nested path substitution', () => {
        const row = { event: { details: { slug: 'animecon-2026' } }, id: 10 };
        expect(resolveTemplate(row, '/event/{event.details.slug}/info/{id}'))
            .toBe('/event/animecon-2026/info/10');
    });

    it('converts non-string values to strings', () => {
        const row = { id: 100, active: true, value: 0 };
        expect(resolveTemplate(row, '/items/{id}?active={active}&v={value}'))
            .toBe('/items/100?active=true&v=0');
    });

    it('leaves the template variable intact if the property is undefined', () => {
        const row = { id: 50 };
        expect(resolveTemplate(row, '/users/{id}/{name}')).toBe('/users/50/{name}');
    });

    it('leaves the template variable intact if a nested property is undefined', () => {
        const row = { user: { id: 10 } }; // user.name is undefined
        expect(resolveTemplate(row, '/users/{user.id}/{user.name}'))
            .toBe('/users/10/{user.name}');

        // user.profile is undefined
        expect(resolveTemplate(row, '/users/{user.profile.age}'))
            .toBe('/users/{user.profile.age}');
    });

    it('handles null values by stringifying them', () => {
        const row = { id: null };
        expect(resolveTemplate(row, '/item/{id}')).toBe('/item/null');
    });
});
