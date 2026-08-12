// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

import { kThemeImageVersion } from '@app/config';

/**
 * Props accepted by the <AdviceCard> component.
 */
interface AdviceCardProps {
    /**
     * The advice that should be shown on the card.
     */
    advice: string;
}

/**
 * The <AdviceCard> card displays a piece of Del a Rie advice to the viewer. It's got a generated
 * header, followed by periodic advice.
 */
export function AdviceCard(props: AdviceCardProps) {
    return (
        <Paper>
            <Box sx={{
                backgroundImage:
                    `url(/images/theme/del-a-rie-advies-display.jpg?${kThemeImageVersion})`,
                backgroundPosition: 'center',
                backgroundSize: 'cover',
                borderTopLeftRadius: theme => theme.shape.borderRadius,
                borderTopRightRadius: theme => theme.shape.borderRadius,
                width: '100%',
                aspectRatio: 2 }} />
            <Typography variant="body1" sx={{ p: 2, textWrap: 'balance' }}>
                {props.advice}
                <Typography component="span" variant="body1" sx={{ color: 'text.disabled' }}>
                    {' '}— Del a Rie Advies
                </Typography>
            </Typography>
        </Paper>
    );
}
