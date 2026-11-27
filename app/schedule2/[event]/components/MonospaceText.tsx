// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Typography, { type TypographyProps } from '@mui/material/Typography';

/**
 * Inline or block monospace text used for reservation numbers, ticket barcodes, and order codes.
 */
export function MonospaceText(props: TypographyProps) {
    const { sx, ...otherProps } = props;
    return (
        <Typography
            variant="body2"
            {...otherProps}
            sx={{ fontFamily: 'monospace', letterSpacing: 1, ...sx }} />
    );
}
