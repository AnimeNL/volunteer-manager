// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FilterListIcon from '@mui/icons-material/FilterList';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';

import type { FinancialFilter, FinancialFilterOptions } from '@lib/tickets/Types';

/**
 * Props accepted by the <FinanceFilterButton> component.
 */
interface FinanceFilterButtonProps {
    /**
     * Currently active UTM filter values.
     */
    filter: FinancialFilter;

    /**
     * Available UTM filter values discovered for the event.
     */
    options: FinancialFilterOptions;
}

/**
 * Displays a filter icon button in the finances header that opens a popover to filter financial
 * data by `utm_source` and `utm_campaign`.
 */
export function FinanceFilterButton(props: FinanceFilterButtonProps) {
    const { filter, options } = props;

    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();

    const anchorRef = useRef<HTMLSpanElement>(null);
    const [ anchorEl, setAnchorEl ] = useState<HTMLElement | null>(null);
    const [ tooltipOpen, setTooltipOpen ] = useState(false);

    const hasActiveFilter = Boolean(filter.utmSource || filter.utmCampaign);

    const activeFilterLabels: string[] = [];
    if (filter.utmSource)
        activeFilterLabels.push(`utm_source: ${filter.utmSource}`);
    if (filter.utmCampaign)
        activeFilterLabels.push(`utm_campaign: ${filter.utmCampaign}`);

    const updateFilter = useCallback((next: FinancialFilter) => {
        const params = new URLSearchParams(searchParams.toString());
        if (next.utmSource)
            params.set('utm_source', next.utmSource);
        else
            params.delete('utm_source');

        if (next.utmCampaign)
            params.set('utm_campaign', next.utmCampaign);
        else
            params.delete('utm_campaign');

        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, [ pathname, router, searchParams ]);

    const handleOpen = useCallback(() => {
        setTooltipOpen(false);
        setAnchorEl(anchorRef.current);
    }, []);

    const handleClear = useCallback(() => {
        updateFilter({});
        setTooltipOpen(false);
        setAnchorEl(null);
    }, [ updateFilter ]);

    return (
        <>
            <Tooltip title="Filter sales data"
                     open={tooltipOpen && !anchorEl}
                     onOpen={() => setTooltipOpen(true)}
                     onClose={() => setTooltipOpen(false)}>
                <Box component="span" ref={anchorRef} sx={{ display: 'inline-flex' }}>
                    { hasActiveFilter ? (
                        <Chip size="small" color="primary"
                              icon={<FilterListIcon />}
                              label={activeFilterLabels.join(', ')}
                              onClick={handleOpen}
                              onDelete={handleClear} />
                    ) : (
                        <IconButton size="small" onClick={handleOpen}>
                            <FilterListIcon fontSize="small" />
                        </IconButton>
                    ) }
                </Box>
            </Tooltip>
            <Popover open={Boolean(anchorEl)} anchorEl={anchorEl}
                     onClose={() => setAnchorEl(null)}
                     anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                     transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
                <Stack spacing={1} sx={{ p: 1.5, minWidth: 260 }}>
                    <FormControl size="small" fullWidth disabled={options.utmSources.length === 0}>
                        <InputLabel id="finance-filter-utm-source">UTM Source</InputLabel>
                        <Select labelId="finance-filter-utm-source" label="UTM Source"
                                value={filter.utmSource ?? ''}
                                onChange={event => updateFilter({
                                    ...filter,
                                    utmSource: event.target.value || undefined,
                                })}>
                            <MenuItem value="">
                                <em>All sources</em>
                            </MenuItem>
                            {options.utmSources.map(source =>
                                <MenuItem key={source} value={source}>{source}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" fullWidth
                                 disabled={options.utmCampaigns.length === 0}>
                        <InputLabel id="finance-filter-utm-campaign">UTM Campaign</InputLabel>
                        <Select labelId="finance-filter-utm-campaign" label="UTM Campaign"
                                value={filter.utmCampaign ?? ''}
                                onChange={event => updateFilter({
                                    ...filter,
                                    utmCampaign: event.target.value || undefined,
                                })}>
                            <MenuItem value="">
                                <em>All campaigns</em>
                            </MenuItem>
                            {options.utmCampaigns.map(campaign =>
                                <MenuItem key={campaign} value={campaign}>{campaign}</MenuItem>)}
                        </Select>
                    </FormControl>
                    { hasActiveFilter &&
                        <Button size="small" onClick={handleClear}>
                            Clear filter
                        </Button> }
                </Stack>
            </Popover>
        </>
    );
}
