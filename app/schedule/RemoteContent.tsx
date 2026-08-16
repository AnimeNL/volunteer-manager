// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import React from 'react';
import { useEffect, useState } from 'react';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { alpha, darken, lighten } from '@mui/system/colorManipulator';

import type { HotelsDefinition } from '@app/api/event/hotels/[event]/route';
import type { TrainingsDefinition } from '@app/api/event/trainings/[event]/route';
import { BaseMarkdown as Markdown } from './BaseMarkdown';
import { callApi } from '@lib/callApi';

/**
 * Mechanism for formatting hotel room prices in euros. Prefer Intl.NumberFormat, but fall back to
 * good 'ol `Number.prototype.toFixed` for older browsers.
 */
const kPriceFormatter =
    (typeof window !== 'undefined' && typeof window.Intl !== 'undefined')
        ? new Intl.NumberFormat('en-NL', { style: 'currency', currency: 'EUR' })
        : { format: (value: number) => `€${value.toFixed(2)}` };

/**
 * Manual styles that apply to the <RemoteContent> client components.
 */
const kStyles: { [key: string]: SxProps<Theme> } = {
    hotelTable: {
        width: 'fit-content',
        marginY: 2,

        borderRadius: 1,
        border: '1px solid transparent',
        borderColor: theme =>
            theme.palette.mode === 'light' ? lighten(alpha(theme.palette.divider, 1), 0.88)
                                           : darken(alpha(theme.palette.divider, 1), 0.68),

        '& > .MuiTable-root': {
            width: 'auto',
        },

        '& .MuiTableBody-root > .MuiTableRow-root:last-of-type > .MuiTableCell-root': {
            borderBottomWidth: 0,
        }
    },
};

/**
 * Props accepted by the <RemoteContent> component.
 */
interface RemoteContentProps {
    /**
     * Event for which the remote content is being rendered.
     */
    event: string;

    /**
     * Type of remote content that should be included.
     */
    type: 'hotels' | 'trainings';
}

/**
 * Displays information about the hotel rooms that are available for a particular event. The content
 * will be displayed as if it were common page content.
 */
function RemoteContentHotels(props: Omit<RemoteContentProps, 'type'>) {
    const [ hotels, setHotels ] = useState<HotelsDefinition['response']>();
    useEffect(() => {
        if (!props.event)
            return;

        callApi('get', '/api/event/hotels/:event', {
            event: props.event
        }).then(response => setHotels(response));

    }, [ props.event ]);

    if (!hotels) {
        return (
            <>
                <Skeleton animation="wave" height={16} width="40%" />
                <Skeleton animation="wave" height={16} width="60%" />
                <Skeleton animation="wave" height={16} width="50%" />
                <Skeleton animation="wave" height={16} width="60%" />
            </>
        );
    }

    if (!hotels.hotels.length) {
        const message = '> Hotel room availability for this event has not been published yet.';
        return <Markdown>{message}</Markdown>;
    }

    return (
        <>
            { hotels.hotels.map((hotel, index) =>
                <React.Fragment key={index}>
                    <Typography variant="h6">
                        {hotel.name}
                    </Typography>
                    <Markdown>
                        {hotel.description}
                    </Markdown>
                    <TableContainer sx={kStyles.hotelTable}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Room type</TableCell>
                                    <TableCell>Price</TableCell>
                                    <TableCell>Price per person</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                { hotel.rooms.map(room =>
                                    <TableRow key={room.id}>
                                        <TableCell>{room.name}</TableCell>
                                        <TableCell>
                                            {kPriceFormatter.format(room.price / 100)}/night
                                        </TableCell>
                                        <TableCell>
                                            {kPriceFormatter.format(room.price / room.people / 100)}
                                            /person/night
                                        </TableCell>
                                    </TableRow> ) }
                            </TableBody>
                        </Table>
                    </TableContainer>
                </React.Fragment> ) }
        </>
    );
}


/**
 * Displays information about the training dates available for an event. The data will be fetched
 * asynchronously over the network, then displayed neatly on the page.
 */
function RemoteContentTrainings(props: Omit<RemoteContentProps, 'type'>) {
    const [ trainings, setTrainings ] = useState<TrainingsDefinition['response']>();
    useEffect(() => {
        if (!props.event)
            return;

        callApi('get', '/api/event/trainings/:event', {
            event: props.event
        }).then(response => setTrainings(response));

    }, [ props.event ]);

    if (!trainings) {
        return (
            <>
                <Skeleton animation="wave" height={16} width="40%" />
                <Skeleton animation="wave" height={16} width="50%" />
                <Skeleton animation="wave" height={16} width="60%" sx={{ mb: 2 }} />
            </>
        );
    }

    if (!trainings.trainings.length) {
        const message = '> Training availability for this event has not been published yet.';
        return <Markdown>{message}</Markdown>;
    }

    return (
        <React.Fragment>
            <Typography variant="body1">
                We've scheduled training sessions on the following days:
            </Typography>
            <Box sx={{ borderLeft: theme => `4px solid ${theme.palette.success.main}`, px: 2 }}>
                <Typography variant="body1">
                    { trainings.trainings.map((training, index) =>
                        <React.Fragment key={index}>
                            {training}<br />
                        </React.Fragment> )}
                </Typography>
            </Box>
        </React.Fragment>
    );
}

/**
 * Provides remote content that can be included in Markdown content. Useful tool for de-duplicating
 * informationw here it has to be available in multiple places, such as hotel information.
 */
export function RemoteContent(props: RemoteContentProps) {
    switch (props.type) {
        case 'hotels':
            return RemoteContentHotels(props);
        case 'trainings':
            return RemoteContentTrainings(props);
    }
}
