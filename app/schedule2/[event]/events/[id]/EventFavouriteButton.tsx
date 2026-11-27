// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StarIcon from '@mui/icons-material/Star';
import Tooltip from '@mui/material/Tooltip';

import { updateEventFavourite } from './EventActions';

/**
 * Props accepted by the <EventFavouriteButton> component.
 */
interface EventFavouriteButtonProps {
    activityId: number;
    eventSlug: string;
    initialFavourited: boolean;
}

/**
 * Header action button allowing a volunteer to star or unstar a program event with optimistic
 * feedback and a brief confirmation snackbar.
 */
export function EventFavouriteButton(props: EventFavouriteButtonProps) {
    const router = useRouter();

    const [ favourited, setFavourited ] = useState<boolean>(props.initialFavourited);
    const [ feedback, setFeedback ] = useState<string | undefined>();
    const [ pending, setPending ] = useState<boolean>(false);

    async function handleToggle() {
        if (pending)
            return;

        const nextFavourited = !favourited;
        setFavourited(nextFavourited);
        setPending(true);

        try {
            const response = await updateEventFavourite(
                props.eventSlug, props.activityId, nextFavourited);

            if (response.success) {
                setFeedback(nextFavourited ? 'Added to favourites' : 'Removed from favourites');
                router.refresh();
            } else {
                setFavourited(!nextFavourited);
                setFeedback(response.error ?? 'Unable to update favourite status.');
            }
        } catch {
            setFavourited(!nextFavourited);
            setFeedback('Unable to update favourite status.');
        } finally {
            setPending(false);
        }
    }

    const label = favourited ? 'Unstar this event' : 'Star this event';

    return (
        <>
            <Tooltip title={label}>
                <IconButton
                    aria-label={label}
                    aria-pressed={favourited}
                    color={favourited ? 'primary' : 'default'}
                    onClick={handleToggle}>
                    { favourited ? <StarIcon /> : <StarBorderIcon /> }
                </IconButton>
            </Tooltip>
            <Snackbar
                autoHideDuration={2500}
                message={feedback}
                onClose={() => setFeedback(undefined)}
                open={!!feedback} />
        </>
    );
}
