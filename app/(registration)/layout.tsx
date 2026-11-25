// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { Roboto } from 'next/font/google';

import { RegistrationTheme } from './RegistrationTheme';
import { determineEnvironment } from '@lib/Environment';

/**
 * The Roboto font, loaded through NextJS' font stack, with default settings for Material UI.
 */
const kFontRoboto = Roboto({
    weight: ['300', '400', '500', '700'],
    subsets: ['latin'],
    display: 'block',
    fallback: ['Helvetica', 'Arial', 'sans-serif'],
});

/**
 * Opt the legacy registration subtree out of Cache Components instant-navigation validation.
 */
export const instant = false;

/**
 * Layout for all routes sharing the Registration theme, including the landing page, volunteer
 * registration portal, volunteer guide, privacy policy, and statistics.
 */
export default async function RegistrationGroupLayout(props: LayoutProps<'/'>) {
    const environment = await determineEnvironment();

    return (
        <RegistrationTheme fontFamily={kFontRoboto.style.fontFamily}
                           paletteMode="auto"
                           themeColours={environment?.colours}>
            {props.children}
        </RegistrationTheme>
    );
}
