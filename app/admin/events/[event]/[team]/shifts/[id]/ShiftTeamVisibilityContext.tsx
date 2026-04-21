// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { createContext, useCallback, useState } from 'react';

import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';

import { callApi } from '@lib/callApi';

/**
 * The `VisibilityContext` defines whether other teams' shifts should be visible.
 */
export const VisibilityContext = createContext<boolean>(false);

/**
 * Props accepted by the <ShiftTeamVisibilityContext> component.
 */
interface ShiftTeamVisibilityContextProps {
    /**
     * Whether displayed context should be restricted to the current team.
     */
    includeAllTeams?: boolean;
}

/**
 * The <ShiftTeamVisibilityContext> component allows visibility of shifts from the other teams to be
 * toggled. The setting applies to all of this context's children, and will persist between browsing
 * sessions as a user setting.
 */
export function ShiftTeamVisibilityContext(
    props: React.PropsWithChildren<ShiftTeamVisibilityContextProps>)
{
    const [ loading, setLoading ] = useState<boolean>(false);
    const [ includeAllTeams, setIncludeAllTeams ] = useState<boolean>(!!props.includeAllTeams);

    const handleChange = useCallback(async (event: unknown, checked: boolean) => {
        setLoading(true);
        setIncludeAllTeams(checked);
        try {
            await callApi('post', '/api/auth/settings', {
                'user-admin-shifts-display-other-teams': checked,
            });
        } finally {
            setLoading(false);
        }
    }, [ /* no dependencies */ ]);

    return (
        <>
            <Paper sx={{ px: 2, py: 1 }}>
                <Stack direction="row" sx={{
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <FormControlLabel control={<Checkbox defaultChecked={props.includeAllTeams} />}
                                      label="Display shifts planned by the other teams"
                                      onChange={handleChange} />
                    { loading && <CircularProgress size={24} /> }
                </Stack>
            </Paper>
            <VisibilityContext.Provider value={includeAllTeams}>
                {props.children}
            </VisibilityContext.Provider>
        </>
    );
}
