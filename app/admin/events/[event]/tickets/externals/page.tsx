// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { TextFieldElement } from '@app/components/proxy/react-hook-form-mui';

import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined';
import Diversity1Icon from '@mui/icons-material/Diversity1';
import Grid from '@mui/material/Grid';

import { FormGrid } from '@app/admin/components/FormGrid';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { requireAuthenticationContextWithEvent } from '../../requireAuthenticationContextWithEvent';

import { createExternalTicket } from '../TicketActions';

/**
 * Page that provides an overview of volunteering tickets granted to people external to our system.
 * They could have been manually added, or these could be orphaned tickets caused by a bug.
 */
export default async function EventTicketsExternalsPage(
    props: PageProps<'/admin/events/[event]/tickets/externals'>)
{
    const params = await props.params;
    const { access, event } = await requireAuthenticationContextWithEvent(props, {
        permission: 'event.settings',
        scope: {
            event: params.event,
        },
    });

    // TODO: Fetch all tickets in our category from the ticket provider
    // TODO: Filter away those associated with known volunteers

    // TODO: Disable when the ticket provider environment is not valid.
    const canCreate = access.can('event.tickets', 'create', { event: event.slug });

    const createAction = createExternalTicket.bind(null, event.slug);

    return (
        <>
            <Section icon={ <Diversity1Icon color="primary" /> }
                     title="External tickets"
                     breadcrumbs={[
                        { label: event.shortName, href: `/admin/events/${event.slug}` },
                        { label: 'Tickets', href: `/admin/events/${event.slug}/tickets` },
                        { label: 'Externals' },
                     ]}>
                <SectionIntroduction>
                    Overview of the tickets granted to people external to the Volunteer Manager.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                todo
            </Section>
            { canCreate &&
                <Section icon={ <AddBoxOutlinedIcon /> } title="Create a ticket">
                    <SectionIntroduction>
                        Directly issue a free ticket to a volunteer not known to the Volunteer
                        Manager. They will receive an e-mail from {event.tickets?.provider}.
                    </SectionIntroduction>
                    <FormGrid action={createAction} callToAction="Issue ticket">
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextFieldElement name="firstName" label="First name" required
                                              fullWidth size="small" />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextFieldElement name="lastName" label="Last name" required
                                              fullWidth size="small" />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <TextFieldElement name="displayName" label="Display name" fullWidth
                                              size="small" />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                            <TextFieldElement name="email" label="E-mail address" required fullWidth
                                              type="email" size="small" />
                        </Grid>
                        { /* TODO: Team? */ }
                        { /* TODO: Function? */ }
                    </FormGrid>
                </Section> }
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn('Externals', 'Tickets', { event: 'event' });
