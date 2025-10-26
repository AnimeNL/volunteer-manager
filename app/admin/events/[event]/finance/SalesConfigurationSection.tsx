// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import Typography from '@mui/material/Typography';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import type { EventFinanceRowModel } from '@app/api/admin/event/finance/[[...id]]/route';
import type { EventSalesCategory } from '@lib/database/Types';
import { ExpandableSection } from '@app/admin/components/ExpandableSection';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';

/**
 * Object containing the valid event sale categories, together with a human readable description of
 * what they represent. This object is used to populate the dropdown in the sales configuration.
 */
const kEventSaleCategoryOptions: { [k in EventSalesCategory]: string } = {
    Event: 'Event',
    Hidden: 'Hidden',
    Locker: 'Locker',
    LockerFriday: 'Locker (Friday)',
    LockerSaturday: 'Locker (Saturday)',
    LockerSunday: 'Locker (Sunday)',
    LockerWeekend: 'Locker (Weekend)',
    TicketFriday: 'Ticket (Friday)',
    TicketSaturday: 'Ticket (Saturday)',
    TicketSunday: 'Ticket (Sunday)',
    TicketWeekend: 'Ticket (Weekend)',
};

/**
 * Props accepted by the <SalesConfigurationSection> component.
 */
interface SalesConfigurationSectionProps {
    /**
     * Slug of the event for which sales information is being imported.
     */
    event: string;

    /**
     * Whether the section should be expanded by default.
     */
    expanded: boolean;
}

/**
 * The <SalesConfigurationSection> component allows the administrator to configure how imported
 * sales data should be interpretet and displayed within the Volunteer Manager.
 */
export function SalesConfigurationSection(props: SalesConfigurationSectionProps) {
    const columns: RemoteDataTableColumn<EventFinanceRowModel>[] = [
        {
            field: 'product',
            headerName: 'Product',
            editable: false,
            sortable: false,
            flex: 2,
        },
        {
            field: 'price',
            headerName: 'Price',
            headerAlign: 'left',
            align: 'left',
            type: 'number',
            editable: true,
            sortable: false,
            flex: 1,

            renderCell: params => {
                if (params.value === undefined) {
                    return (
                        <Typography component="span" variant="body2"
                                    sx={{ color: 'text.disabled' }}>
                            Unknown
                        </Typography>
                    );
                }

                return `€${Math.round(params.value * 100) / 100}`;
            },
        },
        {
            display: 'flex',
            field: 'category',
            headerName: 'Category',
            type: 'singleSelect',
            editable: true,
            sortable: false,
            flex: 1,

            valueOptions: [
                { value: 'null', label: 'Uncategorised' },
                ...Object.entries(kEventSaleCategoryOptions).map(([ value, label ]) =>
                    ({ value, label })),
            ],

            renderCell: params => {
                if (params.value === kEventSaleCategoryOptions.Hidden) {
                    return (
                        <>
                            <Typography component="span" variant="body2"
                                        sx={{ color: 'grey.600', pt: 0.25 }}>
                                Hidden
                            </Typography>
                            <VisibilityOffIcon color="disabled" fontSize="inherit"
                                               sx={{ ml: 0.5, mt: 0.25 }} />
                        </>
                    );
                }

                if (!!params.value && params.value !== 'null') {
                    if (Object.hasOwn(kEventSaleCategoryOptions, params.value)) {
                        return kEventSaleCategoryOptions[
                            params.value as keyof typeof kEventSaleCategoryOptions];
                    }

                    return params.value;
                }

                return (
                    <Typography component="span" variant="body2" sx={{ color: 'text.disabled' }}>
                        Uncategorised
                    </Typography>
                );
            },

            valueGetter: (value) => value || 'null',
        },
        {
            field: 'eventId',
            headerName: 'Event ID',
            headerAlign: 'left',
            align: 'left',
            type: 'number',
            editable: true,
            sortable: false,
            flex: 1,

            // TODO: Support an autocomplete for conveniently finding the event ID
        },
        {
            field: 'categoryLimit',
            headerName: 'Maximum sales',
            headerAlign: 'left',
            align: 'left',
            type: 'number',
            editable: true,
            sortable: false,
            flex: 1,
        },
    ];

    return (
        <ExpandableSection title="Sales configuration" icon={ <SettingsOutlinedIcon /> }
                           defaultExpanded={props.expanded}
                           setting="user-admin-event-finance-configuration">
            <RemoteDataTable columns={columns} endpoint="/api/admin/event/finance" enableUpdate
                             context={{ event: props.event }} refreshOnUpdate disableFooter
                             pageSize={100} defaultSort={{ field: 'product', sort: 'asc' }}
                             subject="product" />
        </ExpandableSection>
    );
}

