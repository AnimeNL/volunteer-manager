// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import SvgIcon, { type SvgIconProps } from '@mui/material/SvgIcon';

/**
 * Coloured version of the Google logo, created by Gemini.
 */
export function GoogleIcon(props: SvgIconProps) {
    return (
        <SvgIcon viewBox="0 0 24 24" {...props}>
            <path fill="#4285F4"
                  d="M22.766 12.2475c0-.6417-.055-1.2834-.1742-1.8975H12v4.1342h6.0502c-.2658 1.3933-1.045 2.585-2.2 3.3733v2.7958h3.5567c2.0808-1.9158 3.2592-4.7391 3.2592-8.4058z" />
            <path fill="#34A853"
                  d="M12 23c2.97 0 5.4542-.99 7.2692-2.6675l-3.5567-2.7958c-.99.66-2.2458 1.0633-3.7125 1.0633-2.86 0-5.2892-1.9341-6.16-4.5466H2.1825v2.8691C3.9883 20.525 7.7008 23 12 23z" />
            <path fill="#FBBC05"
                  d="M5.84 14.0533c-.2292-.66-.3483-1.3658-.3483-2.0533s.1191-1.3933.3483-2.0533V7.0775H2.1825C1.4308 8.5533 1 10.2217 1 12s.4308 3.4467 1.1825 4.9225l3.6575-2.8692z" />
            <path fill="#EA4335"
                  d="M12 5.3542c1.6225 0 3.0708.5591 4.2167 1.65l3.135-3.135C17.4542 2.0908 14.97 1 12 1 7.7008 1 3.9883 3.475 2.1825 7.0775l3.6575 2.8692C6.7108 7.335 9.14 5.3542 12 5.3542z" />
        </SvgIcon>
    );
}
