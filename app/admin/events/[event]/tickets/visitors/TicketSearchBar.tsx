// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback } from 'react';

import { TextFieldElement } from '@components/proxy/react-hook-form-mui';

import IconButton from '@mui/material/IconButton';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SearchIcon from '@mui/icons-material/Search';
import Stack from '@mui/material/Stack';

import { FormProvider } from '@components/FormProvider';

/**
 * Component that provides search functionality for visitor tickets. Can ~instantly search through
 * the thousands of individual tickets created through our ticketing partners.
 */
export function TicketSearchBar(props: { eventSlug: string; query?: string }) {
    const handleSubmit = useCallback(async (data: { query: string }) => {
        if (!data.query)
            return { success: true };  // silently ignore

        const encodedQuery = encodeURIComponent(data.query.toString());
        return {
            success: true,
            redirect: `/admin/events/${props.eventSlug}/tickets/visitors/search?q=${encodedQuery}`,
        };

    }, [ props.eventSlug ]);

    return (
        <FormProvider action={handleSubmit} defaultValues={{ query: props.query }}>
            <Stack direction="row" spacing={1}>
                <TextFieldElement name="query" sx={{ flex: 1 }}
                                  slotProps={{
                                      input: {
                                          size: 'small',
                                          startAdornment: <SearchIcon sx={{ mr: 1 }} />,
                                          placeholder: 'Search all visitor tickets…',
                                      }
                                  }} />
                <IconButton type="submit">
                    <NavigateNextIcon />
                </IconButton>
            </Stack>
        </FormProvider>
    );
}