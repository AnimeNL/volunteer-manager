// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type SvgIcon from '@mui/material/SvgIcon';
import BookIcon from '@mui/icons-material/Book';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import MultipleStopIcon from '@mui/icons-material/MultipleStop';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

import type { SubscriptionType } from '@lib/subscriptions';
import db, { tTeams } from '@lib/database';

import { kSubscriptionType } from '@lib/subscriptions';
import { kTargetToTypeId } from '@lib/subscriptions/drivers/HelpDriver';

/**
 * Information that should be compiled for each subscription available in the system.
 */
export interface SubscriptionTypeInfo {
    /**
     * Unique ID of the subscription type.
     */
    id: string;

    /**
     * Type of subscription.
     */
    type: SubscriptionType;

    /**
     * ID within the type, to signal e.g. the team the application was for.
     */
    typeId: number | null;

    /**
     * Constructor for the icon used to identify this type.
     */
    Icon: typeof SvgIcon;

    /**
     * Label to display in a human readable way.
     */
    label: string;

    /**
     * Description with a slightly more elaborate explanation of what it's about.
     */
    description: string;
}

/**
 * Returns a comprehensive list of the subscription types that are available within the portal.
 */
export async function getSubscriptionTypes(): Promise<SubscriptionTypeInfo[]> {
    const teams = await db.selectFrom(tTeams)
        .select({
            id: tTeams.teamId,
            name: tTeams.teamName,
            enableDutyBook: tTeams.teamFlagEnableDutyBook.equals(/* true= */ 1),
        })
        .orderBy('name', 'asc')
        .executeSelectMany();

    return [
        ...teams.map(team => ({
            id: `${kSubscriptionType.Application}/${team.id}`,
            type: kSubscriptionType.Application,
            typeId: team.id,
            Icon: NewReleasesIcon,
            label: `Application for ${team.name}`,
            description: 'When a volunteer applies to help out',
        })),
        ...Object.entries(kTargetToTypeId).map(([ type, typeId ]) => ({
            id: `${kSubscriptionType.Help}/${typeId}`,
            type: kSubscriptionType.Help,
            typeId: typeId,
            Icon: HelpOutlineOutlinedIcon,
            label: `Help request for ${type}`,
            description: 'Request for help issued through our displays',
        })),
        ...teams.filter(team => team.enableDutyBook).map(team => ({
            id: `${kSubscriptionType.Incident}/${team.id}`,
            type: kSubscriptionType.Incident,
            typeId: team.id,
            Icon: BookIcon,
            label: `Duty Book incidents for ${team.name}`,
            description: 'Report of an incident through the portal',
        })),
        {
            id: kSubscriptionType.Registration,
            type: kSubscriptionType.Registration,
            typeId: null,
            Icon: PersonAddIcon,
            label: 'New user registrations',
            description: 'Creation of a new user account on the portal',
        },
        {
            id: kSubscriptionType.Test,
            type: kSubscriptionType.Test,
            typeId: null,
            Icon: MultipleStopIcon,
            label: 'Internal test messages',
            description: /* none= */ '',
        },
    ];
}
