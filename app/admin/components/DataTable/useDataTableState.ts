// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';
import { useQueryState, parseAsInteger, parseAsString } from 'nuqs';

/**
 * Options that can be passed to the `useDataTableState` hook.
 */
interface UseDataTableStateOptions {
    /**
     * Default sort configuration for the table.
     */
    defaultSort: {
        field: string;
        sort: 'asc' | 'desc' | null;
    };

    /**
     * Whether URL query parameters should be disabled for pagination and sorting.
     */
    disableQueryParams?: boolean;

    /**
     * Default page size for the data table.
     */
    pageSize: number;
}

/**
 * The `useDataTableState` hook encapsulates the ability to persist pagination, searching and
 * sorting models either in local state, or, by default, in query parameters in the current URL.
 */
export function useDataTableState(options: UseDataTableStateOptions) {
    const { defaultSort, disableQueryParams, pageSize: defaultPageSize } = options;

    // ---------------------------------------------------------------------------------------------
    // React standard states, used when query parameters are disabled.
    // ---------------------------------------------------------------------------------------------

    const [ statePage, setStatePage ] = useState<number>(0);
    const [ statePageSize, setStatePageSize ] = useState<number>(defaultPageSize);

    const [ stateSortField, setStateSortField ] = useState<string>(defaultSort.field);
    const [ stateSortOrder, setStateSortOrder ] = useState<'asc' | 'desc' | null>(defaultSort.sort);

    const [ stateSearch, setStateSearch ] = useState<string>('');

    // ---------------------------------------------------------------------------------------------
    // URL Query states, using NUQS.
    // ---------------------------------------------------------------------------------------------

    const [ queryPage, setQueryPage ] = useQueryState(
        'page', parseAsInteger.withDefault(1).withOptions({ history: 'push' }));
    const [ queryPageSize, setQueryPageSize ] =
        useQueryState('pageSize', parseAsInteger.withDefault(defaultPageSize));

    const [ querySortField, setQuerySortField ] = useQueryState(
        'sort', parseAsString.withDefault(defaultSort.field).withOptions({ history: 'push' }));
    const [ querySortOrder, setQuerySortOrder ] = useQueryState(
        'order', parseAsString.withDefault(defaultSort.sort ?? '').withOptions({ history: 'push' }));

    const [ querySearch, setQuerySearch ] = useQueryState(
        'q', parseAsString.withDefault('').withOptions({ history: 'replace' }));

    // ---------------------------------------------------------------------------------------------
    // Unified values
    // ---------------------------------------------------------------------------------------------

    const page = disableQueryParams ? statePage : queryPage - 1;
    const pageSize = disableQueryParams ? statePageSize : queryPageSize;

    const sortField = disableQueryParams ? stateSortField : querySortField;
    const sortOrder = disableQueryParams
        ? stateSortOrder : (querySortOrder === '' ? null : querySortOrder) as 'asc' | 'desc' | null;

    const search = disableQueryParams ? stateSearch : querySearch;

    // ---------------------------------------------------------------------------------------------
    // Unified setters
    // ---------------------------------------------------------------------------------------------

    const setPage = useCallback((val: number | null) => {
        if (disableQueryParams) {
            setStatePage(val ?? 0);
        } else {
            const targetPage = val ?? 0;
            if (targetPage !== page)
                setQueryPage(val ? val + 1 : null);
        }
    }, [ disableQueryParams, page, setQueryPage ]);

    const setPageSize = useCallback((val: number) => {
        if (disableQueryParams) {
            setStatePageSize(val);
        } else if (val !== pageSize) {
            setQueryPageSize(val === defaultPageSize ? null : val);
        }
    }, [ defaultPageSize, disableQueryParams, pageSize, setQueryPageSize ]);

    const setSortField = useCallback((val: string | null) => {
        const targetField = val ?? defaultSort.field;
        if (disableQueryParams) {
            setStateSortField(targetField);
        } else if (targetField !== sortField) {
            setQuerySortField(val === defaultSort.field ? null : val);
        }
    }, [ defaultSort.field, disableQueryParams, setQuerySortField, sortField ]);

    const setSortOrder = useCallback((val: 'asc' | 'desc' | null) => {
        if (disableQueryParams) {
            setStateSortOrder(val);
        } else if (val !== sortOrder) {
            setQuerySortOrder(val === defaultSort.sort ? null : val);
        }
    }, [ defaultSort.sort, disableQueryParams, setQuerySortOrder, sortOrder ]);

    const setSearch = useCallback((val: string) => {
        if (disableQueryParams) {
            setStateSearch(val);
        } else if (val !== search) {
            setQuerySearch(val || null);
        }
    }, [ disableQueryParams, search, setQuerySearch ]);

    return {
        page, pageSize, sortField, sortOrder, search,
        setPage, setPageSize, setSortField, setSortOrder, setSearch,
    };
}
