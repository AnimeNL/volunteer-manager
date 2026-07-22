// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon';

/**
 * Coloured version of the twilio.com logo, created by Gemini.
 */
export function TwilioIcon(props: SvgIconProps) {
    return (
        <SvgIcon viewBox="0 0 24 24" {...props}>
            <circle cx="12" cy="12" r="11" fill="#F22F46" />

            <circle cx="12" cy="12" r="8.5" fill="#FFFFFF" />

            <circle cx="9.5" cy="9.5" r="1.5" fill="#F22F46" />
            <circle cx="14.5" cy="9.5" r="1.5" fill="#F22F46" />
            <circle cx="9.5" cy="14.5" r="1.5" fill="#F22F46" />
            <circle cx="14.5" cy="14.5" r="1.5" fill="#F22F46" />
        </SvgIcon>
    );
}
