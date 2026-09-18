// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import Alert from '@mui/material/Alert';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import FaceIcon from '@mui/icons-material/Face';
import PersonIcon from '@mui/icons-material/Person';
import ReportOutlinedIcon from '@mui/icons-material/ReportOutlined';
import Stack from '@mui/material/Stack';

import type { RegistrationStatus } from '@lib/database/Types';
import type { ServerAction } from '@lib/serverAction';
import { AccountInformation } from './AccountInformation';
import { AccountQuickActions } from './AccountQuickActions';
import { AccountStatusButton } from './AccountStatusButton';
import { ActionBar } from '@app/admin/components/ActionBar';
import { AnonymizationButton } from './AnonymizationButton';
import { AvatarControl } from './AvatarControl';
import { DataTable, createDataSource, withContext, withRowModel, type Column, type ExtractRowModel }
    from '@app/admin/components/DataTable';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { TeamCell } from './ParticipationCells';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { getBlobUrl } from '@lib/database/BlobStore';
import { readSetting } from '@lib/Settings';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEvents, tRoles, tStorage, tTeams, tUsers, tUsersEvents } from '@lib/database';

import { kFileType } from '@lib/database/Types';

import * as actions from './AccountActions';

/**
 * Data source through which a volunteer's event participation history can be retrieved.
 */
const accountParticipationDataSource =
    createDataSource('organisation/accounts/participation', withContext(
{
    /**
     * Unique ID of the account for whom participation is being retrieved.
     */
    userId: z.number(),

}), withRowModel({
    /**
     * Unique ID describing this participation.
     */
    id: z.number(),

    /**
     * Name of the event during which they participated.
     */
    event: z.string(),

    /**
     * Deep link to their participation in the event.
     */
    href: z.string(),

    /**
     * Status of their participation, one of { Registered, Accepted, Rejected, Cancelled }.
     */
    status: z.string(),

    /**
     * Name of the team in which they participated.
     */
    team: z.string(),

    /**
     * Theme colour that applies to this team.
     */
    teamColour: z.string(),

    /**
     * Name of the role in which they participated.
     */
    role: z.string(),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, {
            permission: 'organisation.accounts',
            operation: 'read',
        });
    },

    async list(params, props, context) {
        const dbInstance = db;
        const participation = await dbInstance.selectFrom(tUsersEvents)
            .innerJoin(tEvents)
                .on(tEvents.eventId.equals(tUsersEvents.eventId))
            .innerJoin(tTeams)
                .on(tTeams.teamId.equals(tUsersEvents.teamId))
            .innerJoin(tRoles)
                .on(tRoles.roleId.equals(tUsersEvents.roleId))
            .where(tUsersEvents.userId.equals(context.userId))
            .select({
                id: tUsersEvents.eventId.multiply(1000).add(tUsersEvents.teamId),
                event: tEvents.eventShortName,
                eventSlug: tEvents.eventSlug,
                status: tUsersEvents.registrationStatus,
                role: tRoles.roleName,
                team: tTeams.teamName,
                teamSlug: tTeams.teamSlug,
                teamColour: tTeams.teamColourLightTheme,
            })
            .orderBy(tEvents.eventStartTime, 'desc')
            .executeSelectMany();

        return {
            rowCount: participation.length,
            rows: participation.map(row => {
                let href: string = '#';
                switch (row.status as RegistrationStatus) {
                    case 'Registered':
                    case 'Rejected':
                        href = `/admin/events/${row.eventSlug}/${row.teamSlug}/applications`;
                        break;

                    case 'Accepted':
                    case 'Cancelled':
                        href = `/admin/events/${row.eventSlug}/${row.teamSlug}/volunteers/` +
                                `${context.userId}`;
                        break;
                }

                return {
                    id: row.id,
                    event: row.event,
                    href,
                    status: row.status,
                    team: row.team,
                    teamColour: row.teamColour,
                    role: row.role,
                };
            }),
        };
    },
});

/**
 * The <AccountInformationPage> component displays the basic account information, together with a
 * series of actions that are available to this account, for example to toggle its availability.
 */
export default async function AccountInformationPage(
    props: PageProps<'/admin/organisation/accounts/[id]'>)
{
    const { access } = await requireAuthentication({
        permission: 'organisation.accounts',
        operation: 'read',
    });

    const { id } = await props.params;

    const dbInstance = db;
    const account = await dbInstance.selectFrom(tUsers)
        .where(tUsers.userId.equals(parseInt(id, /* radix= */ 10) || 0))
            .and(tUsers.anonymized.isNull())
        .select({
            id: tUsers.userId,
            firstName: tUsers.displayName.valueWhenNull(tUsers.firstName),
            name: tUsers.name,
            defaultValues: {
                firstName: tUsers.firstName,
                lastName: tUsers.lastName,
                displayName: tUsers.displayName,
                language: tUsers.language,
                birthdate: dbInstance.dateAsString(tUsers.birthdate),
                gender: tUsers.gender,
                username: tUsers.username,
                phoneNumber: tUsers.phoneNumber,
                discordHandle: tUsers.discordHandle,
                discordHandleUpdated: tUsers.discordHandleUpdated.isNotNull(),
            },
            activated: tUsers.activated.equals(/* true= */ 1),
            restricted: tUsers.participationSuspended,
        })
        .executeSelectNoneOrOne();

    if (!account)
        notFound();

    // ---------------------------------------------------------------------------------------------
    // Avatar overview section:
    // ---------------------------------------------------------------------------------------------

    const avatars = await dbInstance.selectFrom(tStorage)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tStorage.userId))
        .where(tStorage.userId.equals(account.id))
            .and(tStorage.fileType.equals(kFileType.Avatar))
        .select({
            id: tStorage.fileId,
            hash: tStorage.fileHash,
            isDefault: tUsers.avatarId.equals(tStorage.fileId),
        })
        .orderBy('isDefault', 'desc')
            .orderBy(tStorage.fileDate, 'desc')
        .executeSelectMany();

    // ---------------------------------------------------------------------------------------------

    const action = actions.updateAccountInformation.bind(null, account.id);

    const isRoleAccount = await readSetting('system-role-account-user-id') === account.id;

    const canDeleteAccounts = access.can('organisation.accounts', 'delete');
    const canUpdateAccounts = access.can('organisation.accounts', 'update');

    const anonymizationAction =
        (canDeleteAccounts && !isRoleAccount)
            ? actions.anonymizeAccount.bind(null, account.id)
            : undefined;

    const activateAccountFn =
        (canUpdateAccounts && !account.activated)
            ? actions.activateAccount.bind(null, account.id)
            : undefined;

    const deactivateAccountFn =
        (canUpdateAccounts && !!account.activated && !isRoleAccount)
            ? actions.deactivateAccount.bind(null, account.id)
            : undefined;

    const restrictFn =
        (canUpdateAccounts && !account.restricted && !isRoleAccount)
            ? actions.updateAccountSuspension.bind(null, account.id, /* suspend= */ true)
            : undefined;

    const unrestrictFn =
        (canUpdateAccounts && !!account.restricted)
            ? actions.updateAccountSuspension.bind(null, account.id, /* suspend= */ false)
            : undefined;

    const resetPasswordFn =
        canUpdateAccounts
            ? actions.resetPassword.bind(null, account.id)
            : undefined;

    const createAccessCodeFn =
        canUpdateAccounts
            ? actions.createAccessCode.bind(null, account.id)
            : undefined;

    const impersonateFn =
        access.can('organisation.impersonation')
            ? actions.impersonate.bind(null, account.id)
            : undefined;


    const canUpdateAvatars = access.can('organisation.avatars');
    const readOnly = !access.can('organisation.accounts', 'update');

    const columns: Column<ExtractRowModel<typeof accountParticipationDataSource>>[] = [
        {
            field: 'event',
            headerName: 'Event',
            sortable: false,
            flex: 2,

            template: 'text',
            templateProps: {
                href: '{href}',
            },
        },
        {
            field: 'status',
            headerName: 'Status',
            sortable: false,
            flex: 1,
        },
        {
            field: 'team',
            headerName: 'Team',
            sortable: false,
            flex: 1,

            template: 'component',
            templateProps: {
                component: TeamCell,
            },
        },
        {
            field: 'role',
            headerName: 'Role',
            sortable: false,
            flex: 1,
        },
    ];

    return (
        <>
            <Section icon={ <PersonIcon color="primary" /> } title={account.name}
                     headerAction={
                        <AccountStatusButton activated={account.activated}
                                             restricted={account.restricted} />
                     }
                     limited={!canUpdateAccounts || !canDeleteAccounts}
                     breadcrumbs={[
                         { label: 'Organisation', href: '/admin/organisation' },
                         { label: 'Accounts', href: '/admin/organisation/accounts' },
                         { label: account.name, href: `/admin/organisation/accounts/${account.id}` }
                     ]}>
                <SectionIntroduction>
                    All the tea about our amazing volunteer, {account.firstName}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <ActionBar>
                    <AccountQuickActions firstName={account.firstName}
                                         restricted={account.restricted}
                                         activateAccountFn={activateAccountFn}
                                         deactivateAccountFn={deactivateAccountFn}
                                         restrictFn={restrictFn}
                                         unrestrictFn={unrestrictFn}
                                         resetPasswordFn={resetPasswordFn}
                                         createAccessCodeFn={createAccessCodeFn}
                                         impersonateFn={impersonateFn} />
                </ActionBar>
                { isRoleAccount &&
                    <Alert severity="info" variant="filled">
                        This is the system service account for the Volunteer Manager. Automated
                        features, such as registration and application confirmations, run through
                        this account. To prevent system errors, account management options are
                        limited.
                    </Alert>}
            </Section>
            <FormGridSection action={action} defaultValues={account.defaultValues}
                             icon={ <BadgeOutlinedIcon /> } title="Information">
                <AccountInformation confirmDiscordFn={actions.confirmDiscord.bind(null, account.id)}
                                    discordHandle={account.defaultValues.discordHandle}
                                    discordHandleUpdated={
                                        account.defaultValues.discordHandleUpdated}
                                    userId={account.id} readOnly={readOnly} />
            </FormGridSection>
            <Section icon={ <EventRepeatIcon /> } title="Participation">
                <DataTable
                    columns={columns}
                    context={{ userId: account.id }}
                    defaultSort={{ field: 'id', sort: 'asc' }}
                    disableFooter disableSearch
                    pageSize={50}
                    source={accountParticipationDataSource}
                    subject="participation"
                    listViewProps={{
                        primaryField: 'event',
                        secondaryTemplate: '{team} · {role} ({status})',
                        linkTemplate: '{href}',
                    }} />
            </Section>
            { !!avatars.length &&
                <Section icon={ <FaceIcon />} title="Avatars">
                    <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
                        { avatars.map(({ id, hash, isDefault }) => {
                            let deleteFn: ServerAction | undefined;
                            let setDefaultFn: ServerAction | undefined;

                            if (canUpdateAvatars)
                                deleteFn = actions.deleteAvatar.bind(null, account.id, id);
                            if (canUpdateAvatars && !isDefault)
                                setDefaultFn = actions.setDefaultAvatar.bind(null, account.id, id);

                            return (
                                <AvatarControl key={id} alt={account.firstName}
                                               deleteFn={deleteFn} isDefault={isDefault}
                                               setDefaultFn={setDefaultFn} src={getBlobUrl(hash)} />
                            );
                        }) }
                    </Stack>
                </Section> }
            { !!anonymizationAction &&
                <Section icon={ <ReportOutlinedIcon color="error" /> } title="Danger zone">
                    <SectionIntroduction>
                        These actions may permanently affect their account. Use with caution.
                    </SectionIntroduction>
                    <AnonymizationButton action={anonymizationAction} name={account.name} />
                </Section> }
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ user: 'id' }, 'Accounts', 'Organisation');
