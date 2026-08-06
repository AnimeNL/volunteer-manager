// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { forbidden, notFound } from 'next/navigation';

import { default as MuiLink } from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import Grid from '@mui/material/Grid';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { KeyValueList } from '@app/admin/components/KeyValueList';
import { Section } from '@app/admin/components/Section';
import { SectionHeader } from '@app/admin/components/SectionHeader';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { requireAuthenticationContextWithEvent } from '../../../requireAuthenticationContextWithEvent';

/**
 * Page that provides insight in the ticket granted to an individual external to our team.
 */
export default async function EventTicketsExternalPage(
    props: PageProps<'/admin/events/[event]/tickets/externals/[id]'>)
{
    const { access, event } = await requireAuthenticationContextWithEvent(props, {
        permission: 'event.tickets',
        operation: 'read',
    });

    const params = await props.params;

    const service = await createTicketService(event.slug);

    const purchase = await service?.fetchPurchase(params.id);
    if (!purchase || !service)
        notFound();

    const containsVolunteerTicket = purchase.tickets.some(
        ticket => `${ticket.ticketId}` === event.tickets?.volunteerTicketId);

    if (!containsVolunteerTicket && !access.can('root'))
        forbidden();

    const purchaseLink = service.createPurchaseLink(params.id) || '#';

    return (
        <>
            <Section icon={ <LocalActivityOutlinedIcon color="primary" /> } title="Purchase"
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Tickets', href: `/admin/events/${event.slug}/tickets` },
                        {
                            label: 'Externals',
                            href: `/admin/events/${event.slug}/tickets/externals`,
                        },
                        { label: `REF${params.id}` },
                     ]}>
                <SectionIntroduction>
                    Information about the ticket{purchase.tickets.length === 1 ? '' : 's'} issued
                    as part of purchase REF{params.id} for {event.shortName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader back tabs>
                { !containsVolunteerTicket &&
                    <Alert severity="warning" variant="outlined">
                        This purchase does not contain any volunteer tickets.
                    </Alert> }
                <KeyValueList items={[
                    {
                        key: 'Purchase ID',
                        valueTemplate: 'component',
                        value: (
                            <Typography variant="body2">
                                {purchase.id}
                                <MuiLink component={Link} href={purchaseLink} target="_blank">
                                    <OpenInNewIcon fontSize="inherit" sx={{
                                        position: 'relative',
                                        left: '6px',
                                        top: '2px',
                                    }} />
                                </MuiLink>
                            </Typography>
                        ),
                    },
                    {
                        condition: !!purchase.paid,
                        key: 'Paid',
                        valueTemplate: 'localDateTime',
                        value: purchase.paid?.toString(),
                    },
                    {
                        condition: !!purchase.cancelled,
                        key: 'Cancelled',
                        valueTemplate: 'localDateTime',
                        value: purchase.cancelled?.toString(),
                    }
                ]} />
            </Section>
            <Grid container spacing={1.5}>
                { purchase.tickets.map(ticket =>
                    <Grid key={ticket.id} size={{ xs: 12, md: 6, lg: 4 }}>
                        <Paper component={Stack} sx={{ p: 2 }} spacing={1.5}>
                            <SectionHeader icon={ <ConfirmationNumberOutlinedIcon /> }
                                           title={ ticket.holder || 'Unclaimed ticket' } />
                            { !!ticket.ticketName &&
                                <Typography variant="subtitle2" noWrap>
                                    {ticket.ticketName}
                                </Typography> }
                            { /* TODO: QR code */ }
                        </Paper>
                    </Grid> )}

            </Grid>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ param: 'id', prefix: 'REF' }, 'Externals', 'Tickets',
                             { event: 'event' });
