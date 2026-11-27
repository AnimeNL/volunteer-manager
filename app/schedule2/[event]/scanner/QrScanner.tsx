// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useRef, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CameraswitchOutlinedIcon from '@mui/icons-material/CameraswitchOutlined';
import CircularProgress from '@mui/material/CircularProgress';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import FlashlightOffOutlinedIcon from '@mui/icons-material/FlashlightOffOutlined';
import FlashlightOnOutlinedIcon from '@mui/icons-material/FlashlightOnOutlined';
import IconButton from '@mui/material/IconButton';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import NoPhotographyOutlinedIcon from '@mui/icons-material/NoPhotographyOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import VideocamOffOutlinedIcon from '@mui/icons-material/VideocamOffOutlined';
import { styled } from '@mui/material/styles';

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

    const [ feedback, setFeedback ] = useState<ScanFeedback | undefined>();
    const [ flashActive, setFlashActive ] = useState<boolean>(false);

    const handleScan = useCallback(async (barcode: string) => {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function')
            navigator.vibrate(50);

        setFlashActive(true);
        setTimeout(() => setFlashActive(false), 350);

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
                <Viewfinder>
                    <VideoPreview
                        ref={scanner.videoRef}
                        autoPlay
                        muted
                        playsInline />

                    { scanner.status === 'initializing' &&
                        <ViewfinderOverlay>
                            <CircularProgress color="inherit" size={32} />
                        </ViewfinderOverlay> }

                    { scanner.status === 'scanning' &&
                        <>
                            <ReticleFrame active={flashActive} aria-hidden="true" />
                            <ControlsBar direction="row" spacing={1}>
                                { scanner.hasTorch &&
                                    <OverlayIconButton
                                        aria-label={
                                            scanner.torchEnabled
                                                ? 'Turn off flashlight'
                                                : 'Turn on flashlight'
                                        }
                                        onClick={() => void scanner.toggleTorch()}
                                        size="small">
                                        { scanner.torchEnabled
                                            ? <FlashlightOffOutlinedIcon fontSize="small" />
                                            : <FlashlightOnOutlinedIcon fontSize="small" /> }
                                    </OverlayIconButton> }
                                { scanner.canSwitchCamera &&
                                    <OverlayIconButton
                                        aria-label="Switch camera"
                                        onClick={scanner.switchCamera}
                                        size="small">
                                        <CameraswitchOutlinedIcon fontSize="small" />
                                    </OverlayIconButton> }
                                <OverlayIconButton
                                    aria-label="Scan from photo"
                                    onClick={triggerFilePicker}
                                    size="small">
                                    <ImageOutlinedIcon fontSize="small" />
                                </OverlayIconButton>
                            </ControlsBar>
                        </> }
                </Viewfinder> }

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
                    <Typography component="span" variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {feedback.barcode}
                    </Typography>
                </Alert> }
        </Stack>
    );
}

/**
 * Empty/blocked state shown when camera permission is declined or no camera is available.
 */
function ScannerBlockedState(props: {
    description: string;
    icon: React.ReactNode;
    onPickPhoto: () => void;
    onRetry: () => void;
    title: string;
}) {
    return (
        <BlockedContainer spacing={2}>
            <BlockedIconBadge>
                {props.icon}
            </BlockedIconBadge>
            <Stack spacing={0.5} sx={{ maxWidth: 380 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {props.title}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                    {props.description}
                </Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button onClick={props.onRetry} startIcon={ <RefreshIcon /> } variant="contained">
                    Try again
                </Button>
                <Button onClick={props.onPickPhoto} startIcon={ <ImageOutlinedIcon /> }
                        variant="outlined">
                    Scan from photo
                </Button>
            </Stack>
        </BlockedContainer>
    );
}

const Viewfinder = styled(Box)(({ theme }) => ({
    aspectRatio: '1 / 1',
    backgroundColor: '#000000',
    borderRadius: theme.spacing(1.5),
    maxHeight: 440,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',

    [theme.breakpoints.up('sm')]: {
        aspectRatio: '4 / 3',
    },
}));

const VideoPreview = styled('video')({
    display: 'block',
    height: '100%',
    objectFit: 'cover',
    width: '100%',
});

const ViewfinderOverlay = styled(Box)({
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    color: '#ffffff',
    display: 'flex',
    inset: 0,
    justifyContent: 'center',
    position: 'absolute',
});

const ReticleFrame = styled(Box, {
    shouldForwardProp: prop => prop !== 'active',
})<{ active: boolean }>(({ active, theme }) => ({
    border: `2px solid ${active ? (theme.vars || theme).palette.m3.primary : 'rgba(255, 255, 255, 0.72)'}`,
    borderRadius: theme.spacing(2),
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.28)',
    height: '62%',
    left: '50%',
    maxHeight: 240,
    maxWidth: 240,
    pointerEvents: 'none',
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    transition: theme.transitions.create('border-color', {
        duration: theme.transitions.duration.shorter,
    }),
    width: '62%',
}));

const ControlsBar = styled(Stack)(({ theme }) => ({
    bottom: theme.spacing(1.5),
    position: 'absolute',
    right: theme.spacing(1.5),
    zIndex: 1,
}));

const OverlayIconButton = styled(IconButton)(({ theme }) => ({
    backgroundColor: 'rgba(0, 0, 0, 0.56)',
    color: '#ffffff',
    padding: theme.spacing(1),

    '&:hover': {
        backgroundColor: 'rgba(0, 0, 0, 0.76)',
    },
}));

const BlockedContainer = styled(Stack)(({ theme }) => {
    const palette = (theme.vars || theme).palette;
    return {
        alignItems: 'center',
        backgroundColor: palette.m3.shell,
        borderRadius: theme.spacing(1.5),
        padding: theme.spacing(4, 2.5),
        textAlign: 'center',
    };
});

const BlockedIconBadge = styled(Box)(({ theme }) => {
    const palette = (theme.vars || theme).palette;
    return {
        alignItems: 'center',
        backgroundColor: palette.m3.secondaryContainer,
        borderRadius: '50%',
        color: palette.m3.onSecondaryContainer,
        display: 'flex',
        height: 64,
        justifyContent: 'center',
        width: 64,
    };
});
