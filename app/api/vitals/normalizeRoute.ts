// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import fs from 'node:fs';
import path from 'node:path';

/**
 * Maximum length of a normalized route stored in `web_vitals.vital_route`.
 */
const kMaxRouteLength = 255;

/**
 * Subset of Next.js's `.next/routes-manifest.json` used to map concrete pathnames back to their
 * route template.
 */
interface RoutesManifest {
    staticRoutes?: { page: string }[];
    dynamicRoutes?: { page: string; regex: string }[];
}

/**
 * Compiled route matcher built from Next.js's `routes-manifest.json`.
 */
interface CompiledRoutes {
    staticRoutes: Set<string>;
    dynamicRoutes: [ RegExp, string ][];
}

let cachedRoutes: CompiledRoutes | null | undefined;

/**
 * Compiles a `RoutesManifest` object into an O(1) static route set and ordered dynamic RegExp list.
 */
export function compileRoutesManifest(manifest: RoutesManifest): CompiledRoutes {
    return {
        staticRoutes: new Set((manifest.staticRoutes ?? []).map(route => route.page)),
        dynamicRoutes: (manifest.dynamicRoutes ?? []).map(route => [
            new RegExp(route.regex),
            route.page,
        ]),
    };
}

/**
 * Lazily loads and caches `.next/routes-manifest.json` from disk. Returns `null` when unavailable
 * (for example, during a clean dev startup before a build has run).
 */
function getCompiledRoutes(): CompiledRoutes | null {
    if (cachedRoutes !== undefined)
        return cachedRoutes;

    try {
        const manifestPath = path.join(process.cwd(), '.next', 'routes-manifest.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as RoutesManifest;
        cachedRoutes = compileRoutesManifest(manifest);
    } catch {
        cachedRoutes = null;
    }

    return cachedRoutes;
}

/**
 * Normalizes a concrete pathname (e.g. `/admin/events/2026/stewards/volunteers/412`) into its
 * Next.js route template (e.g. `/admin/events/[event]/[team]/volunteers/[volunteer]`) using
 * Next.js's generated `routes-manifest.json`.
 */
export function normalizeVitalRoute(
    rawPathname: string, compiledRoutes: CompiledRoutes | null = getCompiledRoutes()): string
{
    const withoutQuery = rawPathname.split(/[?#]/, 1)[0] || '/';
    const collapsed = withoutQuery.replace(/\/{2,}/g, '/');
    const pathname = collapsed.length > 1 ? collapsed.replace(/\/+$/, '') : collapsed;

    if (compiledRoutes) {
        if (compiledRoutes.staticRoutes.has(pathname))
            return pathname.slice(0, kMaxRouteLength);

        for (const [ pattern, page ] of compiledRoutes.dynamicRoutes) {
            if (pattern.test(pathname))
                return page.slice(0, kMaxRouteLength);
        }
    }

    return pathname.slice(0, kMaxRouteLength);
}
