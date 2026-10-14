// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Suspense } from 'react';

import Alert from '@mui/material/Alert';
import EventNoteIcon from '@mui/icons-material/EventNote';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import LocalActivityOutlinedIcon from '@mui/icons-material/LocalActivityOutlined';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { SectionLoading } from '@app/admin/components/SectionLoading';
import { WeeztixIcon } from '@app/admin/components/icons/WeeztixIcon';
import { createGenerateMetadataFn } from '@app/admin/lib/generatePageMetadata';
import { createWeeztixClient, type WeeztixClient } from '@lib/integrations/weeztix';
import { requireAuthentication } from '@lib/requireAuthentication';

/**
 * Callback signature for sequentially executing an operation against the `WeeztixClient`.
 */
type WeeztixClientFn = <T>(fn: (client: WeeztixClient) => Promise<T>) => Promise<T>;

/**
 * Page that demonstrates some of Weeztix' APIs, primarily to test the implementation and provide
 * quick insight in values (such as event GUIDs) that may be repeatedly needed.
 */
export default async function WeeztixIntegrationPage() {
    await requireAuthentication('system.integrations');

    const client = await createWeeztixClient();

    let queue: Promise<unknown> = Promise.resolve();
    const clientFn: WeeztixClientFn = fn => {
        const result = queue.then(() => fn(client));
        queue = result.catch(() => undefined);

        return result;
    };

    return (
        <>
            <Section icon={ <WeeztixIcon /> } title="Weeztix"
                     breadcrumbs={[
                         { label: 'System', href: '/admin/system' },
                         { label: 'Integrations', href: '/admin/system/integrations' },
                         { label: 'Weeztix' },
                     ]}>
                <SectionIntroduction>
                    Weeztix is AnimeCon's ticketing partner, which we integrate with for purposes of
                    providing statistics, scanning capabilities, and ticket automations.
                </SectionIntroduction>
            </Section>
            <Section icon={ <EventNoteIcon />} title="Events">
                <Suspense fallback={ <SectionLoading /> }>
                    <WeeztixEventList clientFn={clientFn} />
                </Suspense>
            </Section>
            <Section icon={ <QrCodeScannerIcon /> } title="Scanners">
                <Suspense fallback={ <SectionLoading /> }>
                    <WeeztixScannerList clientFn={clientFn} />
                </Suspense>
            </Section>
        </>
    );
}

/**
 * Displays the event list using the Weeztix API.
 */
async function WeeztixEventList(props: { clientFn: WeeztixClientFn }) {
    const events = await props.clientFn(client => client.listEvents());
    return (
        <>
            { !events.length &&
                <Alert severity="warning" variant="outlined">
                    No events could be obtained from Weeztix
                </Alert> }
            { !!events.length &&
                <List dense disablePadding>
                    { events.map((event, index) =>
                        <ListItem key={event.guid} disableGutters
                                  divider={ index !== events.length - 1 }>
                            <ListItemIcon>
                                <LocalActivityOutlinedIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary={event.name}
                                secondary={`${event.location.name} / GUID: ${event.guid}`} />
                        </ListItem> ) }
                </List> }
        </>
    );
}

/**
 * Displays the scanner list using the Weeztix API.
 */
async function WeeztixScannerList(props: { clientFn: WeeztixClientFn }) {
    const scanners = await props.clientFn(client => client.listScannerTypes());
    return (
        <>
            { !scanners.length &&
                <Alert severity="warning" variant="outlined">
                    No scanners could be obtained from Weeztix
                </Alert> }
            { !!scanners.length &&
                <List dense disablePadding>
                    { scanners.map((scanner, index) =>
                        <ListItem key={scanner.guid} disableGutters
                                  divider={ index !== scanners.length - 1 }>
                            <ListItemIcon>
                                <PhotoCameraOutlinedIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary={scanner.name}
                                secondary={`Event: ${scanner.event_id} / GUID: ${scanner.guid}`} />
                        </ListItem> ) }
                </List> }
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Weeztix', 'Integrations', 'System');
