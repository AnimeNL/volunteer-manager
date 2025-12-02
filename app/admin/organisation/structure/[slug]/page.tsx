// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { AutocompleteElement, SelectElement, TextareaAutosizeElement, TextFieldElement }
    from '@components/proxy/react-hook-form-mui';

import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import KeyIcon from '@mui/icons-material/Key';
import List from '@mui/material/List';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import Stack from '@mui/material/Stack';

import type { NextPageParams } from '@lib/NextRouterParams';
import { AutocompleteElementWithDisabledOptions } from '@app/admin/components/AutocompleteElementWithDisabledOptions';
import { BackButtonGrid } from '@app/admin/components/BackButtonGrid';
import { ColorInput } from '@app/admin/components/ColorInput';
import { ConfirmationButton } from '@app/admin/components/ConfirmationButton';
import { Flag, type FlagProps } from './Flag';
import { FormGrid } from '@app/admin/components/FormGrid';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tEnvironments, tRoles, tTeams, tTeamsRoles } from '@lib/database';

import * as actions from '../TeamsActions';

/**
 * The <TeamPage> component shows to the volunteer information about one very specific team, as has
 * been indicated in the URL's parameters. The team's settings can be updated from here too.
 */
export default async function TeamPage(props: NextPageParams<'slug'>) {
    const { access } = await requireAuthenticationContext({
        check: 'admin',
        permission: 'organisation.teams',
    });

    const canDisableTeam = access.can('root');  // only root can disable teams
    const canResetInviteKey = access.can('admin');  // only admin (& root) can reset invite keys

    const teamsRolesDefaultJoin = tTeamsRoles.forUseInLeftJoinAs('trdj');
    const teamsRolesJoin = tTeamsRoles.forUseInLeftJoinAs('trj');

    const params = await props.params;
    const team = await db.selectFrom(tTeams)
        .leftJoin(teamsRolesJoin)
            .on(teamsRolesJoin.teamId.equals(tTeams.teamId))
        .leftJoin(teamsRolesDefaultJoin)
            .on(teamsRolesDefaultJoin.teamId.equals(tTeams.teamId))
                .and(teamsRolesDefaultJoin.roleDefault.equals(/* true= */ 1))
        .where(tTeams.teamSlug.equals(params.slug))
        .select({
            id: tTeams.teamId,
            colorDarkMode: tTeams.teamColourDarkTheme,
            colorLightMode: tTeams.teamColourLightTheme,
            description: tTeams.teamDescription,
            environment: tTeams.teamEnvironmentId,
            name: tTeams.teamName,
            plural: tTeams.teamPlural,
            slug: tTeams.teamSlug,
            title: tTeams.teamTitle,

            defaultRoleId: teamsRolesDefaultJoin.roleId,
            availableRoleIds: db.aggregateAsArrayOfOneColumn(teamsRolesJoin.roleId),

            flagEnableScheduling: tTeams.teamFlagEnableScheduling.equals(/* true= */ 1),
            flagGrowthCharts: tTeams.teamFlagGrowthCharts.equals(/* true= */ 1),
            flagManagesContent: tTeams.teamFlagManagesContent.equals(/* true= */ 1),
            flagManagesFaq: tTeams.teamFlagManagesFaq.equals(/* true= */ 1),
            flagManagesFirstAid: tTeams.teamFlagManagesFirstAid.equals(/* true= */ 1),
            flagManagesSecurity: tTeams.teamFlagManagesSecurity.equals(/* true= */ 1),
            flagProgramRequests: tTeams.teamFlagProgramRequests.equals(/* true= */ 1),
            flagRequestConfirmation: tTeams.teamFlagRequestConfirmation.equals(/* true= */ 1),

            enabled: tTeams.teamDeleted.isNull(),
        })
        .executeSelectNoneOrOne();

    if (!team)
        notFound();

    // ---------------------------------------------------------------------------------------------

    const roles = await db.selectFrom(tRoles)
        .select({
            id: tRoles.roleId,
            label: tRoles.roleName,
            disabled: tRoles.roleFlagDefaultRestricted.equals(/* true= */ 1),
        })
        .orderBy('label', 'asc')
        .executeSelectMany();

    const environments = await db.selectFrom(tEnvironments)
        .where(tEnvironments.environmentDeleted.isNull())
            .and(tEnvironments.environmentDeleted.isNull())
        .select({
            id: tEnvironments.environmentId,
            label: tEnvironments.environmentTitle
                .concat(' (')
                .concat(tEnvironments.environmentDomain)
                .concat(')'),
        })
        .orderBy(tEnvironments.environmentTitle, 'asc')
        .executeSelectMany();

    // ---------------------------------------------------------------------------------------------
    // Determine the flags available for this team. Each flag must be fetched from the database, and
    // will be shown as a list item with a checkbox that can be appropriately toggled.
    // ---------------------------------------------------------------------------------------------

    const kFlags: FlagProps[] = [
        {
            field: 'flagEnableScheduling',
            title: 'Enable volunteer scheduling tools',
        },
        {
            field: 'flagProgramRequests',
            title: 'Handles incoming program requests',
            description: 'Displays this team on the program help request overview',
        },
        {
            field: 'flagManagesContent',
            title: 'Manages landing page content',
            description: '',
        },
        {
            field: 'flagManagesFirstAid',
            title: 'Manages the First Aid team',
            description: '',
        },
        {
            field: 'flagManagesFaq',
            title: 'Manages the Knowledge Base',
            description: '',
        },
        {
            field: 'flagManagesSecurity',
            title: 'Manages the Security team',
            description: '',
        },
        {
            field: 'flagGrowthCharts',
            title: 'Participates in volunteer growth charts',
            description: 'Consider this team for the graphs shown under recent applications',
        },
        {
            field: 'flagRequestConfirmation',
            title: 'Request for confirmation in the application approve message?',
            description: 'Asks the volunteer to confirm receipt of the e-mail message',
        }
    ];

    // ---------------------------------------------------------------------------------------------

    const readOnly = false;  // should we support this?

    const backButtonSize = canDisableTeam ? 6 : 12;

    const disableTeamFn = actions.toggleTeamEnabled.bind(null, team.id, /* enabled= */ false);
    const enableTeamFn = actions.toggleTeamEnabled.bind(null, team.id, /* enabled= */ true);
    const resetTeamKeyFn = actions.resetTeamKey.bind(null, team.id);
    const updateTeamFn = actions.updateTeam.bind(null, team.id);

    // ---------------------------------------------------------------------------------------------

    return (
        <FormGrid action={updateTeamFn} defaultValues={team}>

            <BackButtonGrid href="/admin/organisation/structure" size={backButtonSize}>
                Back to teams
            </BackButtonGrid>
            { (canResetInviteKey || canDisableTeam) &&
                <Grid size={{ xs: 6 }}>
                    <Stack direction="row" spacing={2} justifyContent="flex-end">
                        { canResetInviteKey &&
                            <ConfirmationButton callToAction="Reset" action={resetTeamKeyFn}
                                                icon={ <KeyIcon /> } color="info"
                                                label="Reset key…">
                                Are you sure you want to reset the <strong>{team.name} </strong>
                                team's key? This will invalidate all invite links, for past
                                and future events alike.
                            </ConfirmationButton> }
                        { (canDisableTeam && !!team.enabled) &&
                            <ConfirmationButton callToAction="Disable" action={disableTeamFn}
                                                icon={ <RemoveCircleOutlineIcon /> }
                                                label="Disable this team…">
                                Are you sure you want to disable the <strong>{team.name} </strong>
                                team? This will stop the team from being considered for any future
                                events, but won't remove any data.
                            </ConfirmationButton> }
                        { (canDisableTeam && !team.enabled) &&
                            <ConfirmationButton callToAction="Enable" action={enableTeamFn}
                                                color="success" icon={ <AddCircleOutlineIcon /> }
                                                label="Enable this team…">
                                Are you sure you want to enable the <strong>{team.name} </strong>
                                team? This means that they can be considered for future events
                                again.
                            </ConfirmationButton> }
                    </Stack>
                </Grid> }

            <Grid size={{ xs: 12, md: 6 }}>
                <TextFieldElement name="slug" label="Slug" fullWidth size="small" required
                                  slotProps={{ input: { readOnly: true } }} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
                <SelectElement name="environment" label="Environment" fullWidth size="small"
                               required options={environments}
                               slotProps={{ select: { readOnly: !!readOnly } }} />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
                <TextFieldElement name="title" label="Team title" fullWidth size="small" required
                                  slotProps={{ input: { readOnly: !!readOnly } }} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
                <TextFieldElement name="name" label="Team name" fullWidth size="small" required
                                  slotProps={{ input: { readOnly: !!readOnly } }} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
                <TextFieldElement name="plural" label="Team plural" fullWidth size="small" required
                                  slotProps={{ input: { readOnly: !!readOnly } }} />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
                <ColorInput name="colorDarkMode" label="Theme (Dark Mode)" fullWidth
                            size="small" required disabled={!!readOnly} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
                <ColorInput name="colorLightMode" label="Theme (Light Mode)" fullWidth size="small"
                            required disabled={!!readOnly} />
            </Grid>

            <Grid size={{ xs: 12 }}>
                <TextareaAutosizeElement name="description" label="Description" fullWidth
                                         size="small" required
                                         slotProps={{ input: { readOnly: !!readOnly } }} />
            </Grid>

            <Grid size={{ xs: 12 }}>
                <Divider />
            </Grid>

            <Grid size={{ xs: 12 }}>
                <AutocompleteElementWithDisabledOptions
                    name="defaultRoleId" label="Default role" options={roles}
                    matchId autocompleteProps={{ fullWidth: true, readOnly, size: 'small' }} />
            </Grid>
            <Grid size={{ xs: 12 }}>
                <AutocompleteElement
                    name="availableRoleIds" label="Available roles" options={roles} multiple
                    matchId autocompleteProps={{ fullWidth: true, readOnly, size: 'small' }} />
            </Grid>

            <Grid size={{ xs: 12 }}>
                <Divider />
            </Grid>

            <Grid size={{ xs: 12 }} sx={{ mt: -1, mb: -1 }}>
                <List disablePadding>
                    { kFlags.map(entry => <Flag key={entry.field} {...entry} /> )}
                </List>
            </Grid>

        </FormGrid>
    );
}

export const generateMetadata = createGenerateMetadataFn({ team: 'slug' }, 'Teams', 'Organisation');
