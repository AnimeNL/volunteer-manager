// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { ToggleButtonGroupElement } from '@app/components/proxy/react-hook-form-mui';

import type SvgIcon from '@mui/material/SvgIcon';
import BookIcon from '@mui/icons-material/Book';
import Grid from '@mui/material/Grid';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import MultipleStopIcon from '@mui/icons-material/MultipleStop';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import StreamIcon from '@mui/icons-material/Stream';
import TextsmsOutlinedIcon from '@mui/icons-material/TextsmsOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

import { FormGrid } from '@app/admin/components/FormGrid';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';
import db, { tSubscriptions, tTeams, tUsers } from '@lib/database';

import { kSubscriptionType, type SubscriptionType } from '@lib/database/Types';
import { kTargetToTypeId } from '@lib/subscriptions/drivers/HelpDriver';

/**
 * Subscription data is a key/value mapping of active subscriptions.
 */
const kUpdateSubscriptionsData = z.looseObject({ /* freeform */ });

/**
 * Server Action through which subscriptions can be updated.
 */
async function updateSubscriptions(userId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kUpdateSubscriptionsData, async (data, props) => {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: 'system.internals.scheduler',
        });

        // todo

        return {
            success: false,
            error: 'Not yet implemented',
        };
    });
}

/**
 * Available channels for subscriptions to be delivered through.
 */
const kChannelOptions = [
    {
        id: 'email',
        label: <MailOutlinedIcon fontSize="small" />,
    },
    {
        id: 'sms',
        label: <TextsmsOutlinedIcon fontSize="small" />,
    },
    {
        id: 'whatsapp',
        label: <WhatsAppIcon fontSize="small" />,
    },
];

/**
 * Page that allows the subscriptions active for a singular account to be viewed and adjusted.
 */
export default async function AccountSubscriptionPage(
    props: PageProps<'/admin/system/subscriptions/[id]'>)
{
    const params = await props.params;

    const subscriptionsJoin = tSubscriptions.forUseInLeftJoin();

    const dbInstance = db;
    const user = await dbInstance.selectFrom(tUsers)
        .leftJoin(subscriptionsJoin)
            .on(subscriptionsJoin.subscriptionUserId.equals(tUsers.userId))
        .where(tUsers.userId.equals(parseInt(params.id, /* radix= */ 10)))
        .select({
            id: tUsers.userId,
            name: tUsers.name,
            firstName: tUsers.displayName.valueWhenNull(tUsers.firstName),
            subscriptions: dbInstance.aggregateAsArray({
                type: subscriptionsJoin.subscriptionType,
                typeId: subscriptionsJoin.subscriptionTypeId,
                channels: {
                    email: subscriptionsJoin.subscriptionChannelEmail.equals(/* true= */ 1),
                    sms: subscriptionsJoin.subscriptionChannelSms.equals(/* true= */ 1),
                    whatsapp: subscriptionsJoin.subscriptionChannelWhatsapp.equals(/* true= */ 1),
                },
            }),
        })
        .executeSelectNoneOrOne();

    if (!user)
        notFound();

    const subscriptionTypes = await getSubscriptionTypes();

    const defaultValues: Record<string, string[]> = { /* none yet */ };
    for (const subscription of user.subscriptions) {
        let type: string;
        switch (subscription.type) {
            case kSubscriptionType.Application:
            case kSubscriptionType.Help:
                type = `${subscription.type}/${subscription.typeId}`;
                break;

            case kSubscriptionType.Incident:
            case kSubscriptionType.Registration:
            case kSubscriptionType.Test:
                type = `${subscription.type}`;
                break;
        }

        const values: string[] = [ /* none yet */ ];
        for (const [ channel, enabled ] of Object.entries(subscription.channels || [])) {
            if (enabled)
                values.push(channel);
        }

        defaultValues[type] = values;
    }

    const serverAction = updateSubscriptions.bind(null, user.id);

    return (
        <>
            <Section icon={ <StreamIcon color="primary" /> }
                        title={`Subscriptions for ${user.firstName}`}
                        breadcrumbs={[
                            { label: 'Communication', href: '/admin/system/communication' },
                            { label: 'Subscriptions', href: '/admin/system/subscriptions' },
                            { label: user.firstName },
                        ]}>
                <SectionIntroduction>
                    Subscriptions available for <strong>{user.name}</strong> over various channels.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <FormGrid action={serverAction} defaultValues={defaultValues}>
                    <Grid size={{ xs: 12 }}>
                        <List disablePadding sx={{ my: -2 }}>
                            { subscriptionTypes.map((subscriptionType, index) =>
                                <ListItem key={index} disableGutters
                                          divider={ index < subscriptionTypes.length - 1 }>
                                    <ListItemIcon>
                                        <subscriptionType.Icon color="disabled" />
                                    </ListItemIcon>
                                    <ListItemText primary={subscriptionType.label}
                                                  secondary={subscriptionType.description}
                                                  slotProps={{
                                                      primary: { noWrap: true, variant: 'body2' },
                                                      secondary: { noWrap: true, variant: 'body2' },
                                                  }} />
                                    <ToggleButtonGroupElement name={subscriptionType.id}
                                                              options={kChannelOptions}
                                                              color="primary" size="small" />
                                </ListItem> ) }
                        </List>
                    </Grid>
                </FormGrid>
            </Section>
        </>
    );
}

/**
 * Information that should be compiled for each subscription available in the system.
 */
interface SubscriptionTypeInfo {
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
async function getSubscriptionTypes(): Promise<SubscriptionTypeInfo[]> {
    const teams = await db.selectFrom(tTeams)
        .select({
            id: tTeams.teamId,
            name: tTeams.teamName,
        })
        .orderBy('name', 'asc')
        .executeSelectMany();

    return [
        ...teams.map(team => ({
            id: `${kSubscriptionType.Application}/${team.id}`,
            type: kSubscriptionType.Application,
            typeId: team.id,
            Icon: NewReleasesIcon,
            label: `Application (${team.name})`,
            description: 'When a volunteer applies to help out',
        })),
        ...Object.entries(kTargetToTypeId).map(([ type, typeId ]) => ({
            id: `${kSubscriptionType.Help}/${typeId}`,
            type: kSubscriptionType.Help,
            typeId: typeId,
            Icon: HelpOutlineOutlinedIcon,
            label: `Help request (${type})`,
            description: 'Request for help issued through our displays',
        })),
        {
            id: kSubscriptionType.Incident,
            type: kSubscriptionType.Incident,
            typeId: null,
            Icon: BookIcon,
            label: 'Duty Book incidents',
            description: 'Report of an incident through the portal',
        },
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
            label: 'Test messages',
            description: /* none= */ '',
        },
    ];
}
