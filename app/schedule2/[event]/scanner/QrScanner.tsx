// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import Alert from '@mui/material/Alert';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import NoPhotographyOutlinedIcon from '@mui/icons-material/NoPhotographyOutlined';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import VideocamOffOutlinedIcon from '@mui/icons-material/VideocamOffOutlined';

import { ScannerBlockedState } from './ScannerBlockedState';
import { ScannerViewfinder } from './ScannerViewfinder';
import { useQrScanner } from './useQrScanner';

import { recordScannedBarcode } from './ScannerActions';

/**
 * Props accepted by the <QrScanner> component.
 */
interface QrScannerProps {
    /**
     * Slug of the active event passed to the scanner Server Action.
     */
    eventSlug: string;
}

/**
 * Last scan feedback shown beneath the viewfinder.
 */
interface ScanFeedback {
    barcode?: string;
    error?: string;
    pending?: boolean;
}

/**
 * Interactive camera QR code scanner with permission-declined and unavailable states, camera and
 * torch controls, and a photo-upload fallback.
 */
export function QrScanner(props: QrScannerProps) {
    const { eventSlug } = props;
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const flashTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const [ feedback, setFeedback ] = useState<ScanFeedback | undefined>();
    const [ flashActive, setFlashActive ] = useState<boolean>(false);

    useEffect(() => () => clearTimeout(flashTimerRef.current), []);

    const handleScan = useCallback(async (barcode: string) => {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function')
            navigator.vibrate(50);

        clearTimeout(flashTimerRef.current);
        setFlashActive(true);
        flashTimerRef.current = setTimeout(() => setFlashActive(false), 350);

        setFeedback({ barcode, pending: true });

        const response = await recordScannedBarcode(eventSlug, barcode);
        if (response.success)
            setFeedback({ barcode });
        else
            setFeedback({ barcode, error: response.error ?? 'Unable to record the scanned code.' });
    }, [ eventSlug ]);

    const scanner = useQrScanner({ onScan: handleScan });

    async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file)
            return;

        try {
            const barcode = await scanner.scanFile(file);
            if (!barcode)
                setFeedback({ error: 'No QR code was found in the selected image.' });
        } catch {
            setFeedback({ error: 'Unable to read the selected image.' });
        }
    }

    const triggerFilePicker = () => fileInputRef.current?.click();

    return (
        <Stack spacing={2}>
            <input
                ref={fileInputRef}
                accept="image/*"
                capture="environment"
                hidden
                onChange={handleFileSelected}
                type="file" />

            { scanner.status === 'permission-denied' &&
                <ScannerBlockedState
                    description={
                        'Camera access was declined. To scan QR codes directly, allow camera ' +
                        'access for this site in your browser settings and try again, or scan ' +
                        'a QR code from a photo.'
                    }
                    icon={ <NoPhotographyOutlinedIcon fontSize="large" /> }
                    onPickPhoto={triggerFilePicker}
                    onRetry={scanner.retry}
                    title="Camera permission declined" /> }

            { (scanner.status === 'unavailable' || scanner.status === 'error') &&
                <ScannerBlockedState
                    description={
                        scanner.errorMessage ??
                        'Unable to access the camera on this device. You can try again or scan ' +
                        'a QR code from a photo.'
                    }
                    icon={
                        scanner.status === 'unavailable'
                            ? <VideocamOffOutlinedIcon fontSize="large" />
                            : <ErrorOutlinedIcon fontSize="large" />
                    }
                    onPickPhoto={triggerFilePicker}
                    onRetry={scanner.retry}
                    title={
                        scanner.status === 'unavailable'
                            ? 'Camera unavailable'
                            : 'Unable to start scanner'
                    } /> }

            { (scanner.status === 'initializing' || scanner.status === 'scanning') &&
                <ScannerViewfinder
                    canSwitchCamera={scanner.canSwitchCamera}
                    flashActive={flashActive}
                    hasTorch={scanner.hasTorch}
                    initializing={scanner.status === 'initializing'}
                    onPickPhoto={triggerFilePicker}
                    onSwitchCamera={scanner.switchCamera}
                    onToggleTorch={() => void scanner.toggleTorch()}
                    torchEnabled={scanner.torchEnabled}
                    videoRef={scanner.videoRef} /> }

            { feedback?.error &&
                <Alert severity="error" onClose={() => setFeedback(undefined)}>
                    {feedback.error}
                </Alert> }

            { feedback?.barcode && !feedback.error &&
                <Alert severity={feedback.pending ? 'info' : 'success'}
                       onClose={() => setFeedback(undefined)}>
                    <Typography component="span" variant="body2">
                        { feedback.pending ? 'Processing code: ' : 'Scanned code: ' }
                    </Typography>
                    <Typography
                        component="span"
                        variant="body2"
                        sx={{ fontFamily: 'monospace', letterSpacing: 1 }}>
                        {feedback.barcode}
                    </Typography>
                </Alert> }
        </Stack>
    );
}
