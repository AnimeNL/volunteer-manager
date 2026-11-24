// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

/**
 * Props accepted by the <StatisticsFilters> component.
 */
type StatisticsFiltersProps = {
    /**
     * Filters included in the URL's search parameters.
     */
    searchParams: URLSearchParams;
};

/**
 * The <StatisticsFilters> component displays the filters that should apply for this particular
 * page, and will carry over to links to other pages as well. This enables the volunteer to select
 * the scope of their interest, and narrow down (or broaden) the results.
 */
export function StatisticsFilters(props: StatisticsFiltersProps) {
    // TODO: Implement the filter component.
    return undefined;
}
