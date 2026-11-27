// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import Skeleton from '@mui/material/Skeleton';

import { Header } from '../components/Header';
import { Page, SuspenseReveal } from '../components/Page';
import { QrScanner } from './QrScanner';
import { readCachedSetting } from '@lib/Settings';
import { requireScheduleAccess } from '../lib/getScheduleAccess';

/**
 * Authenticates the request behind `<Suspense>`, verifies the scanner is enabled, and renders the
 * interactive QR code scanner.
 */
async function ScannerContent(props: { params: Promise<{ event: string }> }) {
    const { event: eventSlug } = await props.params;
    const [ { event }, scannerEnabled ] = await Promise.all([
        requireScheduleAccess(eventSlug),
        readCachedSetting('schedule-enable-scanner', false),
    ]);

    if (!scannerEnabled)
        notFound();

    return <QrScanner eventSlug={event.slug} />;
}

/**
 * Skeleton placeholder matching the scanner viewfinder while access and settings stream.
 */
function ScannerSkeleton() {
    return (
        <Skeleton variant="rounded" sx={{
            aspectRatio: { xs: '1 / 1', sm: '4 / 3' },
            borderRadius: 1,
            height: 'auto',
            maxHeight: 440,
            width: '100%',
        }} />
    );
}

/**
 * QR code scanner page for the schedule portal.
 */
export default function ScheduleScannerPage(props: PageProps<'/schedule2/[event]/scanner'>) {
    return (
        <Page
            header={
                <Header
                    description="Scan QR codes using your device's camera."
                    icon={ <QrCodeScannerIcon /> }
                    title="Scanner" />
            }>
            <Card>
                <CardContent>
                    <SuspenseReveal fallback={ <ScannerSkeleton /> }>
                        <ScannerContent params={props.params} />
                    </SuspenseReveal>
                </CardContent>
            </Card>
        </Page>
    );
}

export const instant = true;
export const prefetch = 'partial';
