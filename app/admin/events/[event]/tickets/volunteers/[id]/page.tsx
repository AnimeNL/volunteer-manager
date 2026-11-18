// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { SelectElement } from '@app/components/proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';

import { ActionBar } from '@app/admin/components/ActionBar';
import { CancelPurchaseQuickAction } from '../../associates/[id]/CancelPurchaseQuickAction';
import { FormGrid } from '@app/admin/components/FormGrid';
import { PurchaseDetails } from '../../PurchaseDetails';
import { QuickActionButton } from '@app/admin/components/QuickActionButton';
import { ResendConfirmationQuickAction } from '../../associates/[id]/ResendConfirmationQuickAction';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createTicketService } from '@lib/tickets';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';
import db, { tTeams, tUsers, tUsersEvents, tUsersEventsTickets } from '@lib/database';

import { cancelPurchase, disassociatePurchase, resendPurchaseConfirmation,
    updateVolunteerPrimaryTeam } from '../../TicketActions';

/**
 * Page that provides insight in the ticket granted for an individual volunteer. It provides options
 * to (re)issue the ticket, or to revoke it with a given reason.
 */
export default async function EventTicketsVolunteerPage(
    props: PageProps<'/admin/events/[event]/tickets/volunteers/[id]'>)
{
    const params = await props.params;
    const { access, event } = await requireAuthenticationWithEvent(props, {
        permission: 'volunteers.tickets',
        operation: 'read',
    });

    const userId = parseInt(params.id, /* radix= */ 10);
    if (!Number.isSafeInteger(userId))
        notFound();

    const dbInstance = db;

    const participation = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tUsersEvents.userId))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.userId.equals(userId))
        .select({
            user: {
                id: tUsers.userId,
                name: tUsers.name,
                firstName: tUsers.displayName.valueWhenNull(tUsers.firstName),
            },
        })
        .groupBy(tUsersEvents.userId)
        .executeSelectNoneOrOne();

    if (!participation)
        notFound();

    const teams = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
        .where(tUsersEvents.eventId.equals(event.id))
            .and(tUsersEvents.userId.equals(userId))
        .select({
            id: tTeams.teamId,
            label: tTeams.teamName,
            slug: tTeams.teamSlug,
            accepted: tUsersEvents.registrationStatus.equals('Accepted'),
        })
        .orderBy('label', 'asc')
        .executeSelectMany();

    const acceptedTeams = teams.filter(team => team.accepted);

    const service = await createTicketService(event.id);
    const ticketInfo = service
        ? (await service.listVolunteerTickets(event.id, [ userId ])).get(userId)
        : undefined;

    const purchaseId = ticketInfo?.purchaseId;
    const purchase = purchaseId && service ? await service.fetchPurchase(purchaseId) : undefined;

    const primaryTeamId = purchaseId
        ? await dbInstance.selectFrom(tUsersEventsTickets)
            .where(tUsersEventsTickets.userId.equals(userId))
                .and(tUsersEventsTickets.eventId.equals(event.id))
            .selectOneColumn(tUsersEventsTickets.teamIdPrimary)
            .executeSelectNoneOrOne()
        : undefined;

    // ---------------------------------------------------------------------------------------------

    const primaryTeamSlug =
        acceptedTeams.find(team => team.id === primaryTeamId)?.slug
            ?? acceptedTeams.at(0)?.slug
            ?? teams.at(0)?.slug;

    const canAccessVolunteer =
        !!primaryTeamSlug && access.can('volunteers.participation', 'read', {
            event: event.slug,
            team: primaryTeamSlug,
        });

    const ticketHolder = {
        name: participation.user.name,
        href: canAccessVolunteer
            ? `/admin/events/${event.slug}/${primaryTeamSlug}/volunteers/${participation.user.id}`
            : undefined,
    };

    const hasBeenCancelled = !!purchase?.cancelled || !!ticketInfo?.cancelled;

    const canDeleteTickets = access.can('volunteers.tickets', 'delete', { event: event.slug });
    const canUpdateTickets = access.can('volunteers.tickets', 'update', { event: event.slug });
    const canCancelPurchases = !!service?.canCancelPurchases() && canDeleteTickets;

    const cancelPurchaseFn =
        canCancelPurchases && !!purchaseId
            ? cancelPurchase.bind(null, event.slug, purchaseId)
            : undefined!;

    const disassociateFn =
        canUpdateTickets ? disassociatePurchase.bind(null, event.slug, participation.user.id)
                         : undefined!;

    const resendConfirmationFn =
        canUpdateTickets && !!purchaseId
            ? resendPurchaseConfirmation.bind(null, event.slug, purchaseId)
            : undefined!;

    const updatePrimaryTeamFn =
        canUpdateTickets ? updateVolunteerPrimaryTeam.bind(null, event.slug, participation.user.id)
                         : undefined!;

    const disassociateAction = canUpdateTickets && (
        <QuickActionButton
            action={disassociateFn}
            icon={ <PersonRemoveOutlinedIcon /> }
            label="Disassociate"
            submitLabel="Disassociate"
            title="Disassociate this ticket?"
            description={
                <>
                    This action will return the ticket to the{' '}
                    <em>associate</em> pool—it may continue to be valid for
                    entry, but won't be associated with this volunteer anymore.
                </>
            } />
    );

    return (
        <>
            <Section icon={ <LocalActivityOutlinedIcon color="primary" /> } title="Tickets"
                     documentation="event/tickets" limited={!canUpdateTickets || !canDeleteTickets}
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Tickets', href: `/admin/events/${event.slug}/tickets` },
                        {
                            label: 'Volunteers',
                            href: `/admin/events/${event.slug}/tickets/volunteers`,
                        },
                        { label: participation.user.name },
                     ]}>
                <SectionIntroduction>
                    Information about any tickets issued to {participation.user.name} for{' '}
                    {event.shortName}.
                </SectionIntroduction>
            </Section>
            { !purchaseId &&
                <Section noHeader back tabs>
                    <Alert severity="warning" variant="outlined">
                        {participation.user.firstName} has not been issued a ticket for{' '}
                        {event.shortName} yet.
                    </Alert>
                </Section> }
            { (!!purchaseId && (!service || !purchase)) &&
                <Section noHeader back tabs>
                    <Alert severity="error" variant="outlined">
                        The ticket issued to {participation.user.firstName} could not be loaded from
                        the ticketing provider.
                        { canUpdateTickets && ' You can disassociate their ticket below.' }
                    </Alert>
                    { canUpdateTickets &&
                        <ActionBar>
                            {disassociateAction}
                        </ActionBar> }
                </Section> }
            { (!!purchase && !!service) &&
                <PurchaseDetails
                    event={event}
                    purchase={purchase}
                    service={service}
                    readOnly
                    ticketHolder={ticketHolder}
                    ticketWarning={
                        <Alert severity="warning" variant="outlined">
                            This ticket is linked to {participation.user.firstName}'s account, so
                            its details are read-only and managed through their account.
                        </Alert>
                    }
                    alerts={
                        !!ticketInfo?.cancelled && (
                            <Alert severity="error" variant="outlined">
                                {participation.user.firstName} has been issued a ticket that has
                                inadvertently been cancelled.
                                { canUpdateTickets &&
                                    ' You need to disassociate their ticket below.' }
                            </Alert>
                        )
                    }
                    actions={
                        (canCancelPurchases || canUpdateTickets) && (
                            <>
                                {disassociateAction}
                                { (canUpdateTickets && !hasBeenCancelled) &&
                                    <ResendConfirmationQuickAction action={resendConfirmationFn} /> }
                                { (canCancelPurchases && !hasBeenCancelled) &&
                                    <CancelPurchaseQuickAction action={cancelPurchaseFn} /> }
                            </>
                        )
                    }>
                    { acceptedTeams.length > 1 &&
                        <Section icon={ <GroupsOutlinedIcon /> } title="Team association">
                            <SectionIntroduction>
                                {participation.user.firstName} is part of multiple teams for{' '}
                                {event.shortName}. You can optionally set a preferred team for
                                their ticket association.
                            </SectionIntroduction>
                            <FormGrid action={updatePrimaryTeamFn} defaultValues={{
                                teamIdPrimary: primaryTeamId ?? '',
                            }}>
                                <Grid size={{ xs: 12 }}>
                                    <SelectElement
                                        name="teamIdPrimary"
                                        label="Preferred team"
                                        fullWidth
                                        size="small"
                                        options={[
                                            { id: '', label: 'Automatic (no preference)' },
                                            ...acceptedTeams.map(({ id, label }) => ({ id, label })),
                                        ]}
                                        slotProps={{ select: { readOnly: !canUpdateTickets } }} />
                                </Grid>
                            </FormGrid>
                        </Section> }
                </PurchaseDetails> }
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ user: 'id' }, 'Volunteers', 'Tickets', { event: 'event' });
