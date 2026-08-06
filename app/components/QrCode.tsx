// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { Suspense, use, useMemo } from 'react';

import Skeleton from '@mui/material/Skeleton';
import QrCodeWithLogo from 'qrcode-with-logos';
import { styled } from '@mui/material/styles';

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
    const qrCodeSvgPromise = useMemo(() => {
        const qrCode = new QrCodeWithLogo({
            dotsOptions: {
                type: 'dot',
            },
            content: props.content || 'undefined',
            cornersOptions: {
                type: 'rounded-circle',
            },
            renderer: 'svg',
        });

        return qrCode.getSvgString();

    }, [ props.content ]);

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
