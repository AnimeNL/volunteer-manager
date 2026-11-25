// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { RegistrationTheme } from '@app/(registration)/RegistrationTheme';
import { determineEnvironment } from '@lib/Environment';

/**
 * Opt the exports subtree out of Cache Components instant-navigation validation.
 */
export const instant = false;

/**
 * Layout for the data exports sub-application, providing the standard MUI theme and CSS baseline.
 */
export default async function ExportsLayout(props: LayoutProps<'/exports/[slug]'>) {
    const environment = await determineEnvironment();

    return (
        <RegistrationTheme paletteMode="auto" themeColours={environment?.colours}>
            {props.children}
        </RegistrationTheme>
    );
}
