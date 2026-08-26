// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
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
import ContactMailOutlinedIcon from '@mui/icons-material/ContactMailOutlined';
import IconButton from '@mui/material/IconButton';
import PendingOutlinedIcon from '@mui/icons-material/PendingOutlined';
import Stack from '@mui/material/Stack';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

import type { RetentionRowModel } from './page';
import type { ServerActionResult } from '@lib/serverAction';
import { CommunicationIconButton } from '@app/admin/components/CommunicationDialog';
import { ResponsiveFormDialog } from '@app/admin/components/ResponsiveFormDialog';

import { sendRetentionWhatsApp } from './RetentionActions';

/**
 * Context passed to retention cells.
 */
export interface RetentionCellContext {
    /**
     * Slug of the current event.
     */
    event: string;

    /**
     * Unique ID of the current event.
     */
    eventId: number;

    /**
     * Short name of the event.
     */
    eventName: string;

    /**
     * Leaders who can be assigned.
     */
    leaders: string[];

    /**
     * Server Action to invoke when sending an e-mail.
     */
    sendEmailFn: (userId: number, subject?: string, message?: string) => Promise<ServerActionResult>;

    /**
     * Slug of the current team.
     */
    team: string;

    /**
     * Unique ID of the current team.
     */
    teamId: number;

    /**
     * The link to include in the WhatsApp reminder.
     */
    whatsAppLink: string;

    /**
     * The template message to include in the WhatsApp reminder.
     */
    whatsAppMessage: string;
}

/**
 * Cell visualising the volunteer and appropriate links.
 */
export function RetentionVolunteerCell(props: {
    context?: RetentionCellContext;
    row: RetentionRowModel;
}) {
    let href = `/admin/events/${props.context?.event}/`;
    switch (props.row.status) {
        case 'Applied':
            href += `${props.row.statusTeam}/applications`;
            break;

        case 'Retained':
            href += `${props.row.statusTeam}/volunteers/${props.row.id}`;
            break;

        default: {
            const accountHref = `/admin/organisation/accounts/${props.row.userIdForAccountLink}`;
            return (
                <>
                    <Typography component="span" variant="body2" sx={{ color: 'action.active' }}>
                        {props.row.name}
                    </Typography>
                    { !!props.row.userIdForAccountLink &&
                        <MuiLink component={Link} href={accountHref} sx={{ ml: 0.75 }}>
                            <AccountCircleOutlinedIcon color="info" fontSize="inherit"
                                                       sx={{ mt: 0.65 }} />
                        </MuiLink> }
                </>
            );
        }
    }

    return (
        <MuiLink component={Link} href={href}>
            {props.row.name}
        </MuiLink>
    );
}

/**
 * Cell visualising the most recent event the volunteer participated in.
 */
export function RetentionLatestEventCell(props: {
    context?: RetentionCellContext;
    row: RetentionRowModel;
}) {
    const href = `/admin/events/${props.row.latestEventSlug}/${props.context?.team}/volunteers/` +
                 `${props.row.id}`;

    return (
        <>
            <MuiLink component={Link} href={href}>
                {props.row.latestEvent}
            </MuiLink>
            { !!props.row.latestEventDidCancel &&
                <Tooltip title="Their participation was cancelled">
                    <CancelOutlinedIcon color="warning" fontSize="inherit" sx={{ ml: 0.75 }} />
                </Tooltip> }
        </>
    );
}

/**
 * Cell visualising the retention status of a volunteer for mobile devices.
 */
export function RetentionStatusMobileCell(props: { row: RetentionRowModel }) {
    switch (props.row.status) {
        case 'Unknown':
            return <PendingOutlinedIcon color="disabled" />;

        case 'Contacting':
            return <ContactMailOutlinedIcon color="warning" />;

        case 'Declined':
            return <ThumbDownOutlinedIcon color="error" />;

        case 'Applied':
        case 'Retained':
            return <ThumbUpOutlinedIcon color="success" />;

        default:
            throw new Error(`Unrecognised retention status: ${props.row.status}`);
    }
}

/**
 * Cell visualising the retention status of a volunteer.
 */
export function RetentionStatusCell(props: { row: RetentionRowModel }) {
    let color: 'success' | 'warning' | 'error' | undefined = undefined;
    let explanation: string = '';

    switch (props.row.status) {
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

        default:
            throw new Error(`Unrecognised retention status: ${props.row.status}`);
    }

    return (
        <Tooltip title={explanation}>
            <Chip size="small" label={props.row.status} color={color} />
        </Tooltip>
    );
}

/**
 * Cell with actions (e-mail & WhatsApp) for a volunteer.
 */
export function RetentionActionsCell(props: {
    context?: RetentionCellContext;
    row: RetentionRowModel;
}) {
    const [ whatsAppOpen, setWhatsAppOpen ] = useState<boolean>(false);
    const [ whatsAppSuccessLink, setWhatsAppSuccessLink ] = useState<string | undefined>();

    const router = useRouter();

    const handleWhatsAppClose = useCallback(() => setWhatsAppOpen(false), [ ]);
    const handleWhatsAppOpen = useCallback(() => {
        setWhatsAppSuccessLink(undefined);
        setWhatsAppOpen(true);
    }, []);

    const handleWhatsAppSubmit = useCallback(async (data: { message: string }) => {
        if (!props.context)
            return { success: false, error: 'Context is missing.' };

        const result = await sendRetentionWhatsApp(
            props.context.event, props.context.team, props.row.id, data);

        if (!result.success || !result.phoneNumber)
            return { success: false, error: result.error ?? 'Could not record your action' };

        router.refresh();

        const params = new URLSearchParams();
        params.set('text', data.message);

        const link = `https://wa.me/${result.phoneNumber.replace(/^\+/, '')}?${params.toString()}`;
        setWhatsAppSuccessLink(link);

        return {
            success: true,
            message: 'Message prepared! Click the link below to open WhatsApp.',
        };

    }, [ props.context, props.row.id, router ]);

    if (props.row.status !== 'Unknown' && props.row.status !== 'Contacting')
        return '···';

    const defaultMessage = (props.context?.whatsAppMessage ?? '')
        .replaceAll('{name}', props.row.firstName)
        .replaceAll('{link}', props.context?.whatsAppLink ?? '');

    return (
        <>
            <Stack direction="row" sx={{ alignItems: 'center' }}>
                <CommunicationIconButton
                    title={`Invite ${props.row.firstName} to volunteer again`}
                    badge={ props.row.status === 'Contacting' ? 'check' : 'none' }
                    disableSilent
                    action={props.context?.sendEmailFn.bind(null, props.row.id) ?? (async () => ({
                        success: false,
                        error: 'Action not available',
                    }))}
                    recipientId={props.row.id} language={props.row.language}
                    promptId="participation-reminder"
                    promptParams={{
                        eventId: props.context?.eventId ?? 0,
                        teamId: props.context?.teamId ?? 0,
                    }}>
                    Send an e-mail to <strong>{props.row.firstName}</strong> to invite them
                    to help out with {props.context?.eventName}.
                </CommunicationIconButton>
                <IconButton size="small" onClick={handleWhatsAppOpen}>
                    <WhatsAppIcon color="success" fontSize="inherit" />
                </IconButton>
            </Stack>

            <ResponsiveFormDialog
                open={whatsAppOpen}
                onClose={handleWhatsAppClose}
                onSubmit={handleWhatsAppSubmit}
                title={`Invite ${props.row.name} to volunteer again`}
                submitLabel="Reach out"
                defaultValues={{ message: defaultMessage }}>
                <Typography variant="body2" sx={{ mb: 2 }}>
                    You are preparing a WhatsApp message to <strong>{props.row.name}</strong>,
                    inviting them to help out again at the upcoming event.
                </Typography>
                <TextFieldElement name="message" label="Message" required multiline fullWidth
                                  size="small" />
                { !!whatsAppSuccessLink &&
                    <Typography variant="body2" sx={{ mt: 2 }}>
                        <strong>Now click on this link! </strong>
                        <MuiLink href={whatsAppSuccessLink} target="_blank"
                                 rel="noopener noreferrer">
                            Send a WhatsApp message
                        </MuiLink>
                    </Typography> }
            </ResponsiveFormDialog>
        </>
    );
}
