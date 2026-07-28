// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import type { Metadata } from 'next';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { computePalette } from '@app/admin/layout/ThemeUtilities';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';

import { kThemeImageVersion } from '@app/config';

/**
 * The <ThemeDebugPage> component displays a page that outputs all images related to the portal's
 * theme, in the size at which they'll be displayed in reality.
 */
export default async function ThemeDebugPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'system.internals',
    });

    type ThemeImage = {
        src: string;
        area: string;
        label: string;
        aspectRatio: number;
        width: number;
    };

    const kImages: ThemeImage[] = [
        // Admin:
        {
            src: '/images/theme/ai-promo.jpg',
            area: 'admin',
            label: 'AI promotion dialog',
            width: 600,
            aspectRatio: 3.25,
        },

        // Display:
        {
            src: '/images/theme/del-a-rie-advies-display.jpg',
            area: 'display',
            label: 'Del a Rie Advies',
            width: 400,
            aspectRatio: 2,
        },
        {
            src: '/images/theme/request-help.jpg',
            area: 'display',
            label: 'Request Help',
            width: 400,
            aspectRatio: 3.5,
        },

        // Schedule:
        {
            src: '/images/theme/del-a-rie-advies.jpg',
            area: 'schedule',
            label: 'Del a Rie Advies',
            width: 900,
            aspectRatio: 4,
        },
        {
            src: '/images/theme/del-a-rie-advies-personalised.jpg',
            area: 'schedule',
            label: 'Del a Rie Advies Personalised',
            width: 900,
            aspectRatio: 3.5,
        },
        {
            src: '/images/theme/help-request.jpg',
            area: 'schedule',
            label: 'Help request',
            width: 900,
            aspectRatio: 3.5,
        },
        {
            src: '/images/theme/help-requests.jpg',
            area: 'schedule',
            label: 'Help requests',
            width: 900,
            aspectRatio: 3.5,
        },
        {
            src: '/images/theme/job-completed.jpg',
            area: 'schedule',
            label: 'Job Completed',
            width: 900,
            aspectRatio: 3.5,
        },
        {
            src: '/images/theme/knowledge-base.jpg',
            area: 'schedule',
            label: 'Knowledge Base',
            width: 900,
            aspectRatio: 3.5,
        },
        {
            src: '/images/theme/knowledge-base-category.jpg',
            area: 'schedule',
            label: 'Knowledge Base Category',
            width: 900,
            aspectRatio: 3.5,
        },
    ];

    const colors = [ '#2196f3', '#e91e63', '#795548', '#ffeb3b', '#8bc34a', '#673ab7' ]
    const colorIndices =
        [ '50', '100', '200', '300', '400', '500', '600', '700', '800', '900' ] as const;

    return (
        <>
            <Section title="Volunteer Manager Theme" subtitle={`version: ${kThemeImageVersion}`}>
                <SectionIntroduction>
                    This page shows the festival-specific theme images used throughout the AnimeCon
                    Volunteer Manager. They're updated for each event to keep everything looking
                    fresh!
                </SectionIntroduction>
            </Section>
            <Section title="Colours">
                { colors.map(baseColor => {
                    const palette = computePalette(baseColor);
                    return (
                        <Stack key={baseColor} direction="row" spacing={2} sx={{
                            justifyContent: 'space-between',
                        }}>
                            { colorIndices.map(index =>
                                <Box key={index}
                                     sx={{
                                         backgroundColor: palette[index],
                                         flexGrow: 1,
                                         height: '40px',
                                         minWidth: '10px',
                                     }} /> )}
                        </Stack>
                    );
                }) }
            </Section>
            { kImages.map(image =>
                <Section key={image.src} title={image.label} subtitle={image.area}>
                    <Box sx={{
                        background: 'url(/images/schedule/background-light.png)',
                        padding: 2,
                    }}>
                        <Box sx={{
                            margin: 'auto',
                            backgroundImage: `url(${image.src}?${kThemeImageVersion})`,
                            backgroundPosition: 'center center',
                            backgroundRepeat: 'no-repeat',
                            width: `${image.width}px`,
                            aspectRatio: image.aspectRatio,
                        }} />
                    </Box>
                    <Box sx={{
                        background: 'url(/images/schedule/background-dark.png)',
                        marginTop: '0px !important',
                        padding: 2,
                    }}>
                        <Box sx={{
                            margin: 'auto',
                            backgroundImage: `url(${image.src}?${kThemeImageVersion})`,
                            backgroundPosition: 'center center',
                            backgroundRepeat: 'no-repeat',
                            width: `${image.width}px`,
                            aspectRatio: image.aspectRatio,
                        }} />
                    </Box>
                </Section>
            )}
        </>
    );
}

export const metadata: Metadata = {
    title: 'Theme | AnimeCon Volunteer Manager',
};
