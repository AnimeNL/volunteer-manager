// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';

import { PlaceholderPage } from '../components/PlaceholderPage';

/**
 * Placeholder Scanner page for the schedule portal.
 */
export default function ScheduleScannerPage(props: PageProps<'/schedule2/[event]/scanner'>) {
    return (
        <PlaceholderPage
            description="Scan QR codes using your device's camera."
            icon={ <QrCodeScannerIcon /> }
            params={props.params}
            title="Scanner" />
    );
}

export const instant = true;
export const prefetch = 'partial';
