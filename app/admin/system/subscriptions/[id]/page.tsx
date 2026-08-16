// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { ToggleButtonGroupElement } from '@app/components/proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import StreamIcon from '@mui/icons-material/Stream';
import TextsmsOutlinedIcon from '@mui/icons-material/TextsmsOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';

import { FormGrid } from '@app/admin/components/FormGrid';
import { InlineAccountLink } from '@app/admin/components/InlineAccountLink';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { SubscriptionTypeIcon } from './SubscriptionTypeIcon';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { getSubscriptionTypes, updateSubscriptions } from '../SubscriptionActions';
import { kSubscriptionType } from '@lib/database/Types';
import { requireAuthentication } from '@app/admin/lib/requireAuthentication';
import db, { tSubscriptions, tUsers } from '@lib/database';

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
    await requireAuthentication('system.subscriptions.management');

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
                                        <SubscriptionTypeIcon Icon={subscriptionType.Icon}
                                                              name={subscriptionType.id} />
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

export const generateMetadata =
    createGenerateMetadataFn({ user: 'id' }, 'Subscriptions', 'Communication');
