// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PhoneDisabledIcon from '@mui/icons-material/PhoneDisabled';
import Typography from '@mui/material/Typography';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import { DiscordIcon } from './DiscordIcon';
import db, { tUsers } from '@lib/database';

/**
 * Regular expression to verify that phone numbers are stored in a E.164-compatible format.
 */
const kPhoneNumberRegex = /^\+[1-9]\d{1,14}$/;

/**
 * The <AccountWarningCard> component is a card that visualises warnings related to accounts known
 * to the volunteer manager, e.g. accounts that have not been activated yet, unconfirmed Discord
 * handles, and so on.
 */
export async function AccountWarningCard() {
    const volunteers = await db.selectFrom(tUsers)
        .where(tUsers.anonymized.isNull())
        .select({
            id: tUsers.userId,
            name: tUsers.name,
            phoneNumber: tUsers.phoneNumber,
            discordHandle: tUsers.discordHandle,
            discordHandleUpdated: tUsers.discordHandleUpdated,
            activated: tUsers.activated.equals(/* true= */ 1),
        })
        .executeSelectMany();

    // ---------------------------------------------------------------------------------------------
    // Compute account warnings:
    // ---------------------------------------------------------------------------------------------

    type Warning = {
        userId: number;
        name: string;
        priority: number;
        icon: React.ReactNode;
        text: string;
    };

    const warnings: Warning[] = [];

    for (const volunteer of volunteers) {
        if (!volunteer.activated) {
            warnings.push({
                userId: volunteer.id,
                name: volunteer.name,
                priority: 3,
                icon: <PauseCircleOutlineIcon color="disabled" />,
                text: 'Their account has not been activated yet',
            })
        }

        if (!!volunteer.phoneNumber && !kPhoneNumberRegex.test(volunteer.phoneNumber)) {
            warnings.push({
                userId: volunteer.id,
                name: volunteer.name,
                priority: 2,
                icon: <PhoneDisabledIcon color="info" />,
                text: `Their phone number (${volunteer.phoneNumber}) is invalid`,
            });
        }

        if (!!volunteer.discordHandle && !!volunteer.discordHandleUpdated) {
            warnings.push({
                userId: volunteer.id,
                name: volunteer.name,
                priority: 1,
                icon: <DiscordIcon color="warning" />,
                text: `Their Discord handle (${volunteer.discordHandle}) needs to be verified`,
            });
        }
    }

    warnings.sort((lhs, rhs) => {
        if (lhs.priority !== rhs.priority)
            return lhs.priority > rhs.priority ? 1 : -1;

        return lhs.name.localeCompare(rhs.name);
    });

    // ---------------------------------------------------------------------------------------------

    return (
        <Card>
            <CardHeader avatar={ <WarningAmberIcon color="primary" /> }
                        title="Account warnings"
                        slotProps={{ title: { variant: 'subtitle2' } }} />
            <Divider />
            <List dense disablePadding>
                { warnings.map((warning, index) =>
                    <ListItemButton LinkComponent={Link}
                                    href={`/admin/organisation/accounts/${warning.userId}`}
                                    key={index}>
                        <ListItemIcon>
                            {warning.icon}
                        </ListItemIcon>
                        <ListItemText primary={warning.name}
                                      secondary={warning.text} />
                    </ListItemButton> )}
            </List>
            { !warnings.length &&
                <Typography variant="body2" sx={{ p: 2 }}>
                    There are no account warnings right now. Hooray!
                </Typography> }
        </Card>
    );
}
