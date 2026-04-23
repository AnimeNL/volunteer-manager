// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import EventNoteIcon from '@mui/icons-material/EventNote';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { EnvironmentContextEventAccess } from '@lib/EnvironmentContext';

/**
 * Props accepted by the <AdditionalEventCard> component.
 */
interface AdditionalEventCardProps {
    /**
     * The event for which this card should be displayed.
     */
    event: EnvironmentContextEventAccess;
}

/**
 * Card that links through to an additional event that's not featured on the main overview card,
 * usually events that happened at some point in the past but are being included for historical
 * reference. Inclusion is determined by the SSR app.
 */
export function AdditionalEventCard(props: AdditionalEventCardProps) {
    const { event } = props;

    const enableContent = event.publishContent === 'active' || event.publishContent === 'override';
    const enablePortal = event.publishPortal === 'active' || event.publishPortal === 'override';

    return (
        <Card elevation={2}>
            <CardContent sx={{ pb: 0 }}>
                <Typography variant="h5" component="p" noWrap>
                    {event.name}
                </Typography>
            </CardContent>
            <CardActions sx={{ pt: { md: 2 } }}>
                <Stack direction="column" sx={{ alignItems: 'flex-start', flexGrow: 1 }}>
                    { !!enableContent &&
                        <Button LinkComponent={Link} size="small" startIcon={ <HowToRegIcon /> }
                                href={`/registration/${event.slug}`}
                                sx={{ justifyContent: 'flex-start', pl: 1 }}>
                            Registration
                        </Button> }
                    { !!enablePortal &&
                        <Button LinkComponent={Link} size="small" startIcon={ <EventNoteIcon /> }
                                href={`/schedule/${event.slug}`}
                                sx={{ justifyContent: 'flex-start', pl: 1 }}>
                            Volunteer Portal
                        </Button> }
                </Stack>
            </CardActions>
        </Card>
    );
}
