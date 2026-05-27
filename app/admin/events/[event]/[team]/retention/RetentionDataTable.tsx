// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { TextFieldElement } from '@proxy/react-hook-form-mui';

import { default as MuiLink } from '@mui/material/Link';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

import type { ServerActionResult } from '@lib/serverAction';

import type { RetentionContext, RetentionRowModel } from '@app/api/admin/retention/[[...id]]/route';
import { CommunicationIconButton } from '@app/admin/components/CommunicationDialog';
import { RemoteDataTable, type RemoteDataTableColumn } from '@app/admin/components/RemoteDataTable';
import { SettingDialog } from '@app/admin/components/SettingDialog';

/**
 * Props accepted by the <RetentionDataTable> component.
 */
export type RetentionDataTableProps = RetentionContext & {
    /**
     * Unique ID of the event to display retention for.
     */
    eventId: number;

    /**
     * Short name of the event.
     */
    eventName: string;

    /**
     * Unique ID of the team to display retention for.
     */
    teamId: number;

    /**
     * Leaders to whom a retention action can be assigned.
     */
    leaders: string[];

    /**
     * Whether updates to the table are prohibited.
     */
    readOnly: boolean;

    /**
     * The link to the event that should be included in the WhatsApp message.
     */
    whatsAppLink: string;

    /**
     * The message that should be send over WhatsApp. {name} and {link} are placeholders that will
     * be substituted with actual useful values.
     */
    whatsAppMessage: string;

    /**
     * Server Action to invoke when an e-mail should be sent.
     */
    sendEmailFn: (userId: number, subject?: string, message?: string) => Promise<any>;

    /**
     * Server Action to invoke when a WhatsApp message was sent.
     */
    sendWhatsAppFn: (userId: number, message: string) => Promise<ServerActionResult>;
};

/**
 * The <RetentionDataTable> component displays a remote data table with the volunteers who might be
 * interested in joining this event. It combines multi-event and multi-team participation, and
 * reaching out to particular volunteers can be claimed by any of the seniors.
 */
export function RetentionDataTable(props: RetentionDataTableProps) {
    const [ whatsAppOpen, setWhatsAppOpen ] = useState<boolean>(false);
    const [ whatsAppTarget, setWhatsAppTarget ] = useState<RetentionRowModel | undefined>();
    const [ whatsAppMessage, setWhatsAppMessage ] = useState<Record<string, string>>({});

    const router = useRouter();

    const columns: RemoteDataTableColumn<RetentionRowModel>[] = [
        {
            display: 'flex',
            field: 'name',
            headerName: 'Volunteer',
            editable: false,
            sortable: false,
            flex: 2,

            renderCell: params => {
                let href = `/admin/events/${props.event}/`;

                switch (params.row.status) {
                    case 'Applied':
                        href += `${params.row.statusTeam}/applications`;
                        break;

                    case 'Retained':
                        href += `${params.row.statusTeam}/volunteers/${params.row.id}`;
                        break;

                    default: {
                        const accountHref =
                            `/admin/organisation/accounts/${params.row.userIdForAccountLink}`;

                        return (
                            <>
                                <Typography component="span" variant="body2"
                                            sx={{ color: 'action.active' }}>
                                    {params.value}
                                </Typography>
                                { params.row.userIdForAccountLink &&
                                    <MuiLink component={Link} href={accountHref} sx={{ ml: 0.5 }}>
                                        <AccountCircleOutlinedIcon color="info" fontSize="inherit"
                                                                   sx={{ mt: 0.65 }} />
                                    </MuiLink> }
                            </>
                        );
                    }
                }

                return (
                    <MuiLink component={Link} href={href}>
                        {params.value}
                    </MuiLink>
                );
            },
        },
        {
            display: 'flex',
            field: 'latestEvent',
            headerName: 'Latest event',
            editable: false,
            sortable: false,
            flex: 2,

            renderCell: params => {
                const href =
                    `/admin/events/${params.row.latestEventSlug}/${props.team}/volunteers/` +
                    `${params.row.id}`;

                return (
                    <>
                        <MuiLink component={Link} href={href}>
                            {params.value}
                        </MuiLink>
                        { params.row.latestEventDidCancel &&
                                <Tooltip title="Their participation was cancelled">
                                    <CancelOutlinedIcon color="warning" fontSize="inherit"
                                                        sx={{ ml: 0.75 }} />
                                </Tooltip> }
                    </>
                );
            },
        },
        {
            field: 'status',
            headerName: 'Status',
            editable: true,
            sortable: false,
            flex: 1,

            type: 'singleSelect',
            valueOptions: [ 'Unknown', 'Contacting', 'Declined' ],

            renderCell: params => {
                let color: 'success' | 'warning' | 'error' | undefined = undefined;
                let explanation: string = '';

                switch (params.value) {
                    case 'Unknown':
                        explanation = 'They have not been contacted yet';
                        break;

                    case 'Contacting':
                        color = 'warning';
                        explanation = 'Someone is contacting them';
                        break;

                    case 'Declined':
                        color = 'error';
                        explanation = 'They cannot help out this time';
                        break;

                    case 'Applied':
                        color = 'success';
                        explanation = 'They have applied to help out again!';
                        break;

                    case 'Retained':
                        color = 'success';
                        explanation = 'They are helping out again!';
                        break;
                }

                return (
                    <Tooltip title={explanation}>
                        <Chip size="small" label={params.value} color={color} />
                    </Tooltip>
                );
            },
        },
        {
            display: 'flex',
            field: 'assigneeName',
            headerName: 'Assignee',
            editable: true,
            sortable: false,
            flex: 2,

            type: 'singleSelect',
            valueOptions: [ ' ', ...props.leaders ],

            renderCell: params => {
                if (!!params.value)
                    return params.value;

                return (
                    <Typography component="span" variant="body2"
                                sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                        Unassigned
                    </Typography>
                );
            }
        },
        {
            display: 'flex',
            field: 'firstName',
            headerName: 'Actions',
            editable: false,
            sortable: false,
            width: 85,

            renderCell: params => {
                if (params.row.status !== 'Unknown')
                    return '···';

                const openWhatsAppDialog = () => {
                    setWhatsAppTarget(params.row);
                    setWhatsAppMessage({
                        message: props.whatsAppMessage.replaceAll('{name}', params.row.firstName)
                                                      .replaceAll('{link}', props.whatsAppLink)
                    });
                    setWhatsAppOpen(true);
                };

                return (
                    <Stack direction="row" sx={{ alignItems: 'center' }}>
                        <CommunicationIconButton
                            title={ `Invite ${params.row.firstName} to volunteer again` }
                            disableSilent
                            action={ props.sendEmailFn.bind(null, params.row.id) }
                            recipientId={params.row.id}
                            promptId="participation-reminder"
                            promptParams={{
                                eventId: props.eventId,
                                teamId: props.teamId
                            }}>

                            Send an e-mail to <strong>{params.row.firstName}</strong> to invite them
                            to help out with {props.eventName}.

                        </CommunicationIconButton>
                        <IconButton size="small" onClick={openWhatsAppDialog}>
                            <WhatsAppIcon color="success" fontSize="inherit" />
                        </IconButton>
                    </Stack>
                );
            },
        },
        {
            field: 'notes',
            headerName: 'Notes',
            editable: true,
            sortable: false,
            flex: 3,

            renderCell: params => {
                if (!!params.value)
                    return params.value;

                return (
                    <Typography component="span" variant="body2"
                                sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                        …
                    </Typography>
                );
            }
        }
    ];

    const handleWhatsAppClose = useCallback(() => setWhatsAppOpen(false), [ /* no deps */ ]);
    const handleWhatsAppSubmit = useCallback(async (data: Record<string, string>) => {
        if (!Object.hasOwn(data, 'message') || !data.message.length)
            return { error: 'Something went wrong, and no message was available to send.' };

        if (!whatsAppTarget)
            return { error: 'Something went wrong, and no recipient was available.' };

        const result = await props.sendWhatsAppFn(whatsAppTarget.id, data.message);

        if (!result.success || !result.phoneNumber)
            return { error: result.error ?? 'Something went wrong, the message could not be send' };

        router.refresh();

        const params = new URLSearchParams();
        params.set('text', data.message);

        const link = `https://wa.me/${result.phoneNumber.replace(/^\+/, '')}?${params.toString()}`;

        return {
            success:
                <>
                    <strong>Now click on this link! </strong>
                    <MuiLink href={link} target="_blank" rel="noopener noreferrer">
                        Send a WhatsApp message
                    </MuiLink>
                </>
        };

    }, [ whatsAppTarget, props.sendWhatsAppFn, router ]);

    return (
        <>
            <RemoteDataTable columns={columns} endpoint="/api/admin/retention"
                             enableUpdate={!props.readOnly}
                             context={{ event: props.event, team: props.team }} refreshOnUpdate
                             defaultSort={{ field: 'id', sort: 'asc' }} pageSize={100}
                             disableFooter />

            <SettingDialog title={`Invite ${whatsAppTarget?.name} to volunteer again`}
                           open={whatsAppOpen} onClose={handleWhatsAppClose}
                           closeLabel="Cancel" submitLabel="Reach out"
                           defaultValues={whatsAppMessage} description={
                               <>
                                   You are preparing a WhatsApp message to
                                   <strong> {whatsAppTarget?.name}</strong>, inviting them to help
                                   out again at the upcoming event.
                               </>
                           } onSubmit={handleWhatsAppSubmit}>
                <TextFieldElement name="message" label="Message" required multiline fullWidth
                                  size="small" sx={{ mt: 2 }} />
            </SettingDialog>
        </>
    );
}
