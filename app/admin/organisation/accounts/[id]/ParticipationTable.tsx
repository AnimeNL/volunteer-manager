// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';

import type { RegistrationStatus } from '@lib/database/Types';
import { Chip } from '@app/admin/components/Chip';
import { DataTable, type DataTableColumn } from '@app/admin/components/DataTable';

/**
 * Information about a volunteer's participation in a singular event.
 */
interface ParticipationInfo {
    /**
     * Unique ID describing this participation.
     */
    id: number;

    /**
     * Name of the event during which they participated.
     */
    eventShortName: string;

    /**
     * Slug of the event, to enable deep linking to their participation.
     */
    eventSlug: string;

    /**
     * Date and time on which the event started.
     */
    eventStartTime: string;

    /**
     * Status of their participation, one of { Registered, Accepted, Rejected, Cancelled }.
     */
    status: string;

    /**
     * Name of the team in which they participated.
     */
    team: string;

    /**
     * Slug of the team in which they participated, also to enable deep linking.
     */
    teamSlug: string;

    /**
     * Theme colour that applies to this team.
     */
    teamColour: string;

    /**
     * Name of the role in which they participated.
     */
    role: string;
}

/**
 * Props accepted by the <ParticipationTable> component.
 */
interface ParticipationTableProps {
    /**
     * Information about the participation as it should be rendered.
     */
    participation: ParticipationInfo[];

    /**
     * ID of the user for whom participation is being displayed.
     */
    userId: number;
}

/**
 * The <ParticipationTable> component lists the events in which this volunteer has participated, and
 * in which role. This may include cancelled participation.
 */
export function ParticipationTable(props: ParticipationTableProps) {
    const { participation, userId } = props;

    const columns: DataTableColumn<ParticipationInfo>[] = [
        {
            field: 'eventShortName',
            headerName: 'Event',
            flex: 2,

            renderCell: params => {
                const { eventSlug, status, teamSlug } = params.row;

                let href: string = '#';
                switch (status as RegistrationStatus) {
                    case 'Registered':
                    case 'Rejected':
                        href = `/admin/events/${eventSlug}/${teamSlug}/applications`;
                        break;

                    case 'Accepted':
                    case 'Cancelled':
                        href = `/admin/events/${eventSlug}/${teamSlug}/volunteers/${userId}`;
                        break;
                }

                return (
                    <MuiLink component={Link} href={href}>
                        {params.value}
                    </MuiLink>
                );
            },
        },
        {
            field: 'status',
            headerName: 'Status',
            flex: 1,
        },
        {
            field: 'team',
            headerName: 'Team',
            flex: 1,

            renderCell: params =>
                <Chip label={params.value} color={params.row.teamColour} />,
        },
        {
            field: 'role',
            headerName: 'Role',
            flex: 1,
        }
    ];

    return (
        <DataTable disableFooter rows={participation} columns={columns}
                   defaultSort={{ field: 'eventStartTime', sort: 'asc' }} />
    );
}
