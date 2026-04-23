// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { EnvironmentContext, EnvironmentContextApplication } from '@lib/EnvironmentContext';
import { ApplicationProgress } from './ApplicationProgress';

/**
 * Props accepted by the <ApplicationProgressHeader> component.
 */
interface ApplicationProgressHeaderProps {
    /**
     * Full context of the environment for which this page is being displayed.
     */
    context: EnvironmentContext;

    /**
     * When set, only applications for the given `event` will be considered.
     */
    event?: string;
}

/**
 * The <ApplicationProgressHeader> component displays the header, part of the registration layout,
 * that visualises the statuses of the applications the volunteer has made. The appropriate ones
 * to display will be selected by this component.
 */
export function ApplicationProgressHeader(props: ApplicationProgressHeaderProps) {
    let applicationEvent: { shortName: string; slug: string; } | undefined;
    let applications: EnvironmentContextApplication[] = [ /* none yet */ ];

    for (const event of props.context.events) {
        if (!!props.event && props.event !== event.slug)
            continue;  // this |event| does not match the one we want to filter for

        if (!event.applications.length)
            continue;  // the visitor has not applied for this event (yet)

        if (event.publishContent !== 'active' && event.publishContent !== 'override')
            continue;  // the visitor does not have access to this event anymore

        applications = event.applications.map(application => ({
            ...application,
            team: application.teamName.replace(/s$/, ''),
        }));

        applicationEvent = {
            shortName: event.shortName,
            slug: event.slug,
        };

        break;
    }

    return applications.map((application, index) =>
        <ApplicationProgress key={index} application={application} event={applicationEvent!} /> );
}
