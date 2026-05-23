// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import DoNotDisturbOnTotalSilenceIcon from '@mui/icons-material/DoNotDisturbOnTotalSilence';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { darken, lighten } from '@mui/system/colorManipulator';
import { styled } from '@mui/material/styles';

import type { Language } from '@lib/ai/Language';
import { BritishFlag } from './BritishFlag';
import { DutchFlag } from './DutchFlag';

/**
 * Language in which the message should be written.
 */
export type CommunicationLanguage = Language | 'Silent';

/**
 * Props accepted by the <CommunicationLanguageViewProps> component.
 */
interface CommunicationLanguageViewProps {
    /**
     * Whether the signed in user has the ability to make silent mutations.
     */
    allowSilentMutations: boolean;

    /**
     * Whether the silent communication option should be disabled.
     */
    disableSilent?: boolean;

    /**
     * Whether the page is being rendered on a mobile device.
     */
    isMobile: boolean;

    /**
     * Language in which the communication should be written, when known.
     */
    language?: CommunicationLanguage;

    /**
     * Callback to be invoked when the user has selected a language. Expected to throw an exception
     * when something goes wrong when generating the message.
     */
    onLanguageSelected: (language: CommunicationLanguage) => Promise<void>;
}

/**
 * The <CommunicationLanguageView> component represents the first step in the communication flow,
 * where the user has to select which language the message should be written in. Certain users also
 * have the ability to not include a message at all, which is derived from context.
 */
export function CommunicationLanguageView(props: CommunicationLanguageViewProps) {
    const [ loadingError, setLoadingError ] = useState<string | undefined>();
    const [ loadingErrorOpen, setLoadingErrorOpen ] = useState<boolean>(false);
    const [ loadingLanguage, setLoadingLanguage ] = useState<CommunicationLanguage | undefined>();

    const selectLanguage = useCallback(async (language: CommunicationLanguage) => {
        setLoadingErrorOpen(false);
        setLoadingLanguage(language);
        try {
            await props.onLanguageSelected(language);
        } catch (error: any) {
            setLoadingErrorOpen(true);
            setLoadingError(error.message);
        } finally {
            setLoadingLanguage(undefined);
        }
    }, [ props.onLanguageSelected ]);

    const handleSelectDutch = useCallback(() => selectLanguage('Dutch'), [ selectLanguage ]);
    const handleSelectEnglish = useCallback(() => selectLanguage('English'), [ selectLanguage ]);
    const handleSelectSilent = useCallback(() => selectLanguage('Silent'), [ selectLanguage ]);

    return (
        <>

            <Stack direction={ props.isMobile ? 'column' : 'row' } spacing={2} sx={{
                alignItems: 'stretch',
                justifyContent: 'space-between',
            }}>
                <LanguageButton onClick={handleSelectDutch}>
                    { loadingLanguage === 'Dutch' && <CircularProgress color="primary" /> }
                    { loadingLanguage !== 'Dutch' &&
                        <>
                            <DutchFlag />
                            <Typography variant="body1">
                                Dutch
                            </Typography>
                            { props.language === 'Dutch' && <PreferredLanguage /> }
                        </> }
                </LanguageButton>
                <LanguageButton onClick={handleSelectEnglish}>
                    { loadingLanguage === 'English' && <CircularProgress color="primary" /> }
                    { loadingLanguage !== 'English' &&
                        <>
                            <BritishFlag />
                            <Typography variant="body1">
                                English
                            </Typography>
                            { props.language === 'English' && <PreferredLanguage /> }
                        </> }
                </LanguageButton>
                { (!!props.allowSilentMutations && !props.disableSilent) &&
                    <LanguageButton onClick={handleSelectSilent}>
                        { loadingLanguage === 'Silent' && <CircularProgress color="primary" /> }
                        { loadingLanguage !== 'Silent' &&
                            <>
                                <DoNotDisturbOnTotalSilenceIcon color="action" fontSize="large" />
                                <Typography variant="body1">
                                    Silent
                                </Typography>
                                { props.language === 'Silent' && <PreferredLanguage /> }
                            </> }
                    </LanguageButton> }
            </Stack>
            <Collapse in={!!loadingErrorOpen}>
                <Alert severity="error" sx={{ mt: 2 }}>
                    {loadingError}
                </Alert>
            </Collapse>
        </>
    );
}

/**
 * The <LanguageButton> component is a complex variation on a button through which the user can
 * select the language they would like to communicate in.
 */
const LanguageButton = styled(Stack)(({ theme }) => ({
    alignItems: 'center',
    backgroundColor:
        theme.palette.mode === 'light' ? lighten(theme.palette.action.active, 0.9)
                                       : darken(theme.palette.action.active, 0.9),
    borderRadius: theme.shape.borderRadius,
    cursor: 'pointer',
    flexBasis: '100%',
    gap: theme.spacing(0.5),
    justifyContent: 'center',
    padding: theme.spacing(2),
    transition: theme.transitions.create([ 'background-color' ]),
    userSelect: 'none',
    '&:hover': {
        backgroundColor: theme.palette.action.focus,
    }
}));

/**
 * The <PreferredLanguage> component displays a small banner at the bottom of a language option that
 * strongly suggests to the user to pick this option.
 */
function PreferredLanguage() {
    return (
        <Typography component="p" variant="caption" sx={ theme => ({
            backgroundColor: theme.palette.success.main,
            borderBottomLeftRadius: theme.shape.borderRadius,
            borderBottomRightRadius: theme.shape.borderRadius,
            color: theme.palette.success.contrastText,
            margin: -2,
            marginTop: 0.5,
            textAlign: 'center',
            width: [ '-webkit-fill-available', 'stretch' ],
        }) }>
            preferred
        </Typography>
    );
}
