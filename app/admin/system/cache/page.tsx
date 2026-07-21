// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import FolderCopyOutlinedIcon from '@mui/icons-material/FolderCopyOutlined';

import { Cache } from '@lib/cache';
import { CacheTypeCell, CacheTypeHeader } from './CacheCells';
import { DataTable, createDataSource, withRowModel, type Column, type ExtractRowModel }
    from '@app/admin/components/DataTable';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck, requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { formatBytes } from './formatBytes';

/**
 * Data source through which the caches can be listed.
 */
const cacheDataSource = createDataSource('admin/system/cache', withRowModel({
    /**
     * Unique ID of the cache row (also its name).
     */
    id: z.string(),

    /**
     * Name of the cache.
     */
    name: z.string(),

    /**
     * The number of entries currently stored in the cache.
     */
    entries: z.number(),

    /**
     * Total size of the cache's entries in bytes.
     */
    size: z.number(),

    /**
     * Human-readable representation of the cache's size.
     */
    sizeLabel: z.string(),

    /**
     * The type of the cache.
     */
    type: z.enum([ 'permanent', 'ttl', 'lru' ]),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: 'system.internals',
        });
    },

    async delete(params) {
        Cache.getInstance(params.id as any).clear();
        return true;
    },

    async list(params, props) {
        const rows = Cache.getAll().map(cache => {
            let entriesCount = 0;
            let sizeInBytes = 0;

            for (const metadata of cache.metadata()) {
                entriesCount++;
                sizeInBytes += metadata.bytes;
            }
            return {
                id: cache.descriptor.name,
                name: cache.descriptor.name,
                entries: entriesCount,
                size: sizeInBytes,
                sizeLabel: formatBytes(sizeInBytes),
                type: cache.descriptor.type,
            };
        });

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

        return { rows, rowCount: rows.length };
    }
});

/**
 * Page that provides access and insight to all caches that exist within the Volunteer Manager. We
 * use a centralised caching mechanism for management, recovery, and adaptability.
 */
export default async function CacheManagementPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals',
    });

    const columns: Column<ExtractRowModel<typeof cacheDataSource>>[] = [
        {
            field: 'name',
            headerName: 'Name',
            flex: 2,

            template: 'text',
            templateProps: {
                href: '/admin/system/cache/{id}',
            },
        },
        {
            field: 'entries',
            headerName: 'Entries',
            width: 150,
            type: 'number',
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
        {
            field: 'type',
            headerName: 'Type',
            sortable: false,

            headerAlign: 'center',
            align: 'center',
            width: 50,

            template: 'component',
            templateProps: {
                headerComponent: CacheTypeHeader,
                component: CacheTypeCell,
            },
        },
    ];

    return (
        <>
            <Section icon={ <FolderCopyOutlinedIcon color="primary" /> } title="Cache Management"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Cache Management' },
                     ]}>
                <SectionIntroduction>
                    Insight and control over the Volunteer Manager's data internal caches.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <DataTable columns={columns} source={cacheDataSource} disableFooter
                           defaultSort={{ field: 'name', sort: 'asc' }}
                           pageSize={25}
                           subject="cache"
                           listViewProps={{
                               primaryField: 'name',
                               secondaryField: 'sizeLabel',
                               startComponent: CacheTypeCell,
                               linkTemplate: './cache/{id}',
                           }} />
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Cache Management', 'System');
