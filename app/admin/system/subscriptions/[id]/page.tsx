// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';
import { z } from 'zod/v4';

import { ToggleButtonGroupElement } from '@app/components/proxy/react-hook-form-mui';

import type SvgIcon from '@mui/material/SvgIcon';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
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
import { InlineAccountLink } from '@app/admin/components/InlineAccountLink';
import { LogBuilder } from '@lib/log/index';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { executeAccessCheck, requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import { executeServerAction } from '@lib/serverAction';
import db, { tSubscriptions, tTeams, tUsers } from '@lib/database';

import { kSubscriptionType, type SubscriptionType } from '@lib/database/Types';
import { kTargetToTypeId } from '@lib/subscriptions/drivers/HelpDriver';

/**
 * Subscription data is a key/value mapping of active subscriptions.
 */
const kUpdateSubscriptionsData = z.looseObject({ /* freeform */ });

/**
 * Server Action through which subscriptions can be updated. This action executes a diffing
 * operation to align the database with the submitted configuration. Subscriptions that are no
 * longer recognised (because they e.g. have been removed) will be silently removed.
 */
async function updateSubscriptions(userId: number, formData: unknown) {
    'use server';
    return executeServerAction(formData, kUpdateSubscriptionsData, async (data, props) => {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: 'system.subscriptions.management',
        });

        const subscriptionTypes = await getSubscriptionTypes();

        const activeSubscriptions = await db.selectFrom(tSubscriptions)
            .where(tSubscriptions.subscriptionUserId.equals(userId))
            .select({
                id: tSubscriptions.subscriptionId,
                type: tSubscriptions.subscriptionType,
                typeId: tSubscriptions.subscriptionTypeId,
                channelEmail: tSubscriptions.subscriptionChannelEmail,
                channelSms: tSubscriptions.subscriptionChannelSms,
                channelWhatsapp: tSubscriptions.subscriptionChannelWhatsapp,
            })
            .executeSelectMany();

        await db.transaction(async () => {
            const consultedActiveSubscriptions: Set<number> = new Set();

            for (const subscriptionType of subscriptionTypes) {
                let channels: string[] = [ /* none */ ];
                if (Object.hasOwn(data, subscriptionType.id))
                    channels = data[subscriptionType.id] as string[];

                const email = channels.includes('email') ? 1 : 0;
                const sms = channels.includes('sms') ? 1 : 0;
                const whatsapp = channels.includes('whatsapp') ? 1 : 0;

                const existing = activeSubscriptions.find(subscription => {
                    return subscription.type === subscriptionType.type &&
                           subscription.typeId === (subscriptionType.typeId ?? undefined);
                });

                if (existing)
                    consultedActiveSubscriptions.add(existing.id);

                if (email === 0 && sms === 0 && whatsapp === 0) {
                    if (existing) {
                        await db.deleteFrom(tSubscriptions)
                            .where(tSubscriptions.subscriptionId.equals(existing.id))
                            .executeDelete();
                    }
                } else {
                    if (existing) {
                        if (existing.channelEmail !== email || existing.channelSms !== sms ||
                                existing.channelWhatsapp !== whatsapp)
                        {
                            await db.update(tSubscriptions)
                                .set({
                                    subscriptionChannelEmail: email,
                                    subscriptionChannelSms: sms,
                                    subscriptionChannelWhatsapp: whatsapp,
                                })
                                .where(tSubscriptions.subscriptionId.equals(existing.id))
                                .executeUpdate();
                        }
                    } else {
                        await db.insertInto(tSubscriptions)
                            .set({
                                subscriptionUserId: userId,
                                subscriptionType: subscriptionType.type,
                                subscriptionTypeId: subscriptionType.typeId,
                                subscriptionChannelEmail: email,
                                subscriptionChannelNotification: 0,
                                subscriptionChannelSms: sms,
                                subscriptionChannelWhatsapp: whatsapp,
                            })
                            .executeInsert();
                    }
                }
            }

            for (const subscription of activeSubscriptions) {
                if (consultedActiveSubscriptions.has(subscription.id))
                    continue;

                await db.deleteFrom(tSubscriptions)
                    .where(tSubscriptions.subscriptionId.equals(subscription.id))
                    .executeDelete();
            }
        });

        LogBuilder.for('UpdateAccountSubscriptions')
            .withInitiatorUser(props.user)
            .withAffectedUser(userId)
            .withSeverity('Warning')
            .record();

        return { success: true };
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
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.subscriptions.management',
    });

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
            email: tUsers.username,
            phoneNumber: tUsers.phoneNumber,

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
    const subscriptionTypeIds = new Set<string>();

    let hasEmailSubscription = false;
    let hasPhoneNumberSubscription = false;

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

        subscriptionTypeIds.add(type);

        const values: string[] = [ /* none yet */ ];
        for (const [ channel, enabled ] of Object.entries(subscription.channels || [])) {
            if (!enabled)
                continue;

            switch (channel) {
                case 'email':
                    hasEmailSubscription = true;
                    break;

                case 'sms':
                case 'whatsapp':
                    hasPhoneNumberSubscription = true;
                    break;

                default:
                    throw new Error(`Unrecognised subscription channel found: ${channel}`);
            }

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
                    Subscriptions available for <InlineAccountLink user={user} /> over e-mail, SMS
                    or WhatsApp.
                </SectionIntroduction>
            </Section>
            <Section noHeader>
                <FormGrid action={serverAction} defaultValues={defaultValues}>
                    { (!user.email && hasEmailSubscription) &&
                        <Grid size={{ xs: 12 }}>
                            <Alert severity="error">
                                {user.firstName} has subscriptions to their e-mail address, but we
                                don't have their address on file.
                            </Alert>
                        </Grid> }
                    { (!user.phoneNumber && hasPhoneNumberSubscription) &&
                        <Grid size={{ xs: 12 }}>
                            <Alert severity="error">
                                {user.firstName} has subscriptions to their phone number, but we
                                don't have their number on file.
                            </Alert>
                        </Grid> }
                    <Grid size={{ xs: 12 }}>
                        <List disablePadding sx={{ my: -2 }}>
                            { subscriptionTypes.map((subscriptionType, index) =>
                                <ListItem key={index} disableGutters
                                          divider={ index < subscriptionTypes.length - 1 }>
                                    <ListItemIcon>
                                        <subscriptionType.Icon color={
                                            subscriptionTypeIds.has(subscriptionType.id)
                                                ? 'primary'
                                                : 'disabled' } />
                                    </ListItemIcon>
                                    <ListItemText primary={subscriptionType.label}
                                                  secondary={subscriptionType.description}
                                                  slotProps={{
                                                      primary: { noWrap: true, variant: 'body2' },
                                                      secondary: { noWrap: true, variant: 'body2' },
                                                  }} />
                                    <Box sx={{ ml: 2 }}>
                                        <ToggleButtonGroupElement name={subscriptionType.id}
                                                                  options={kChannelOptions}
                                                                  color="primary" size="small" />
                                    </Box>
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
            label: 'Internal test messages',
            description: /* none= */ '',
        },
    ];
}
