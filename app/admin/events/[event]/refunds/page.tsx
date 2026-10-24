// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import IconButton from '@mui/material/IconButton';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import ShareIcon from '@mui/icons-material/Share';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';

import type { Column, ExtractRowModel } from '@app/admin/components/DataTable';
import { AvailabilityToggle } from '@app/admin/components/AvailabilityToggle';
import { AvailabilityWindow } from '@app/admin/components/AvailabilityWindow';
import { BooleanCell, BooleanHeader } from '@app/admin/components/DataTable/cells/BooleanCell';
import { DataTable, createDataSource, withContext, withRowModel } from '@app/admin/components/DataTable';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { LogBuilder } from '@lib/log/index';
import { PrivacyIconButton } from '../[team]/volunteers/[volunteer]/preferences/PrivacyIconButton';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tEvents, tRefunds, tTeams, tUsers, tUsersEvents, tUsersEventsPreferencesRefunds } from '@lib/database';

import { kEventTransformer } from '@app/admin/components/DataTable';
import { kRegistrationStatus } from '@lib/database/Types';

import { updateRefundConfiguration } from './RefundsActions';

/**
 * Data source for refund requests made for an event.
 */
const eventRefundsDataSource = createDataSource('admin/event/refunds', withContext({
    /**
     * Event for which refund requests are being managed.
     */
    event: kEventTransformer,

}), withRowModel({
    /**
     * Unique ID of the user who requested a refund.
     */
    id: z.number(),

    /**
     * Name of the volunteer who requested a refund.
     */
    name: z.string(),

    /**
     * Team slug of the requester, used to linkify their entry.
     */
    team: z.string(),

    /**
     * Ticket number the volunteer purchased, which should be refunded.
     */
    ticketNumber: z.string().optional(),

    /**
     * IBAN of the account to which the refund should be issued.
     */
    accountIban: z.string(),

    /**
     * Name on the account to which the refund should be issued.
     */
    accountName: z.string(),

    /**
     * Full ISO date and time on which the refund had been requested.
     */
    requested: z.string(),

    /**
     * Whether the refund has been confirmed.
     */
    confirmed: z.boolean(),

}), {
    async authorize(operation, props, context) {
        executeAccessCheck(props.authenticationContext, {
            permission: 'volunteers.refunds',
            scope: {
                event: context.event.slug,
            },
        });
    },

    async list(params, props, context) {
        if (!context.event.flags.enableRefunds)
            notFound();

        const refundsJoin = tRefunds.forUseInLeftJoin();

        const dbInstance = db;
        const refunds = await dbInstance.selectFrom(tUsersEventsPreferencesRefunds)
            .innerJoin(tUsersEvents)
                .on(tUsersEvents.eventId.equals(tUsersEventsPreferencesRefunds.eventId))
                    .and(tUsersEvents.userId.equals(tUsersEventsPreferencesRefunds.userId))
                    .and(tUsersEvents.registrationStatus.in([
                        kRegistrationStatus.Accepted,
                        kRegistrationStatus.Cancelled,
                    ]))
            .innerJoin(tTeams)
                .on(tTeams.teamId.equals(tUsersEvents.teamId))
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tUsersEventsPreferencesRefunds.userId))
            .leftJoin(refundsJoin)
                .on(refundsJoin.eventId.equals(tUsersEventsPreferencesRefunds.eventId))
                    .and(refundsJoin.userId.equals(tUsersEventsPreferencesRefunds.userId))
            .where(tUsersEventsPreferencesRefunds.eventId.equals(context.event.id))
                .and(tUsersEventsPreferencesRefunds.preferenceVersionIsLatest.equals(/* true= */ 1))
            .select({
                id: tUsersEventsPreferencesRefunds.userId,
                name: tUsers.name,
                team: tTeams.teamSlug,
                ticketNumber: tUsersEventsPreferencesRefunds.refundTicketNumber,
                accountIban: tUsersEventsPreferencesRefunds.refundAccountIban,
                accountName: tUsersEventsPreferencesRefunds.refundAccountName,
                requested:
                    dbInstance.dateTimeAsString(tUsersEventsPreferencesRefunds.preferenceVersion),
                confirmed: refundsJoin.refundConfirmed.isNotNull(),
            })
            .groupBy(tUsersEventsPreferencesRefunds.userId)
            .orderBy('confirmed', 'asc')
                .orderBy('name', 'asc')
            .executeSelectPage();

        return {
            rowCount: refunds.count,
            rows: refunds.data.map(refund => ({
                ...refund,
                confirmed: !!refund.confirmed,
            })),
        };
    },

    async update(updatedRow, previousRow, props, context) {
        if (!context.event.flags.enableRefunds)
            notFound();

        const dbInstance = db;
        const refundConfirmed = updatedRow.confirmed ? dbInstance.currentZonedDateTime() : null;

        const affectedRows = await dbInstance.insertInto(tRefunds)
            .set({
                userId: updatedRow.id,
                eventId: context.event.id,
                refundTicketNumber: updatedRow.ticketNumber,
                refundAccountIban: updatedRow.accountIban,
                refundAccountName: updatedRow.accountName,
                refundConfirmed,
            })
            .onConflictDoUpdateSet({
                refundConfirmed,
            })
            .executeInsert();

        LogBuilder.for('UpdateRefundRequest')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withAffectedUser(updatedRow.id)
            .withSeverity('Warning')
            .record({
                event: context.event.shortName,
            });

        return !!affectedRows;
    },
});

/**
 * The <EventRefundsPage> page allows select volunteers who are both event administrators and have
 * access to the volunteering refunds to see the overview of requested refunds for a given event.
 */
export default async function EventRefundsPage(props: PageProps<'/admin/events/[event]/refunds'>) {
    const { access, event } = await requireAuthenticationWithEvent(props, 'volunteers.refunds');
    if (!event.flags.enableRefunds)
        notFound();

    const dbInstance = db;
    const defaultValues = await dbInstance.selectFrom(tEvents)
        .where(tEvents.eventId.equals(event.id))
        .select({
            refundInformationPublished: tEvents.refundInformationPublished,
            refundRequestsStart: dbInstance.dateTimeAsString(tEvents.refundRequestsStart),
            refundRequestsEnd: dbInstance.dateTimeAsString(tEvents.refundRequestsEnd),
        })
        .projectingOptionalValuesAsNullable()
        .executeSelectNoneOrOne() ?? undefined;

    const action = updateRefundConfiguration.bind(null, event.slug);

    const columns: Column<ExtractRowModel<typeof eventRefundsDataSource>>[] = [
        {
            field: 'name',
            headerName: 'Volunteer',
            sortable: false,
            editable: false,
            flex: 1,

            template: 'text',
            templateProps: {
                href: './{team}/volunteers/{id}/preferences',
            },
        },
        {
            field: 'ticketNumber',
            headerName: 'Ticket',
            sortable: false,
            editable: false,
            flex: 1,

            template: 'text',
        },
        {
            field: 'accountIban',
            headerName: 'Account (IBAN)',
            sortable: false,
            editable: false,
            flex: 1,

            template: 'text',
        },
        {
            field: 'accountName',
            headerName: 'Account (name)',
            sortable: false,
            editable: false,
            flex: 1,

            template: 'text',
        },
        {
            field: 'requested',
            headerName: 'Requested',
            sortable: false,
            editable: false,
            width: 185,

            template: 'date',
            templateProps: {
                format: 'YYYY-MM-DD HH:mm:ss',
            },
        },
        {
            field: 'confirmed',
            headerName: 'Confirmed',
            headerAlign: 'center',
            align: 'center',
            sortable: false,
            editable: true,
            type: 'boolean',
            width: 50,

            template: 'component',
            templateProps: {
                component: BooleanCell,
                componentContext: {
                    field: 'confirmed',
                    tooltips: {
                        header: 'Has the refund been confirmed?',
                        falsyValue: 'Refund has not been confirmed',
                        truthyValue: 'Refund has been confirmed',
                    },
                },
                headerComponent: BooleanHeader,
            },
        },
    ];

    return (
        <>
            <Section icon={ <MonetizationOnIcon color="primary" /> } title="Refund requests"
                     breadcrumbs={[
                         { label: event.shortName, href: `/admin/events/${event.slug}` },
                         { label: 'Refunds' },
                     ]}
                     headerAction={
                         <Stack direction="row" spacing={1}>
                             <PrivacyIconButton />
                             { access.can('organisation.exports') &&
                                 <Tooltip title="Export refund requests">
                                     <IconButton LinkComponent={Link}
                                                 href="/admin/organisation/exports/create"
                                                 size="small">
                                         <ShareIcon fontSize="small" />
                                     </IconButton>
                                 </Tooltip> }
                         </Stack>
                     }>
                <SectionIntroduction>
                    Volunteers can request their ticket to be refunded, which involves sharing
                    financial information. Access to these requests and settings is{' '}
                    <strong>need to know</strong>.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <DataTable columns={columns} source={eventRefundsDataSource}
                           context={{ event: event.slug }}
                           defaultSort={{ field: 'name', sort: 'asc' }}
                           disableFooter pageSize={100} subject="refund request"
                           listViewProps={{
                               primaryField: 'name',
                               secondaryTemplate: '{accountName} · {accountIban}',
                               startComponent: BooleanCell,
                               startComponentContext: { field: 'confirmed' },
                               linkTemplate: './{team}/volunteers/{id}/preferences',
                           }} />
            </Section>
            <FormGridSection icon={ <SettingsSuggestIcon /> } title="Refund configuration"
                             action={action} defaultValues={defaultValues}
                             timezone={event.timeZone}>
                <SectionIntroduction grid>
                    This section enables you to set the timeframe for accepting refund requests,
                    and to decide if this information should be publicly available.
                </SectionIntroduction>
                <AvailabilityToggle label="Publish information" name="refundInformationPublished" />
                <AvailabilityWindow label="Accept requests" start="refundRequestsStart"
                                    end="refundRequestsEnd" timezone={event.timeZone} />
            </FormGridSection>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Refunds', { event: 'event' });
