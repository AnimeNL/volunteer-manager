// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import dynamic from 'next/dynamic';

import type { DataSourceInterface } from './DataSourceInterface';
import type { DataTableClientProps } from './DataTableClient';

const DataTableClient = dynamic(() => import('./DataTableClient'), { ssr: false });

/**
 * The <DataTable> component is a wrapped implementation of the MUI X `<DataGrid>` component with
 * additional functionality to create, delete and mutate existing rows. In minimal usage, its given
 * a collection of `columns` to display, and a `source` to obtain information from.
 *
 * The ability to mutate data is decided based on the capabilities exposed by the `source`, and the
 * presented user interface will be amended in line with that.
 *
 * @see <DataTableClient>
 */
export function DataTable<Interface extends DataSourceInterface<any, any>>(
    props: DataTableClientProps<Interface>)
{
    return <DataTableClient {...props} />;
}
