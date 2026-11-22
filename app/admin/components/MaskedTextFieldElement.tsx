// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { type TextFieldElementProps, TextFieldElement } from '@proxy/react-hook-form-mui';

import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

/**
 * Props accepted by the <MaskedTextFieldElement> component.
 */
interface MaskedTextFieldElementProps extends TextFieldElementProps {
    /**
     * Real plaintext secret value to reveal in a popover when the user clicks the reveal icon.
     * Must only be provided by the server for users with the `root` permission; when omitted or
     * empty, no reveal icon is rendered.
     */
    secretValue?: string;
}

/**
 * Form-integrated <TextFieldElement> for fields that hold masked secrets (rendered with a sentinel
 * value). When `secretValue` is provided (for `root`-privileged users), an icon button is shown on
 * the right-hand side of the input that reveals the stored value in a small popover.
 */
export function MaskedTextFieldElement(props: MaskedTextFieldElementProps) {
    const { secretValue, slotProps, type = 'password', ...textFieldProps } = props;

    const [ anchorEl, setAnchorEl ] = useState<HTMLElement | null>(null);
    const [ copied, setCopied ] = useState(false);

    const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (copyTimerRef.current)
            clearTimeout(copyTimerRef.current);
    }, []);

    const handleToggle = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(current => current ? null : event.currentTarget);
    }, []);

    const handleClose = useCallback(() => {
        setAnchorEl(null);
        setCopied(false);
    }, []);

    const handleCopy = useCallback(async () => {
        if (!secretValue)
            return;

        try {
            await navigator.clipboard.writeText(secretValue);
            setCopied(true);

            if (copyTimerRef.current)
                clearTimeout(copyTimerRef.current);

            copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
        } catch {
            // Clipboard API may be unavailable; ignore and let the user select the text manually.
        }
    }, [ secretValue ]);

    if (!secretValue)
        return <TextFieldElement {...textFieldProps} type={type} slotProps={slotProps} />;

    const open = Boolean(anchorEl);

    const endAdornment = (
        <InputAdornment position="end">
            <Tooltip title={open ? 'Hide value' : 'Reveal value'}>
                <IconButton
                    aria-label="Reveal secret value"
                    edge="end"
                    size="small"
                    onMouseDown={event => event.preventDefault()}
                    onClick={handleToggle}>
                    { open ? <VisibilityOffIcon color="disabled" fontSize="small" />
                           : <VisibilityIcon color="disabled" fontSize="small" /> }
                </IconButton>
            </Tooltip>
        </InputAdornment>
    );

    const existingInputSlotProps =
        typeof slotProps?.input === 'function' ? undefined : slotProps?.input;

    return (
        <>
            <TextFieldElement
                {...textFieldProps}
                type={type}
                slotProps={{
                    ...slotProps,
                    input: {
                        ...existingInputSlotProps,
                        endAdornment,
                    },
                }} />
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
                <Stack direction="row" spacing={1}
                       sx={{ p: 1.5, alignItems: 'flex-start', maxWidth: 480 }}>
                    <Typography
                        component="code"
                        variant="body2"
                        sx={{
                            fontFamily: 'monospace',
                            wordBreak: 'break-all',
                            whiteSpace: 'pre-wrap',
                            maxHeight: 240,
                            overflow: 'auto',
                            userSelect: 'all',
                            pt: 0.25,
                        }}>
                        {secretValue}
                    </Typography>
                    <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
                        <IconButton
                            aria-label="Copy secret value"
                            size="small"
                            onClick={handleCopy}
                            sx={{ flexShrink: 0 }}>
                            { copied ? <CheckIcon fontSize="small" color="success" />
                                     : <ContentCopyIcon fontSize="small" /> }
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Popover>
        </>
    );
}
