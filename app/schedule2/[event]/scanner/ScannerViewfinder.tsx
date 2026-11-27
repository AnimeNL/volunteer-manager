// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Box from '@mui/material/Box';
import CameraswitchOutlinedIcon from '@mui/icons-material/CameraswitchOutlined';
import CircularProgress from '@mui/material/CircularProgress';
import FlashlightOffOutlinedIcon from '@mui/icons-material/FlashlightOffOutlined';
import FlashlightOnOutlinedIcon from '@mui/icons-material/FlashlightOnOutlined';
import IconButton from '@mui/material/IconButton';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import Stack from '@mui/material/Stack';
import { styled } from '@mui/material/styles';

/**
 * Props accepted by the <ScannerViewfinder> component.
 */
interface ScannerViewfinderProps {
    canSwitchCamera: boolean;
    flashActive: boolean;
    hasTorch: boolean;
    initializing: boolean;
    onPickPhoto: () => void;
    onSwitchCamera: () => void;
    onToggleTorch: () => void;
    torchEnabled: boolean;
    videoRef: React.RefObject<HTMLVideoElement | null>;
}

/**
 * Live camera viewfinder with initialization overlay, scanning reticle, and overlay controls.
 */
export function ScannerViewfinder(props: ScannerViewfinderProps) {
    const {
        canSwitchCamera,
        flashActive,
        hasTorch,
        initializing,
        onPickPhoto,
        onSwitchCamera,
        onToggleTorch,
        torchEnabled,
        videoRef,
    } = props;

    return (
        <Box
            sx={{
                aspectRatio: { xs: '1 / 1', sm: '4 / 3' },
                bgcolor: 'common.black',
                borderRadius: 1,
                maxHeight: 440,
                overflow: 'hidden',
                position: 'relative',
                width: '100%',
            }}>
            <Box
                component="video"
                ref={videoRef}
                autoPlay
                muted
                playsInline
                sx={{ display: 'block', height: '100%', objectFit: 'cover', width: '100%' }} />

            { initializing &&
                <Stack
                    sx={{
                        alignItems: 'center',
                        bgcolor: 'rgba(0, 0, 0, 0.45)',
                        color: 'common.white',
                        inset: 0,
                        justifyContent: 'center',
                        position: 'absolute',
                    }}>
                    <CircularProgress color="inherit" size={32} />
                </Stack> }

            { !initializing &&
                <>
                    <ReticleFrame active={flashActive} aria-hidden="true" />
                    <Stack
                        direction="row"
                        spacing={1}
                        sx={{ bottom: 12, position: 'absolute', right: 12, zIndex: 1 }}>
                        { hasTorch &&
                            <OverlayIconButton
                                aria-label={
                                    torchEnabled ? 'Turn off flashlight' : 'Turn on flashlight'
                                }
                                onClick={onToggleTorch}
                                size="small">
                                { torchEnabled
                                    ? <FlashlightOffOutlinedIcon fontSize="small" />
                                    : <FlashlightOnOutlinedIcon fontSize="small" /> }
                            </OverlayIconButton> }
                        { canSwitchCamera &&
                            <OverlayIconButton
                                aria-label="Switch camera"
                                onClick={onSwitchCamera}
                                size="small">
                                <CameraswitchOutlinedIcon fontSize="small" />
                            </OverlayIconButton> }
                        <OverlayIconButton
                            aria-label="Scan from photo"
                            onClick={onPickPhoto}
                            size="small">
                            <ImageOutlinedIcon fontSize="small" />
                        </OverlayIconButton>
                    </Stack>
                </> }
        </Box>
    );
}

const ReticleFrame = styled(Box, {
    shouldForwardProp: prop => prop !== 'active',
})<{ active: boolean }>(({ theme }) => ({
    border: '2px solid rgba(255, 255, 255, 0.72)',
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

    variants: [
        {
            props: { active: true },
            style: {
                borderColor: (theme.vars || theme).palette.primary.main,
            },
        },
    ],
}));

const OverlayIconButton = styled(IconButton)(({ theme }) => ({
    backgroundColor: 'rgba(0, 0, 0, 0.56)',
    color: (theme.vars || theme).palette.common.white,
    padding: theme.spacing(1),

    '&:hover': {
        backgroundColor: 'rgba(0, 0, 0, 0.76)',
    },
}));
