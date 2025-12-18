// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';

import { type Content, getStaticContent } from '@lib/Content';
import { FormProvider } from '@components/FormProvider';
import { FormSubmitButton } from '@components/FormSubmitButton';
import { Markdown } from '@components/Markdown';
import { RefundConfirmation } from './RefundConfirmation';
import { RefundRequest } from './RefundRequest';
import { Temporal, formatDate } from '@lib/Temporal';
import { generatePortalMetadataFn } from '../../../../generatePortalMetadataFn';
import { getApplicationContext } from '../getApplicationContext';
import db, { tEvents, tRefunds } from '@lib/database';

import * as actions from '../../ApplicationActions';

/**
 * The <EventApplicationRefundPage> component allows volunteers to request a refund for their ticket
 * after the event has finished. Availability of this page is time limited.
 */
export default async function EventApplicationRefundPage(
    props: PageProps<'/registration/[slug]/application/[team]/refund'>)
{
    const { event, team, user } = await getApplicationContext(props);

    const dbInstance = db;

    // ---------------------------------------------------------------------------------------------
    // Determine whether the signed in user already has (requested) a refund.
    // ---------------------------------------------------------------------------------------------

    const refund = await dbInstance.selectFrom(tRefunds)
        .where(tRefunds.userId.equals(user.id))
            .and(tRefunds.eventId.equals(event.id))
        .select({
            ticketNumber: tRefunds.refundTicketNumber,
            accountIban: tRefunds.refundAccountIban,
            accountName: tRefunds.refundAccountName,

            requested: dbInstance.dateTimeAsString(tRefunds.refundRequested),
            confirmed: dbInstance.dateTimeAsString(tRefunds.refundConfirmed),
        })
        .executeSelectNoneOrOne() ?? undefined;

    // ---------------------------------------------------------------------------------------------
    // Determine the state of the refund mechanism within the defined availability window.
    // ---------------------------------------------------------------------------------------------

    let state: 'available' | 'requested' | 'too-early' | 'too-late' | 'unavailable';
    let content: Content | undefined;

    const refundAvailability = await dbInstance.selectFrom(tEvents)
        .where(tEvents.eventId.equals(event.id))
        .select({
            refundRequestsStart: tEvents.refundRequestsStart,
            refundRequestsEnd: tEvents.refundRequestsEnd,
        })
        .executeSelectOne();

    const contentPath = [ 'registration', 'application' ];

    if (!refundAvailability.refundRequestsStart || !refundAvailability.refundRequestsEnd) {
        state = 'unavailable';
        content = await getStaticContent([ ...contentPath, 'refund-unavailable' ], {
            event: event.shortName,
            firstName: user.nameOrFirstName,
        });
    } else {
        const { refundRequestsStart, refundRequestsEnd } = refundAvailability;

        const substitutions = {
            event: event.shortName,
            firstName: user.nameOrFirstName,
            refundRequestsStart: formatDate(refundRequestsStart, 'dddd, MMMM D'),
            refundRequestsEnd: formatDate(refundRequestsEnd, 'dddd, MMMM D'),
        };

        const now = Temporal.Now.zonedDateTimeISO('UTC');

        if (!!refund) {
            state = 'requested';
            content = await getStaticContent([ ...contentPath, 'refund' ], substitutions);
        } else if (Temporal.ZonedDateTime.compare(now, refundRequestsStart) < 0) {
            state = 'too-early';
            content = await getStaticContent([ ...contentPath, 'refund-early' ], substitutions);
        } else if (Temporal.ZonedDateTime.compare(now, refundRequestsEnd) > 0) {
            state = 'too-late';
            content = await getStaticContent([ ...contentPath, 'refund-late' ], substitutions);
        } else {
            state = 'available';
            content = await getStaticContent([ ...contentPath, 'refund' ], substitutions);
        }
    }

    // ---------------------------------------------------------------------------------------------

    const action = actions.requestRefund.bind(null, event.id);

    return (
        <Box sx={{ p: 2 }}>
            { content && <Markdown>{content.markdown}</Markdown> }

            <Collapse in={!!refund} unmountOnExit>
                <RefundConfirmation refund={refund} />
            </Collapse>

            { (!!refund || state === 'available') &&
                <FormProvider action={action} defaultValues={refund}>
                    <RefundRequest readOnly={state !== 'available'} />
                    { state === 'available' &&
                        <FormSubmitButton callToAction="Request a ticket refund"
                                          startIcon={ <MonetizationOnIcon /> } sx={{ mt: 2 }} /> }
                </FormProvider> }

            <Box sx={{ pt: 2 }}>
                <MuiLink component={Link}
                         href={`/registration/${event.slug}/application/${team.slug}`}>
                    « Back to your registration
                </MuiLink>
            </Box>

        </Box>
    );
}

export const generateMetadata = generatePortalMetadataFn('Ticket refunds');
