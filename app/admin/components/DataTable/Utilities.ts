// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { GridValidRowModel } from '@mui/x-data-grid-premium';

/**
 * Returns whether the given |row| has been frozen.
 */
export function isFrozenRow(row: GridValidRowModel, frozenColumn?: string): boolean {
    if (!frozenColumn)
        return false;

    const frozenColumnValue = resolveRowModelField(row, frozenColumn);
    return !!frozenColumnValue;
}

/**
 * Returns whether the given |row| has been protected.
 */
export function isProtectedRow(row: GridValidRowModel, protectedColumn?: string): boolean {
    if (!protectedColumn)
        return false;

    const protectedColumnValue = resolveRowModelField(row, protectedColumn);
    return !!protectedColumnValue;
}

/**
 * Resolves the given |field| against the |row|, where the field may be a path used to discover
 * nested references.
 *
 * @param row The row based on which the field has to be resolved.
 * @param field Field, or path to a field from which the value should be derived.
 * @return Value of that entry in the row model.
 */
export function resolveRowModelField(row: GridValidRowModel, field: string): unknown {
    return field.split('.').reduce<unknown>((object, key) => {
        if (object && typeof object === 'object' && key in object)
            return (object as Record<string, unknown>)[key];

        return undefined;
    }, row);
}

/**
 * Resolves the given `template` based on the given `row`. All fields in the `row` will be
 * considered as a substitute, and a path may be used to discover nested references.
 *
 * @param row The row based on which the input has to be resolved.
 * @param template Template from which the input should be derived.
 * @return Output based on the `template`, or an empty fragment when absent.
 */
export function resolveTemplate(row: GridValidRowModel, template?: string): string {
    if (!template)
        return '#';

    return template.replace(/\{([^}]+)\}/g, (match, path) => {
        const value = resolveRowModelField(row, path);
        return value !== undefined ? String(value) : match;
    });
}
