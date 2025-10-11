// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { PropsWithChildren } from 'react';
import Link from '@app/LinkProxy';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';

import { kThemeImageVersion } from '@app/config';

/**
 * Props accepted by the <NardoAdviceClickthroughContainer> component.
 */
interface NardoAdviceClickthroughContainerProps {
    /**
     * Whether the advice can be activated to enable a more personal approach.
     */
    clickthrough?: boolean;

    /**
     * Slug of the event that should be linked through to.
     */
    slug: string;
}

/**
 * The <NardoAdviceClickthroughContainer> component either returns a transparent fragment, or a
 * <CardActionArea> component with the appropriate link options set, based on the given `props`.
 */
function NardoAdviceClickthroughContainer(
    props: PropsWithChildren<NardoAdviceClickthroughContainerProps>)
{
    if (props.clickthrough) {
        return (
            <CardActionArea LinkComponent={Link} href={`/schedule/${props.slug}/advice`}>
                {props.children}
            </CardActionArea>
        );
    }

    return <>{props.children}</>;
}

/**
 * Props accepted by the <NardoAdviceCard> component.
 */
interface NardoAdviceCardProps extends NardoAdviceClickthroughContainerProps {
    /**
     * The piece of advice that should be displayed.
     */
    advice: string;
}

/**
 * The <NardoAdviceCard> displays a card with the latest piece of Del a Rie advice issued by the
 * server. It includes a colourful graphic to remind us of what's important in live.
 */
export function NardoAdviceCard(props: NardoAdviceCardProps) {
    const { advice, ...containerProps } = props;

    return (
        <Card>
            <NardoAdviceClickthroughContainer {...containerProps}>
                <Box sx={{
                    backgroundImage:
                        `url(/images/theme/del-a-rie-advies.jpg?${kThemeImageVersion})`,
                    backgroundPosition: 'center 70%',
                    backgroundSize: 'cover',
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    aspectRatio: 4 }}>
                    <Typography variant="button" sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        borderRadius: 1,
                        color: 'black',
                        alignSelf: 'flex-end',
                        m: 1,
                        px: 1,
                    }}>
                        Ad
                    </Typography>
                </Box>
                <CardContent sx={{ pb: '16px !important' }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {advice}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.disabled', pt: 0.5 }}>
                        {' '}— Del a Rie Advies
                    </Typography>
                </CardContent>
            </NardoAdviceClickthroughContainer>
        </Card>
    );
}
