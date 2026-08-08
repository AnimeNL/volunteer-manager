// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import FaceIcon from '@mui/icons-material/Face';
import PersonIcon from '@mui/icons-material/Person';
import ReportOutlinedIcon from '@mui/icons-material/ReportOutlined';
import Stack from '@mui/material/Stack';

import type { ServerAction } from '@lib/serverAction';
import { AccountInformation } from './AccountInformation';
import { ActionBar } from '@app/admin/components/ActionBar';
import { AnonymizationButton } from './AnonymizationButton';
import { AvatarControl } from './AvatarControl';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { ParticipationTable } from './ParticipationTable';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { getBlobUrl } from '@lib/database/BlobStore';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tEvents, tRoles, tStorage, tTeams, tUsers, tUsersEvents } from '@lib/database';

import { kFileType } from '@lib/database/Types';

import * as actions from './AccountActions';

/**
 * The <AccountInformationPage> component displays the basic account information, together with a
 * series of actions that are available to this account, for example to toggle its availability.
 */
export default async function AccountInformationPage(
    props: PageProps<'/admin/organisation/accounts/[id]'>)
{
    const { access } = await requireAuthenticationContext({
        check: 'admin',
        permission: {
            permission: 'organisation.accounts',
            operation: 'read',
        },
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
        })
        .executeSelectNoneOrOne();

    if (!account)
        notFound();

    // ---------------------------------------------------------------------------------------------
    // Account participation table:
    // ---------------------------------------------------------------------------------------------

    const participation = await dbInstance.selectFrom(tUsersEvents)
        .innerJoin(tEvents)
            .on(tEvents.eventId.equals(tUsersEvents.eventId))
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tUsersEvents.teamId))
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tUsersEvents.roleId))
        .where(tUsersEvents.userId.equals(account.id))
        .select({
            id: tUsersEvents.eventId.multiply(1000).add(tUsersEvents.teamId),
            eventShortName: tEvents.eventShortName,
            eventSlug: tEvents.eventSlug,
            eventStartTime: dbInstance.dateTimeAsString(tEvents.eventStartTime),
            status: tUsersEvents.registrationStatus,
            role: tRoles.roleName,
            team: tTeams.teamName,
            teamSlug: tTeams.teamSlug,
            teamColour: tTeams.teamColourLightTheme,
        })
        .orderBy('eventStartTime', 'desc')
            .orderBy('team', 'asc')
        .executeSelectMany();

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

    const anonymizationAction =
        access.can('organisation.accounts', 'delete')
            ? actions.anonymizeAccount.bind(null, account.id)
            : undefined;

    const canUpdateAvatars = access.can('organisation.avatars');
    const readOnly = !access.can('organisation.accounts', 'update');

    return (
        <>
            <Section icon={ <PersonIcon color="primary" /> } title={account.firstName}
                     breadcrumbs={[
                         { label: 'Organisation', href: '/admin/organisation' },
                         { label: 'Accounts', href: '/admin/organisation/accounts' },
                         { label: account.name, href: `/admin/organisation/accounts/${account.id}` }
                     ]}>
                <SectionIntroduction>
                    All the tea about our amazing volunteer, {account.name}.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                { /* TODO: Activation warning */ }
                { /* TODO: Restriction warning */ }
                <ActionBar>
                     { /* TODO: <AccountHeaderActions> */ }
                </ActionBar>
            </Section>
            <FormGridSection action={action} defaultValues={account.defaultValues}
                             icon={ <BadgeOutlinedIcon /> } title="Information">
                <AccountInformation confirmDiscordFn={actions.confirmDiscord.bind(null, account.id)}
                                    discordHandle={account.defaultValues.discordHandle}
                                    discordHandleUpdated={
                                        account.defaultValues.discordHandleUpdated}
                                    userId={account.id} readOnly={readOnly} />
            </FormGridSection>
            { participation.length > 0 &&
                <Section icon={ <EventRepeatIcon /> } title="Participation">
                    <ParticipationTable participation={participation} userId={account.id} />
                </Section> }
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
                    <AnonymizationButton action={anonymizationAction} name={account.name} />
                </Section> }
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ user: 'id' }, 'Accounts', 'Organisation');
