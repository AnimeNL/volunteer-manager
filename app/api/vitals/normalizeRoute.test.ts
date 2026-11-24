// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { compileRoutesManifest, normalizeVitalRoute } from './normalizeRoute';

const kTestRoutes = compileRoutesManifest({
    staticRoutes: [
        { page: '/' },
        { page: '/example' },
        { page: '/example/settings' },
    ],
    dynamicRoutes: [
        {
            page: '/example/items/[item]',
            regex: '^/example/items/([^/]+?)(?:/)?$',
        },
        {
            page: '/example/items/[item]/summary',
            regex: '^/example/items/([^/]+?)/summary(?:/)?$',
        },
        {
            page: '/example/items/[item]/[group]/members/[member]',
            regex: '^/example/items/([^/]+?)/([^/]+?)/members/([^/]+?)(?:/)?$',
        },
        {
            page: '/docs/[section]/[[...path]]',
            regex: '^/docs/([^/]+?)(?:/(.+?))?(?:/)?$',
        },
    ],
});

describe('normalizeVitalRoute', () => {
    it('matches static and dynamic routes from a routes manifest', () => {
        expect(normalizeVitalRoute('/', kTestRoutes)).toEqual('/');
        expect(normalizeVitalRoute('/example', kTestRoutes)).toEqual('/example');
        expect(normalizeVitalRoute('/example/items/foo', kTestRoutes))
            .toEqual('/example/items/[item]');
        expect(normalizeVitalRoute('/example/items/foo/summary', kTestRoutes))
            .toEqual('/example/items/[item]/summary');
        expect(normalizeVitalRoute('/example/items/foo/bar/members/42', kTestRoutes))
            .toEqual('/example/items/[item]/[group]/members/[member]');
        expect(normalizeVitalRoute('/docs/guide/getting-started', kTestRoutes))
            .toEqual('/docs/[section]/[[...path]]');
    });

    it('strips query strings, hashes, duplicate slashes, and trailing slashes', () => {
        expect(normalizeVitalRoute('/example/items/foo/?page=2#top', kTestRoutes))
            .toEqual('/example/items/[item]');
        expect(normalizeVitalRoute('//example//settings///', kTestRoutes))
            .toEqual('/example/settings');
    });

    it('falls back to the cleaned pathname when no manifest is available', () => {
        expect(normalizeVitalRoute('/example/items/foo/?tab=overview', null))
            .toEqual('/example/items/foo');
    });
});
