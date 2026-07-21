// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import FolderCopyOutlinedIcon from '@mui/icons-material/FolderCopyOutlined';

import { Cache, serializeParams } from '@lib/cache/Cache';
import { DataTable, createDataSource, withContext, withRowModel, type Column, type ExtractRowModel }
    from '@app/admin/components/DataTable';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { executeAccessCheck, requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { formatBytes } from '../formatBytes';

/**
 * Formats a duration in milliseconds to a human-readable string.
 */
function formatTimeSince(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 1)
        return 'now';

    if (seconds < 60)
        return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24)
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
}

/**
 * Data source through which the individual cache's entries can be listed.
 */
const cacheEntryDataSource = createDataSource('admin/system/cache/entries', withContext({
    /**
     * Name of the cache whose entries are being listed/mutated.
     */
    cacheName: z.string(),

}), withRowModel({
    /**
     * Unique ID of the row (also the serialized params).
     */
    id: z.string(),

    /**
     * Serialized version of the parameters.
     */
    params: z.string(),

    /**
     * Raw parameters (retained for deletion matching).
     */
    rawParams: z.any().optional(),

    /**
     * The number of times the entry has been accessed.
     */
    accessCount: z.number(),

    /**
     * Time since last access.
     */
    lastAccess: z.string(),

    /**
     * Size in bytes.
     */
    size: z.number(),

    /**
     * Formatted size in bytes.
     */
    sizeLabel: z.string(),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: 'system.internals',
        });
    },

    async delete(params, props, context) {
        const cache = Cache.getInstance(context.cacheName as any);
        (cache as any).delete(params.rawParams === null ? undefined : params.rawParams);
        return true;
    },

    async list(params, props, context) {
        const cache = Cache.getInstance(context.cacheName as any);
        const rows: any[] = [];

        for (const entryParams of cache.params()) {
            const metadata = (cache as any).getMetadata(entryParams);
            if (!metadata)
                continue;

            const serialized = serializeParams(entryParams);
            const timeSinceLastAccess = performance.now() - metadata.lastAccessTime;

            rows.push({
                id: serialized || '__default__',
                params: serialized || '(no key)',
                rawParams: entryParams,
                accessCount: metadata.accessCount,
                lastAccess: formatTimeSince(timeSinceLastAccess),
                size: metadata.bytes,
                sizeLabel: formatBytes(metadata.bytes),
            });
        }

        const sortField = params.sort.field;
        const sortDirection = params.sort.direction;

        rows.sort((a, b) => {
            const valA = (a as any)[sortField];
            const valB = (b as any)[sortField];

            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortDirection === 'asc'
                    ? valA.localeCompare(valB)
                    : valB.localeCompare(valA);
            } else {
                return sortDirection === 'asc'
                    ? (valA > valB ? 1 : valA < valB ? -1 : 0)
                    : (valB > valA ? 1 : valB < valA ? -1 : 0);
            }
        });

        return {
            rows: rows.slice(params.page.offset, params.page.offset + params.page.limit),
            rowCount: rows.length
        };
    }
});

/**
 * Page that provides insight in an individual cache as specified in the URL.
 */
export default async function CacheInspectionPage(props: PageProps<'/admin/system/cache/[cache]'>) {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals',
    });

    let cache: Cache<any>;
    try {
        cache = Cache.getInstance((await props.params).cache as any);
    } catch {
        notFound();
    }

    const columns: Column<ExtractRowModel<typeof cacheEntryDataSource>>[] = [
        {
            field: 'params',
            headerName: 'Parameters',
            flex: 3,

            template: 'text',
            templateProps: {
                href: cache.descriptor.linkTemplate,
            },
        },
        {
            field: 'accessCount',
            headerName: 'Accesses',
            type: 'number',
            width: 120,
        },
        {
            field: 'lastAccess',
            headerName: 'Last accessed',
            width: 180,
        },
        {
            field: 'size',
            headerName: 'Size',
            width: 150,

            template: 'text',
            templateProps: {
                field: 'sizeLabel',
            },
        },
    ];

    return (
        <>
            <Section icon={ <FolderCopyOutlinedIcon color="primary" /> }
                     title={cache.descriptor.name}
                     breadcrumbs={[
                          { label: 'System', href: '/admin/system' },
                          { label: 'Cache Management', href: '/admin/system/cache' },
                          { label: cache.descriptor.name },
                     ]}>
                <SectionIntroduction>
                    {cache.descriptor.description}
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <DataTable columns={columns} source={cacheEntryDataSource}
                           context={{ cacheName: cache.descriptor.name }}
                           defaultSort={{ field: 'accessCount', sort: 'desc' }}
                           pageSize={25}
                           subject="cache entry"
                           listViewProps={{
                               primaryField: 'params',
                               secondaryTemplate:
                                   '{sizeLabel}, last access (x{accessCount}): {lastAccess}'
                           }} />
            </Section>
        </>
    );
}
