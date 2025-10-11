// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import ThumbDownOffAltIcon from '@mui/icons-material/ThumbDownOffAlt';
import ThumbUpOffAltIcon from '@mui/icons-material/ThumbUpOffAlt';
import Tooltip from '@mui/material/Tooltip';

import type { FeedbackRowModel } from '@app/api/admin/organisation/feedback/route';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';
import { Temporal, formatDate } from '@lib/Temporal';

import { kFeedbackResponse } from '@lib/database/Types';

/**
 * The <FeedbackDataTable> component displays the feedback that has been received through the
 * Volunteer Portal. Items are strictly read only.
 */
export function FeedbackDataTable() {
    const localTz = Temporal.Now.timeZoneId();

    const columns: RemoteDataTableColumn<FeedbackRowModel>[] = [
        {
            field: 'date',
            headerName: 'Received',
            flex: 1,

            renderCell: params => {
                const date = formatDate(
                    Temporal.ZonedDateTime.from(params.value).withTimeZone(localTz),
                    'YYYY-MM-DD HH:mm:ss');

                return (
                    <MuiLink component={Link} href={`./feedback/${params.row.id}`}>
                        {date}
                    </MuiLink>
                );
            },
        },
        {
            field: 'userName',
            headerName: 'Volunteer',
            flex: 1,

            renderCell: params => {
                if (!params.row.userId)
                    return params.value;

                return (
                    <MuiLink component={Link}
                             href={`/admin/organisation/accounts/${params.row.userId}`}>
                        {params.value}
                    </MuiLink>
                );
            },
        },
        {
            field: 'feedback',
            headerName: 'Feedback',
            flex: 4,
        },
        {
            display: 'flex',
            field: 'response',
            headerName: /* empty= */ '',
            sortable: false,
            align: 'center',
            width: 50,

            renderCell: params => {
                switch (params.value) {
                    case kFeedbackResponse.Acknowledged:
                        return (
                            <Tooltip title="The feedback has been acknowledged">
                                <MoreHorizIcon color="success" fontSize="small" />
                            </Tooltip>
                        );

                    case kFeedbackResponse.Archived:
                        return (
                            <Tooltip title="The feedback is archived">
                                <MoreHorizIcon color="disabled" fontSize="small" />
                            </Tooltip>
                        );

                    case kFeedbackResponse.Declined:
                        return (
                            <Tooltip title="Feedback has been declined">
                                <ThumbDownOffAltIcon color="error" fontSize="small" />
                            </Tooltip>
                        );

                    case kFeedbackResponse.Resolved:
                        return (
                            <Tooltip title="Feedback has been resolved">
                                <ThumbUpOffAltIcon color="success" fontSize="small" />
                            </Tooltip>
                        );
                }

                return (
                    <Tooltip title="The feedback is pending">
                        <MoreHorizIcon color="warning" fontSize="small" />
                    </Tooltip>
                );
            },
        }
    ];

    return <RemoteDataTable columns={columns} endpoint="/api/admin/organisation/feedback"
                            enableQueryParams defaultSort={{ field: 'date', sort: 'desc' }}
                            pageSize={50} />;
}
