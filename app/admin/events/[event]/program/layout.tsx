// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import EventNoteIcon from '@mui/icons-material/EventNote';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import MapIcon from '@mui/icons-material/Map';
import NewReleasesIcon from '@mui/icons-material/NewReleases';

import { SectionTabContext } from '@app/admin/components/SectionTabContext';
import { requireAuthenticationWithEvent } from '@lib/requireAuthentication';

/**
 * The <ProgramLayout> component contains the common elements between the different pages that make
 * up the Program section of the Volunteer Manager. A program is bound to an event.
 */
export default async function ProgramLayout(props: LayoutProps<'/admin/events/[event]/program'>) {
    const { access, event } = await requireAuthenticationWithEvent(props);
    if (!event.integrations?.anPlanFestivalId)
        notFound();  // events must be associated with an AnPlan festival in order to have a program

    return (
        <SectionTabContext access={access} tabs={[
            {
                Icon: NewReleasesIcon,
                label: 'Requests',
                url: `/admin/events/${event.slug}/program/requests`,
            },
            {
                Icon: EventNoteIcon,
                label: 'Activities',
                url: `/admin/events/${event.slug}/program/activities`,
            },
            {
                Icon: LocationOnIcon,
                label: 'Locations',
                url: `/admin/events/${event.slug}/program/locations`,
            },
            {
                Icon: MapIcon,
                label: 'Areas',
                url: `/admin/events/${event.slug}/program/areas`,
            },
        ]}>
            {props.children}
        </SectionTabContext>
    );
}
