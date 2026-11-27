// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { type QrDetector, getQrDetector } from './createQrDetector';

/**
 * Interval between consecutive QR frame detection attempts, in milliseconds.
 */
const kScanIntervalMs = 180;

/**
 * Duration during which duplicate scans of the same barcode are suppressed, in milliseconds.
 */
const kDuplicateCooldownMs = 2500;

/**
 * Lifecycle state of the camera-based QR scanner.
 */
type ScannerStatus =
    'initializing' | 'scanning' | 'permission-denied' | 'unavailable' | 'error';

/**
 * Options accepted by the `useQrScanner` hook.
 */
interface UseQrScannerOptions {
    /**
     * Callback invoked whenever a new (non-duplicate) QR code value is decoded.
     */
    onScan: (barcode: string) => void;
}

/**
 * Return value of the `useQrScanner` hook.
 */
interface UseQrScannerResult {
    canSwitchCamera: boolean;
    errorMessage?: string;
    hasTorch: boolean;
    retry: () => void;
    scanFile: (file: File) => Promise<string | undefined>;
    status: ScannerStatus;
    switchCamera: () => void;
    toggleTorch: () => Promise<void>;
    torchEnabled: boolean;
    videoRef: React.RefObject<HTMLVideoElement | null>;
}

/**
 * Maps a `getUserMedia()` error to a user-facing `ScannerStatus` and optional message.
 */
function classifyCameraError(error: unknown): { message?: string; status: ScannerStatus } {
    const name = error instanceof DOMException ? error.name : undefined;
    switch (name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
            return { status: 'permission-denied' };

        case 'NotFoundError':
        case 'DevicesNotFoundError':
            return {
                message: 'No camera was detected on this device.',
                status: 'unavailable',
            };

        case 'NotReadableError':
        case 'TrackStartError':
        case 'AbortError':
            return {
                message: 'The camera is currently in use by another application.',
                status: 'unavailable',
            };

        case 'OverconstrainedError':
            return {
                message: 'The selected camera could not be opened.',
                status: 'unavailable',
            };

        default:
            return {
                message: error instanceof Error
                    ? error.message
                    : 'Unable to start the camera.',
                status: 'error',
            };
    }
}

/**
 * Stops every media track in `stream` and detaches it from `video`.
 */
function stopMediaStream(stream: MediaStream | null, video: HTMLVideoElement | null) {
    if (stream) {
        for (const track of stream.getTracks())
            track.stop();
    }
    if (video && video.srcObject === stream)
        video.srcObject = null;
}

/**
 * Returns whether `track` advertises torch (flashlight) support via `getCapabilities()`.
 */
function trackSupportsTorch(track: MediaStreamTrack | undefined): boolean {
    if (!track || typeof track.getCapabilities !== 'function')
        return false;

    const capabilities = track.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
    return Boolean(capabilities.torch);
}

/**
 * Manages camera acquisition, QR code detection polling, torch/camera controls, and clean teardown
 * across mobile (Android/iOS) and desktop browsers.
 */
export function useQrScanner(options: UseQrScannerOptions): UseQrScannerResult {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const onScanRef = useRef(options.onScan);
    onScanRef.current = options.onScan;

    const lastScanRef = useRef<{ barcode: string; timestamp: number }>({
        barcode: '',
        timestamp: 0,
    });

    const [ status, setStatus ] = useState<ScannerStatus>('initializing');
    const [ errorMessage, setErrorMessage ] = useState<string | undefined>();
    const [ videoDevices, setVideoDevices ] = useState<MediaDeviceInfo[]>([]);
    const [ session, setSession ] = useState<{ attempt: number; deviceId?: string }>({
        attempt: 0,
    });
    const [ hasTorch, setHasTorch ] = useState<boolean>(false);
    const [ torchEnabled, setTorchEnabled ] = useState<boolean>(false);
    const [ pageVisible, setPageVisible ] = useState<boolean>(
        () => (typeof document === 'undefined' ? true : document.visibilityState === 'visible'));

    useEffect(() => {
        function handleVisibilityChange() {
            setPageVisible(document.visibilityState === 'visible');
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    useEffect(() => {
        if (!pageVisible)
            return;

        const { deviceId } = session;
        let cancelled = false;
        let timerId: ReturnType<typeof setTimeout> | undefined;

        async function startScanner() {
            setStatus('initializing');
            setErrorMessage(undefined);
            setHasTorch(false);
            setTorchEnabled(false);

            if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
                setErrorMessage(
                    'Camera access is unavailable in this browser or requires a secure (HTTPS) ' +
                    'connection.');
                setStatus('unavailable');
                return;
            }

            let stream: MediaStream;
            let detector: QrDetector;
            try {
                const videoConstraints: MediaTrackConstraints = deviceId
                    ? { deviceId: { exact: deviceId } }
                    : { facingMode: { ideal: 'environment' } };

                [ stream, detector ] = await Promise.all([
                    navigator.mediaDevices.getUserMedia({ audio: false, video: videoConstraints }),
                    getQrDetector(),
                ]);
            } catch (error) {
                if (cancelled)
                    return;

                const classified = classifyCameraError(error);
                setErrorMessage(classified.message);
                setStatus(classified.status);
                return;
            }

            if (cancelled) {
                stopMediaStream(stream, null);
                return;
            }

            streamRef.current = stream;

            const videoTrack = stream.getVideoTracks()[0];
            setHasTorch(trackSupportsTorch(videoTrack));

            const video = videoRef.current;
            if (video) {
                video.srcObject = stream;
                try {
                    await video.play();
                } catch {
                    // Autoplay may already be active or briefly interrupted during route changes.
                }
            }

            if (cancelled) {
                stopMediaStream(stream, videoRef.current);
                streamRef.current = null;
                return;
            }

            setStatus('scanning');

            // Enumerate video inputs after permission is granted so labels and IDs are populated.
            if (typeof navigator.mediaDevices.enumerateDevices === 'function') {
                navigator.mediaDevices.enumerateDevices()
                    .then(devices => {
                        if (!cancelled)
                            setVideoDevices(devices.filter(device => device.kind === 'videoinput'));
                    })
                    .catch(() => { /* ignore enumeration errors */ });
            }

            async function pollFrame() {
                if (cancelled)
                    return;

                const currentVideo = videoRef.current;
                if (currentVideo &&
                        currentVideo.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA &&
                        currentVideo.videoWidth > 0)
                {
                    try {
                        const rawValue = await detector.detect(currentVideo);
                        if (!cancelled && rawValue) {
                            const now = Date.now();
                            const previous = lastScanRef.current;
                            if (rawValue !== previous.barcode ||
                                    now - previous.timestamp >= kDuplicateCooldownMs)
                            {
                                lastScanRef.current = { barcode: rawValue, timestamp: now };
                                onScanRef.current(rawValue);
                            }
                        }
                    } catch {
                        // Ignore transient per-frame decode errors and continue polling.
                    }
                }

                if (!cancelled)
                    timerId = setTimeout(pollFrame, kScanIntervalMs);
            }

            timerId = setTimeout(pollFrame, kScanIntervalMs);
        }

        void startScanner();

        return () => {
            cancelled = true;
            if (timerId !== undefined)
                clearTimeout(timerId);

            stopMediaStream(streamRef.current, videoRef.current);
            streamRef.current = null;
            setHasTorch(false);
            setTorchEnabled(false);
        };
    }, [ pageVisible, session ]);

    const retry = useCallback(() => {
        setSession(current => ({ attempt: current.attempt + 1 }));
    }, []);

    const switchCamera = useCallback(() => {
        if (videoDevices.length < 2)
            return;

        const currentTrackId = streamRef.current?.getVideoTracks()[0]?.getSettings().deviceId;
        const currentIndex = videoDevices.findIndex(
            device => device.deviceId === (session.deviceId ?? currentTrackId));
        const nextDevice = videoDevices[(currentIndex + 1) % videoDevices.length];

        if (nextDevice) {
            setSession(current => ({
                attempt: current.attempt + 1,
                deviceId: nextDevice.deviceId,
            }));
        }
    }, [ session.deviceId, videoDevices ]);

    const toggleTorch = useCallback(async () => {
        const videoTrack = streamRef.current?.getVideoTracks()[0];
        if (!videoTrack || !hasTorch)
            return;

        const nextEnabled = !torchEnabled;
        try {
            await videoTrack.applyConstraints({
                advanced: [ { torch: nextEnabled } as MediaTrackConstraintSet ],
            });
            setTorchEnabled(nextEnabled);
        } catch {
            // Some devices report torch capability but reject runtime constraint changes.
        }
    }, [ hasTorch, torchEnabled ]);

    const scanFile = useCallback(async (file: File): Promise<string | undefined> => {
        const detector = await getQrDetector();
        const barcode = await detector.detect(file);
        if (barcode)
            onScanRef.current(barcode);

        return barcode;
    }, []);

    return {
        canSwitchCamera: videoDevices.length > 1,
        errorMessage,
        hasTorch,
        retry,
        scanFile,
        status,
        switchCamera,
        toggleTorch,
        torchEnabled,
        videoRef,
    };
}
