// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Link from '@app/LinkProxy';

import { default as MuiLink } from '@mui/material/Link';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';

import type { PageInfo } from '../verifyAccessAndFetchPageInfo';
import { type RegistrationStatus, kRegistrationStatus } from '@lib/database/Types';
import { Avatar } from '@components/Avatar';

/**
 * Props accepted by the <EventRecentVolunteers> and <VolunteerStack> components.
 */
export interface EventRecentVolunteersProps {
    event: PageInfo['event'];

    volunteers: {
        /**
         * Unique ID of the account that belongs to this volunteer.
         */
        userId: number;

        /**
         * Whether the volunteer is accessible. When set to `false`, no link will be created.
         */
        accessible?: boolean;

        /**
         * Hash of their avatar, if any.
         */
        avatarHash?: string;

        /**
         * Unique slug identifying the team that they're part of.
         */
        team: string;

        /**
         * Full name of the volunteer that applied.
         */
        name: string;

        /**
         * Status of this application. Influences where we link them to.
         */
        status: RegistrationStatus;
    }[];
}

/**
 * The <VolunteerStack> component displays a stack containing all the volunteers carried in `props`.
 */
export function VolunteerStack(props: EventRecentVolunteersProps) {
    const { event, volunteers } = props;
    return (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            { volunteers.map((volunteer, index) => {
                const avatarSrc = volunteer.avatarHash ? `/blob/${volunteer.avatarHash}.png`
                                                       : undefined;

                if (volunteer.accessible === false) {
                    return (
                        <Tooltip key={index} title={volunteer.name}>
                            <Avatar size="medium" src={avatarSrc}>
                                {volunteer.name}
                            </Avatar>
                        </Tooltip>
                    );
                }

                const linkBase = `/admin/events/${event.slug}/${volunteer.team}`;

                let link: string = '/applications';
                switch (volunteer.status) {
                    case kRegistrationStatus.Accepted:
                    case kRegistrationStatus.Cancelled:
                        link = `/volunteers/${volunteer.userId}`;
                        break;
                }

                return (
                    <Tooltip key={index} title={volunteer.name}>
                        <MuiLink component={Link} href={`${linkBase}${link}`}
                                    sx={{ textDecoration: 'none' }}>
                            <Avatar size="medium" src={avatarSrc}>
                                {volunteer.name}
                            </Avatar>
                        </MuiLink>
                    </Tooltip>
                );
            } )}
        </Stack>
    );
}

/**
 * The <EventRecentVolunteers> component displays the volunteers who have most recently joined the
 * team. Clicking on their avatar will forward the senior (or administrator) to their profile.
 */
export function EventRecentVolunteers(props: EventRecentVolunteersProps) {
    return (
        <Card sx={{ minHeight: '100%' }}>
            <CardHeader avatar={ <AccessTimeIcon color="primary" /> }
                        title="Latest volunteers to apply"
                        titleTypographyProps={{ variant: 'subtitle2' }} />
            <Divider />
            <CardContent sx={{ pb: '16px !important' }}>
                <VolunteerStack {...props} />
            </CardContent>
        </Card>
    );
}
