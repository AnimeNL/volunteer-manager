// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';

import { type FieldValues, FormContainer, TextFieldElement, TextareaAutosizeElement, useForm }
    from '@proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import DoNotDisturbOnTotalSilenceIcon from '@mui/icons-material/DoNotDisturbOnTotalSilence';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { GeneratePromptDefinition } from '@app/api/ai/generatePrompt';
import { BritishFlag } from './BritishFlag';
import { ContrastBox } from '@app/admin/components/ContrastBox';
import { DutchFlag } from './DutchFlag';
import { callApi } from '@lib/callApi';

/**
 * Props accepted by the <CommunicationDialog> component.
 */
interface CommunicationDialogProps {
    /**
     * Whether sending out a communication can be skipped altogether. Should be guarded behind a
     * permission, and should ideally be used rarely.
     */
    allowSilent?: boolean;

    /**
     * Parameters to pass to the Generative AI API endpoint.
     */
    apiParams: Omit<GeneratePromptDefinition['request'], 'language'>;

    /**
     * Label to display on the close button. Defaults to "Close".
     */
    closeLabel?: string;

    /**
     * Label to display on the confirm button. Defaults to "Confirm".
     */
    confirmLabel?: string;

    /**
     * Description of the dialog. Optional.
     */
    description?: React.ReactNode;

    /**
     * To be called when the dialog is supposed to close. The `reason` indicates why the dialog has
     * been closed, in case behaviour should depend on those options.
     */
    onClose: (reason?: 'backdropClick' | 'button' | 'confirmed' | 'escapeKeyDown')
        => Promise<void> | void;

    /**
     * To be called when the dialog flow is complete and a communication is ready to be sent out.
     * The callback will be responsible for activating both the action, and sending out the actual
     * communication. The subject and message may be omitted for users with the "silent" permission.
     */
    onSubmit: (subject?: string, message?: string)
        => Promise<{ success: React.ReactNode } | { error: React.ReactNode }>;

    /**
     * Whether the dialog should be open.
     */
    open?: boolean;

    /**
     * Title of the dialog that should be displayed.
     */
    title: React.ReactNode;
}

/**
 * The <CommunicationDialog> component enables the leads to go through a dialog "wizard" that will
 * result in sending out a communication to a volunteer. The communication message will be generated
 * but can then be modified by the volunteer prior to being sent out.
 *
 * The dialog has several screens:
 *   (1) Language selection   - which language should be communication be written in?
 *   (2) Message confirmation - preview the generated message and make the necessary edits
 *   (3) Action confirmation  - confirm that the action itself was comleted successfully
 *
 * Dialogs will be given a type and a payload, which will be used in the to-be-generated message.
 */
export function CommunicationDialog(props: CommunicationDialogProps) {
    const { description, onClose, onSubmit, open, title } = props;

    const closeLabel = props.closeLabel ?? 'Close';
    const confirmLabel = props.confirmLabel ?? 'Confirm';

    const form = useForm();

    const [ confirmSilent, setConfirmSilent ] = useState<boolean>(false);

    const [ loading, setLoading ] = useState<boolean>(false);
    const [ state, setState ] = useState<'language' | 'message' | 'confirmation'>('language');

    // ---------------------------------------------------------------------------------------------
    // State: `confirmation`
    // ---------------------------------------------------------------------------------------------

    const [ error, setError ] = useState<React.ReactNode | undefined>(undefined);
    const [ fatalError, setFatalError ] = useState<string | undefined>(undefined);
    const [ success, setSuccess ] = useState<React.ReactNode | undefined>(undefined);

    // ---------------------------------------------------------------------------------------------
    // State: `message`
    // ---------------------------------------------------------------------------------------------

    const [ language, setLanguage ] = useState<'Dutch' | 'English' | 'Silent'>('Silent');
    const [ messageLoading, setMessageLoading ] = useState<boolean>(false);
    const [ messageWarning, setMessageWarning ] = useState<boolean>(false);

    const handleGenerateMessage = useCallback(async (requestLanguage?: 'Dutch' | 'English') => {
        setFatalError(undefined);
        setMessageLoading(true);
        setMessageWarning(false);
        try {
            const response = await callApi('post', '/api/ai/generate/:type', {
                language: requestLanguage ?? 'English',
                ...props.apiParams,
            });

            if (!response.success) {
                setFatalError(response.error ?? 'Unable to generate the message...');
                return;
            }

            setMessageWarning(/\[([^\[]+)\]/g.test(response.result?.message ?? ''));
            setState('message');

            form.setValue('subject', response.result?.subject);
            form.setValue('message', response.result?.message);
            form.setFocus('subject');

        } catch (error: any) {
            setFatalError(error.message);
        } finally {
            setMessageLoading(false);
        }
    }, [ form, props.apiParams ]);

    const handleRefreshMessage = useCallback(() => {
        if (language && language !== 'Silent')
            handleGenerateMessage(language);

    }, [ handleGenerateMessage, language ]);

    // ---------------------------------------------------------------------------------------------
    // State: `language`
    // ---------------------------------------------------------------------------------------------

    const handleLanguageChoice = useCallback(async (language: 'Dutch' | 'English' | 'Silent') => {
        if (messageLoading)
            return;

        setConfirmSilent(language === 'Silent');
        setLanguage(language);

        switch (language) {
            case 'Dutch':
            case 'English':
                await handleGenerateMessage(language);
                break;

            case 'Silent':
                // No further action necessary.
                break;
        }
    }, [ handleGenerateMessage, messageLoading ]);

    // ---------------------------------------------------------------------------------------------
    // Common functionality
    // ---------------------------------------------------------------------------------------------

    const handleClose = useCallback(async (
        event: unknown, reason?: 'backdropClick' | 'confirmed' | 'escapeKeyDown') => {
        try {
            await onClose(reason ?? 'button');
        } finally {
            setTimeout(() => {
                form.reset(/* all fields */);
                setConfirmSilent(false);
                setFatalError(undefined);
                setState('language');
            }, 300);
        }
    }, [ form, onClose ]);

    const handleConfirm = useCallback(async (data: FieldValues) => {
        if (language === 'Silent' && !props.allowSilent)
            return;  // block silent confirmations when the volunteer is not allowed to do this

        const subject = language === 'Silent' ? undefined : data.subject;
        const message = language === 'Silent' ? undefined : data.message;

        if (language !== 'Silent' && (!subject || !message))
            return;  // block attempted silent confirmations

        setLoading(true);
        try {
            const result = await onSubmit(subject, message);

            setConfirmSilent(false);
            setState('confirmation');

            if ('error' in result)
                setError(result.error);
            else
                setSuccess(result.success);

        } finally {
            setLoading(false);
        }
    }, [ language, onSubmit, props.allowSilent ]);

    return (
        <Dialog open={!!open} onClose={handleClose} fullWidth>
            <FormContainer formContext={form} onSuccess={handleConfirm}>
                <DialogTitle>
                    {title}
                </DialogTitle>
                <DialogContent>
                    { description &&
                        <Typography sx={{ pb: 2 }}>
                            {description}
                        </Typography> }
                    <Collapse in={state === 'language'}>
                        <Typography>
                            In which language should the message be written?
                        </Typography>
                        <Stack direction="row" spacing={2} sx={{
                                alignItems: 'stretch',
                                justifyContent: 'space-between',
                                marginTop: 2
                            }}>
                            <LanguageButton onClick={handleLanguageChoice} variant="Dutch">
                                <DutchFlag />
                            </LanguageButton>
                            <LanguageButton onClick={handleLanguageChoice} variant="English">
                                <BritishFlag />
                            </LanguageButton>
                            { props.allowSilent &&
                                <LanguageButton onClick={handleLanguageChoice} variant="Silent">
                                    <DoNotDisturbOnTotalSilenceIcon
                                        color="action" fontSize="large" />
                                </LanguageButton> }
                        </Stack>
                        <Collapse in={!!confirmSilent}>
                            <Alert severity="warning" sx={{ mt: 2 }}>
                                You are about to make this change without sending a message.
                                <strong> You are responsible for letting them know</strong>. Click
                                the button below to proceed.
                            </Alert>
                        </Collapse>
                    </Collapse>
                    <Collapse in={state === 'message'}>
                        <Stack direction="row" spacing={1} sx={{
                            justifyContent: 'space-between',
                            marginBottom: 1
                        }}>
                            <TextFieldElement name="subject" fullWidth size="small"
                                              disabled={messageLoading} />
                            <IconButton onClick={handleRefreshMessage} disabled={messageLoading}>
                                <RefreshIcon color="primary" />
                            </IconButton>
                        </Stack>
                        <TextareaAutosizeElement name="message" fullWidth size="small"
                                                 disabled={messageLoading} />
                        <Collapse in={!!messageWarning}>
                            <Alert severity="warning" sx={{ mt: 2 }}>
                                <strong>Please carefully read the message</strong>, as an anomaly
                                was detected.
                            </Alert>
                        </Collapse>
                    </Collapse>
                    <Collapse in={state === 'confirmation'}>
                        { error && <Alert severity="error">{error}</Alert> }
                        { success && <Alert severity="success">{success}</Alert> }
                    </Collapse>
                </DialogContent>
                <DialogActions sx={{ pt: 0, mr: 2, mb: 1.5 }}>
                    { fatalError &&
                        <Typography sx={{ color: 'error.main', flexGrow: 1, pl: 2 }}>
                            {fatalError}
                        </Typography> }
                    <Button onClick={handleClose} variant="text">{closeLabel}</Button>
                    <Button loading={loading} type="submit" variant="contained"
                            disabled={ state !== 'message' && !confirmSilent }>
                        {confirmLabel}
                    </Button>
                </DialogActions>
            </FormContainer>
        </Dialog>
    );
}

/**
 * Available language options for outgoing communication.
 */
type LanguageOption = 'English' | 'Dutch' | 'Silent';

/**
 * Props accepted by the <LanguageButton> component.
 */
interface LanguageButtonProps {
    /**
     * Callback that should be invoked when the button gets clicked on by the user.
     */
    onClick: (variant: LanguageOption) => Promise<void>;

    /**
     * The language variant that should be displayed on this button.
     */
    variant: LanguageOption;
}

/**
 * The <LanguageButton> component displays a button-like object with a flag and a label. It has a
 * loading state, which will be displayed when the response is being generated by another system.
 */
function LanguageButton(props: React.PropsWithChildren<LanguageButtonProps>) {
    const { onClick, variant } = props;

    const [ loading, setLoading ] = useState<boolean>(false);

    const handleClick = useCallback(async () => {
        setLoading(true);
        try {
            await onClick(variant);
        } finally {
            setLoading(false);
        }
    }, [ onClick, variant ]);

    return (
        <Stack component={ContrastBox} direction="column" sx={{
                   alignItems: 'center',
                   cursor: 'pointer',
                   flexBasis: '100%',
                   justifyContent: 'center',
                   padding: 2,
                   userSelect: 'none',
                   '&:hover': {
                       backgroundColor: theme => theme.palette.action.focus,
                   }
               }} onClick={handleClick} spacing={1}>
            { loading && <CircularProgress color="primary" /> }
            { !loading &&
                <>
                    {props.children}
                    <Typography>
                        {variant}
                    </Typography>
                </> }
        </Stack>
    );
}
