// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { Suspense, use, useMemo } from 'react';

import Skeleton from '@mui/material/Skeleton';
import QrCodeWithLogo from 'qrcode-with-logos';
import { styled, useTheme } from '@mui/material/styles';

/**
 * SVG of the logo to place in the center of our QR codes. This SVG represents the cow from the
 * AnimeCon logo, centered in a square display.
 */
const kQrLogo =
    '<svg xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 560 560"><path fill="{color}" d="M150.5 561a3292 3292 0 0 0 18.8-117c1.2-8.7 1.7-17.5 2.4-26.3q2.7-31 3.6-62.2.7-30.5-1.5-60.8c-1.9-26.7-6.7-53-10.3-79.5-1.3-9.7-3.3-19.2-5.3-30.1-3 7.9-4.6 15-7.9 21.5q-21 41.9-60.8 66.7c-17.5 11-36.6 19-55.6 27-4.5 1.8-5.2 1-4.5-3.9a213 213 0 0 1 37.8-96.2 173 173 0 0 1 81.7-63.3q.6-.4 1-1c0-1.5-1.1-2.1-1.8-3-18.5-20.6-15.3-53 1.8-71.2q1-1.2 2-2.2c5.6-4.3 11.5-6.8 18.6-4 7 2.6 8.3 8.6 8.8 15 .6 9 1.7 18 9.9 23.9 4.8 3.4 9.6 6.6 12.6 12.7a154 154 0 0 1 89.5-30.2c.1-8.8 3.7-16.9 3.8-25.6q-.1-10.6-5-19.6-2.2-3.8-4-7.5c-4.8-11.8 1.5-21.6 14.3-22.5 24.8-1.7 50 21.4 51 46.3.2 7.4-1.3 14.5-3.1 21.9q104-2.7 175.7 71.8c9.7 10.1 18.8 21 24.7 35.1-59.1 11.6-112.8 1.7-162.3-33l13.3 39.2a436 436 0 0 1 19.5 84.5q.6 6.7 1.1 13.4c.3 3.5-.3 6.7-3.2 9-3.2 2.6-2.6 4.6 0 7.3a33 33 0 0 1 10.4 23c0 9.4-3.9 16.9-10.4 23-2.7 2.4-2.6 3.9-.7 6.6 5.5 7.5 5.4 7.6 15.2 5.4a89 89 0 0 1 47.4-.4c24.9 7.7 42.6 22.4 46.7 49.7 2.4 16-2 30.5-11.7 43.1a60 60 0 0 1-52.5 24.7q-19-1-34-12.8c-2.3-2-4-2.2-6.4.1A139 139 0 0 1 353 496a19 19 0 0 0-11.4 7 192 192 0 0 1-78 55q-3 1.1-6.3 2.8-53.3.3-106.7.2m181-246.5c6.2-10 15.7-14 25.8-10.8 2 .6 4.1 1.2 4.3 4-6.8 1.8-7.8 6.2-2.8 11.8L391 302c-2-3.3-4.5-4.2-6.3-5.5-3.3.4-3.4 5.1-7.1 4.3-1.5-2.3-1-4.5-.1-6.7 3.3-9.4 16.7-15.6 26-12.3q2.6.6 2.8 3.1-.1 3.1 2.7 3.6 3 .3 4.2-3.2a33 33 0 0 0-12.3-8c-15.7-5.2-30.2-1-43.9 6.8a54 54 0 0 0-26.4 31.5 86 86 0 0 0-4.3 16.1c10-1.8 11.3-3.2 9.7-10.2-1.6 0-2.9 1.8-4.7.6-1.3-2.2-.4-4.7.1-7.6m-111.2 95.2a52 52 0 0 0-6.8 9.2c-6 10.1-9.6 21.2-12 32.7-.4 1.7.1 4.1-2.8 4.8-3.4-3.2-1.1-7-.8-10.3 1.5-17.9 8-33.5 21.7-45.7 17.4-15.3 38.4-21 60.8-21.5 26-.6 50.9 5 74.7 15.5 2.4 1 3.9 1 5.6-.9 4-4.4 9-7.2 14.5-9.5q3.2-1.3 5.9-3.6a96 96 0 0 1 19.3-13.3q7-3.7 13.9-7c-.3-2.6-2.2-3.6-3-5.2-1.7-4.1-4-4.5-7.7-2.1a59 59 0 0 1-23.4 8c-18 2.7-33-2.6-40-21.6-1.2-3.5-3-4.2-6.3-3.6-4.7.9-9.2 3-14.2 1.3a203 203 0 0 1-41.7-20.1 141 141 0 0 1-55.6-62.6c-.8-1.7-2.6-3.7.2-6.4 23.1 39.4 57 65.7 98.4 84.1.4-4.6.2-8.5 1-12.2a68 68 0 0 1 51-53.5 38 38 0 0 1 37 8.6c.9.8 1.7 2 3.7 1.9a557 557 0 0 0-12.8-55.8 37 37 0 0 1-40.7 13.6 65 65 0 0 1-35.8-25.8c-6.1 29.7-33 43.4-59.6 30.7-20.4-9.8-27.7-34.2-15.2-52.2 8.5-12.3 21.2-17.1 35.5-18.5 9.5-.9 18 2.2 25.9 7.4l.7-1.7c4-10 3.7-21 8-30.8 7-15.6 17.4-26.7 35.5-28.5 1.4 0 3 .2 4.5-1.9-5.2-11-10.2-22.4-16.3-33.3q-.9.3-1.2.5c-11 13.6-32.9 14.3-45.2 4.2a6 6 0 0 0-4.7-1 314 314 0 0 0-84.4 26.7c-2.3 1.1-3.4 2.5-3.5 5.3a29 29 0 0 1-30 28.7h-9.4l-1.1 8.5c-1.4 10.7-3.3 21.1.1 32 3 9.6 4.6 19.7 6.4 29.7 4 23 7.7 46.1 9.4 69.5 1.3 17.8 3 35.5 3.5 53.2a925 925 0 0 1-5.8 130.6l-2.7 24.4c40.2-.2 68.6 15.7 79 57.2 30-10.6 56.3-26.9 80-49.2-16.2 0-31.6 1.6-46.7-1.2-14.8-2.7-29.8-5-44.2-12 3.2-2.8 5.7-1.4 8-1 26.3 4.4 52.7 6.5 79.4 3.7 30.8-3.2 59-13.4 83.6-32.4 6.2-4.8 6.3-5 1-11a142 142 0 0 0-56-40.8c-5.4-2.2-10.6-5.3-16.8-6v1.9l.2 1.4c1 10.5-1.4 19.9-10.5 26A57 57 0 0 1 277 434c-13.7-5.2-25-20.7-19.3-38 .4-1.1 1.1-2.4.3-4.2a69 69 0 0 0-37.7 17.8m181 15.6c4.3 4.6 9.1 8.9 12.9 14 6 8 13.8 13.4 22.5 17.7 12 6 24.7 8.1 37.8 4.5a55 55 0 0 0 35.9-31.8c8-16.9 4.4-32.4-8.2-45.9a64 64 0 0 0-25.5-16.2 92 92 0 0 0-62.1.9 67 67 0 0 0-19 9.6c16.3-2.3 31.5.9 46 8.3 14 7.3 28.5 23 28.3 36.5a74 74 0 0 0-47.5-35 72 72 0 0 0-58.4 10.3 199 199 0 0 1 37.3 27.1M353 80.7c10 13.8 18.7 28.3 25 44.2 1 2.4 2.1 5 4.5 6.5 6 4 12 8.6 18.4 12 42 22.3 87.2 29.3 134.1 28.5.6 0 1.4 0 2-1.6a280 280 0 0 0-83.8-66 271 271 0 0 0-103.9-28.5zm-20.7-4.9c7.8-7.7 9.8-17.4 9.4-28a43 43 0 0 0-32.2-38.3c-5.6-1-12.2-2.4-16.1 3.4-3.7 5.3.1 10.2 3 14.6q7 10.8 6.7 23.6a88 88 0 0 1-2.4 15.3c-1.5 6.5-.1 9.6 5.4 12.4 9 4.8 17.6 3.5 26.2-3M167 61.5c-6.2-.9-10.3 2.6-13.3 7.2a49 49 0 0 0-5 47.4 26 26 0 0 0 27.8 16.6c8-1.3 13.1-6.6 16.1-14 2.9-7-1.3-11.2-6.2-15.2a35 35 0 0 1-13.8-29c0-4.5.1-9.8-5.6-13m211.1 102q-1.6-2-4-.6c-5.3 2.7-10.9 5-16.1 7.9-4.8 2.7-9.8 5.4-13.1 10.5 5 1.7 10 3.1 9.5 9.6-.4 4.7-2.5 8.4-7 9.9-6.3 2-9.8-2.3-12.7-7-4 5.7-3.9 7 1 9.7 17.5 9.7 38.5 1.9 45.6-16.9 3-8 2.6-15.6-3.2-23.1m40.7 159.8c1.7-5 .1-9.6-2-14-3.4-7-9.3-12-14.7-17.5-3.6-3.6-7.1-3.2-11.7-.5 4.5 4 9 7 12.7 11 9 9.7 9 22.4-.6 31q-7.8 7.2-18.4 9.6c-15.4 3.6-30-5-33-19.7-.7-3.9-.5-8-.8-12.1-8.3 3-9 4-7.2 11.6.6 3 1.8 5.7 2.3 8.6a23 23 0 0 0 23.3 20.4c16 .2 29.7-6.4 42.2-15.7 4-2.9 6.4-7.1 8-12.7M300.5 198.6c4.8.4 9 3 14.4 3.1-.5-12.6-8.7-19-18.1-24-10.8-5.8-25.2-2-33.7 5-6.1 5-12 11-10.7 20.5 25.3-7.1 33.9-8 48.1-4.6m1.4 5.9c-8-.2-16-1.2-24 1.4 3.4 6.4 3.3 10.6 0 14.6-3.1 3.7-7.3 3.8-11 2.2q-7.6-3.2-5.8-12.2c-2 2-4.8 1.3-6.4 3.2-.3 2.2 1.1 3.8 2.2 5.4a32.3 32.3 0 0 0 55.4-4.5c3-5.8 2.6-6.6-3.4-8.3q-3-.8-7-1.8m31.7-21.2a104 104 0 0 1 33.7-29c-10.7-8.7-33.5-3.2-41 7.3-9.1 12.6-9.3 25.8.2 33.3 3.2-3 4-7.6 7-11.6m46.1 150.9c4.2-.9 8.5-1.4 12-5L385 320c-.8-1-1.7-1.6-3-.9l-19.6 10.6c5.1 4.6 10.5 5.5 17.3 4.5m16-24.6c-2.2 2-5.3 2.9-6.8 5.9 2.3 3.6 5.6 6.3 8.5 9.4 4.1-2.8 5.3-4.6 4.2-8.7-.7-2.9-1-6.7-6-6.6"/></svg>';

/**
 * Props accepted by the <QrCode> component.
 */
interface QrCodeProps {
    /**
     * Content to render on the QR code.
     */
    content: string;
}

/**
 * The <QrCode> component generates a QR code. It will feature consistent styling and colouring
 * based on the theme and will fill the width of its container, ensuring a 1:1 aspect ratio.
 */
export function QrCode(props: QrCodeProps) {
    const theme = useTheme();

    const qrCodeSvgPromise = useMemo(() => {
        const colouredLogo = kQrLogo.replaceAll('{color}', theme.palette.primary.main);
        const colouredEncodedLogo = btoa(colouredLogo);

        const qrCode = new QrCodeWithLogo({
            dotsOptions: {
                type: 'dot',
            },
            content: props.content || 'undefined',
            cornersOptions: {
                type: 'rounded-circle',
            },
            logo: {
                src: `data:image/svg+xml;base64,${colouredEncodedLogo}`,
                bgColor: 'transparent',
                width: 560,
                height: 560,
            },
            renderer: 'svg',
        });

        return qrCode.getSvgString();

    }, [ props.content, theme ]);

    return (
        <QrCodeContainer>
            <Suspense fallback={ <Skeleton variant="rectangular" width="100%" height="100%" /> }>
                <QrCodeDisplayElement qrCodeSvgPromise={qrCodeSvgPromise} />
            </Suspense>
        </QrCodeContainer>
    );
}

/**
 * Element that suspends rendering until the SVG code has been generated, which is an asynchronous
 * process for an unknown reason, and then draws it directly on the screen.
 */
function QrCodeDisplayElement(props: { qrCodeSvgPromise: Promise<string> }) {
    const qrCodeSvg = use(props.qrCodeSvgPromise);

    // biome-ignore lint/security/noDangerouslySetInnerHtml: required for QR library integration
    return <div dangerouslySetInnerHTML={{ __html: qrCodeSvg }} />;
}

/**
 * The <QrCodeContainer> ensures that the QR code displays responsively in the container we've made
 * for it. It mocks a bit with the system's internals, but this seems to be stable enough.
 */
const QrCodeContainer = styled('div')(({ theme }) => ({
    aspectRatio: 1,
    maxWidth: '100%',

    '& > div': { margin: '-10px' },
    '& > div > svg': {
        width: '100%',
        height: '100%',
    },
    '& > div > svg > circle': { fill: theme.vars?.palette.primary.main },
    '& > div > svg > circle[stroke="#000"]': { stroke: theme.vars?.palette.primary.main },
    '& > div > svg > rect': { fill: 'transparent' },
    '& > div > svg > g > path[fill="none"]': { stroke: theme.vars?.palette.primary.main },
}));
