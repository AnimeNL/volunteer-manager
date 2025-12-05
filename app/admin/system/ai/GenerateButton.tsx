// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useContext, useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import Snackbar from '@mui/material/Snackbar';

import { FormProviderContext } from '@components/FormProvider';

/**
 * The <GenerateButton> ccomponent is a form-associated submit button that enables the user to start
 * generating an AI-generated message, in a consistent, clean user interface.
 */
export function GenerateButton() {
    const formContext = useContext(FormProviderContext);

    const [ errorOpen, setErrorOpen ] = useState<boolean>(false);
    useEffect(() => {
        if (typeof formContext.result === 'undefined')
            return;

        setErrorOpen(!formContext.result.success);

    }, [ formContext.result ]);

    const closeError = useCallback(() => setErrorOpen(false), [ /* no dependencies */ ]);

    return (
        <>
            <Button startIcon={ <SmartToyIcon /> } loading={!!formContext.isPending} type="submit"
                    fullWidth variant="outlined">
                Generate message
            </Button>
            <Snackbar open={errorOpen} autoHideDuration={3000} onClose={closeError}>
                <Alert severity="error" variant="filled">
                    { formContext?.result?.error || 'The message could not be generated' }
                </Alert>
            </Snackbar>
        </>
    );
}
