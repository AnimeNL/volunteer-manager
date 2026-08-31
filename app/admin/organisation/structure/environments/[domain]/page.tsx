// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';
import { notFound } from 'next/navigation';

import { SelectElement, TextFieldElement } from '@components/proxy/react-hook-form-mui';

import Grid from '@mui/material/Grid';
import GroupsIcon from '@mui/icons-material/Groups';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import PublicIcon from '@mui/icons-material/Public';

import type { EnvironmentPurpose } from '@lib/database/Types';
import { ColorInput } from '@app/admin/components/ColorInput';
import { ConfirmationButton } from '@app/admin/components/ConfirmationButton';
import { FormGridSection } from '@app/admin/components/FormGridSection';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthentication } from '@lib/requireAuthentication';
import db, { tEnvironments, tTeams } from '@lib/database';

import { deleteEnvironment, updateEnvironment } from '../../TeamsActions';

/**
 * Options for the purpose of an environment that can be selected.
 */
const kEnvironmentPurposeOptions: { [key in EnvironmentPurpose]: string } = {
    LandingPage: 'Landing page',
    Placeholder: 'Placeholder',
};

/**
 * The <EnvironmentPage> component shows to the volunteer information about a specific environment
 * they would like to inspect or update.
 */
export default async function EnvironmentPage(
    props: PageProps<'/admin/organisation/structure/environments/[domain]'>)
{
    const { access } = await requireAuthentication('organisation.environments');

    const canDeleteEnvironment = access.can('root');  // only root can delete environments

    const params = await props.params;
    const environment = await db.selectFrom(tEnvironments)
        .where(tEnvironments.environmentDomain.equals(params.domain))
            .and(tEnvironments.environmentDeleted.isNull())
        .select({
            id: tEnvironments.environmentId,
            colorDarkMode: tEnvironments.environmentColourDarkMode,
            colorLightMode: tEnvironments.environmentColourLightMode,
            description: tEnvironments.environmentDescription,
            domain: tEnvironments.environmentDomain,
            purpose: tEnvironments.environmentPurpose,
            title: tEnvironments.environmentTitle,
        })
        .executeSelectNoneOrOne();

    if (!environment)
        notFound();

    const teams = await db.selectFrom(tTeams)
        .where(tTeams.teamEnvironmentId.equals(environment.id))
        .select({
            color: tTeams.teamColourLightTheme,
            name: tTeams.teamName,
            slug: tTeams.teamSlug,
        })
        .orderBy('name', 'asc')
        .executeSelectMany();

    const purposeOptions = Object.entries(kEnvironmentPurposeOptions).map(([ k, v ]) => ({
        id: k,
        label: v,
    }));

    const readOnly = false;  // should we support this?

    const deleteEnvironmentFn = deleteEnvironment.bind(null, environment.id);
    const updateEnvironmentFn = updateEnvironment.bind(null, environment.id);

    return (
        <>
            <Section icon={ <PublicIcon color="primary" /> } title={environment.title}
                     breadcrumbs={[
                { label: 'Organisation', href: '/admin/organisation' },
                { label: 'Structure', href: '/admin/organisation/structure' },
                { label: 'Environments', href: '/admin/organisation/structure/environments' },
                { label: environment.title },
            ]}>
                <SectionIntroduction>
                    Identity and configuration for the {environment.title} <em>tenant</em> on our
                    system.
                </SectionIntroduction>
            </Section>

            <FormGridSection noHeader tabs back="Back to environments"
                             action={updateEnvironmentFn} defaultValues={environment}>
                { canDeleteEnvironment &&
                    <Grid size={{ xs: 12 }}>
                        <ConfirmationButton action={deleteEnvironmentFn}
                                            label="Delete this environment…"
                                            sx={{ float: 'right' }}>
                            Are you sure you want to delete <strong>{environment.domain}</strong>?
                            This action is permanent and cannot be undone. All teams currently
                            linked to this environment will need to be reassigned to a different
                            one.
                        </ConfirmationButton>
                    </Grid> }

                <Grid size={{ xs: 12, md: 6 }}>
                    <TextFieldElement name="domain" label="Domain" fullWidth size="small" required
                                      slotProps={{ input: { readOnly: true } }} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <SelectElement name="purpose" label="Purpose" options={purposeOptions} fullWidth
                                   size="small" required
                                   slotProps={{ select: { readOnly: !!readOnly } }} />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                    <ColorInput name="colorDarkMode" label="Theme (Dark Mode)" fullWidth
                                size="small" required />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <ColorInput name="colorLightMode" label="Theme (Light Mode)" fullWidth
                                size="small" required />
                </Grid>

                <Grid size={{ xs: 12 }}>
                    <TextFieldElement name="title" label="Title" fullWidth size="small" required
                                      slotProps={{ input: { readOnly: !!readOnly } }} />
                </Grid>

                <Grid size={{ xs: 12 }}>
                    <TextFieldElement name="description" label="Description" fullWidth size="small"
                                      required multiline
                                      slotProps={{ input: { readOnly: !!readOnly } }} />
                </Grid>
            </FormGridSection>

            { teams.length > 0 &&
                <Section title="Teams" icon={ <GroupsIcon /> }>
                    <List dense disablePadding sx={{ mx: '-16px !important' }}>
                        { teams.map(team =>
                            <ListItemButton key={team.slug} LinkComponent={Link}
                                            href={`/admin/organisation/structure/${team.slug}`}>
                                <ListItemIcon>
                                    <GroupsIcon htmlColor={team.color} />
                                </ListItemIcon>
                                <ListItemText secondary={team.name} />
                            </ListItemButton> )}
                    </List>
                </Section> }
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn(
    { environment: 'domain' }, 'Environments', 'Structure', 'Organisation');
