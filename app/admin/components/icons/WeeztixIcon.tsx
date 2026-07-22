// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon';

/**
 * Coloured version of the Google logo, created by Gemini.
 */
export function WeeztixIcon(props: SvgIconProps) {
    const { sx, color, ...otherProps } = props;
    return (
        <SvgIcon viewBox="0 0 24 24" color={color}
                 sx={{ color: color ? undefined : '#006AFF' }} {...otherProps}>
            <path fillRule="evenodd"
                  clipRule="evenodd"
                  d="M13.354 5.283v16.568H7.783V5.283h5.571zm-8.902 6.002 2.88 10.669-5.378 1.436L0 12.697l5.378-1.424v.001zm15.06-10.672 5.379 1.435-5.761 21.343-5.38-1.435L19.512.613z" />
        </SvgIcon>
    );
}
