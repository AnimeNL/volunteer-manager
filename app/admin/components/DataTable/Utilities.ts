// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { GridRowModel } from '@mui/x-data-grid-premium';

/**
 * Resolves the given `template` URL based on the given `row`. All fields in the `row` will be
 * considered as a substitute, and a path may be used to discover nested references.
 *
 * @param row The row based on which the URL has to be resolved.
 * @param template Template from which the URL should be derived.
 * @return URL based on the `template`, or an empty fragment when absent.
 */
export function resolveTemplatedUrl(row: GridRowModel<any>, template?: string): string {
    if (!template)
        return '#';

    return template.replace(/\{([^}]+)\}/g, (match, path) => {
        const value = path.split('.').reduce((object: any, key: string) => {
            return object && object[key] !== undefined ? object[key] : undefined;
        }, row);

        return value !== undefined ? String(value) : match;
    });
}
