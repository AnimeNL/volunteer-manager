// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { type TextFieldElementProps, TextFieldElement } from '@proxy/react-hook-form-mui';
import { useState } from 'react';

import Box from '@mui/material/Box';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Collapse from '@mui/material/Collapse';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

/**
 * Validation state that the <PasswordField> component maintains. Each of these will be filled in by
 * a separate, focused validation function.
 */
interface PasswordValidationState {
    /**
     * Whether the password contains both uppercase and lowercase characters.
     */
    passedCasingRequirement: boolean;

    /**
     * Whether the minimum length requirement has been passed.
     */
    passedLengthRequirement: boolean;

    /**
     * Whether the password contains at least one number.
     */
    passedNumberRequirement: boolean;
}

/**
 * Password rules as they will be indicated to the password field, so that password managers can
 * automatically create a password that meets our requirements.
 */
const kPasswordRules =
    'required: upper; required: lower; required: digit; ' +
    'minlength: 8; allowed: [-().&@?\'#,/&quot;+]; max-consecutive: 2';

/**
 * Validates that the given `password` contains at least one uppercase and one lowercase character.
 */
function validatePasswordCasingRequirement(password: string): boolean {
    return /[a-z]/.test(password) &&
           /[A-Z]/.test(password);
}

/**
 * Validates that the given `password` is at least eight characters in length.
 */
function validatePasswordLengthRequirement(password: string): boolean {
    return password.length >= /* minimum length: */ 8;
}

/**
 * Validates that the given `password` contains at least one number.
 */
function validatePasswordNumberRequirement(password: string): boolean {
    return /[0-9]/.test(password);
}

/**
 * Validates that the given `password` meets all requirements. When set, the `throwOnFailure` flag
 * will trigger an exception to be thrown instead.
 */
export function validatePassword(password: string): boolean;
export function validatePassword(password: string, throwOnFailure: boolean): boolean | never;
export function validatePassword(password: string, throwOnFailure?: boolean): boolean | never {
    const validates = validatePasswordCasingRequirement(password) &&
                      validatePasswordLengthRequirement(password) &&
                      validatePasswordNumberRequirement(password);

    if (!validates && throwOnFailure) {
        throw new Error('Your password must be at least 8 characters long, contain at least one ' +
                        'number, one lowercase character and one uppercase character.');
    }

    return validates;
}

/**
 * The <PasswordField> component asks the user to enter their (new) password. It validates the
 * password automatically while the user it typing, while continuing to make the result available to
 * the react-hook-for-mui parent.
 */
export function PasswordField(props: TextFieldElementProps) {
    const [ password, setPassword ] = useState<string>(/* empty= */ '');
    const [ state, setState ] = useState<PasswordValidationState>({
        passedCasingRequirement: false,
        passedLengthRequirement: false,
        passedNumberRequirement: false,
    });

    function onChange(event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) {
        const password = event.target.value;
        const updatedState: PasswordValidationState = {
            passedCasingRequirement: validatePasswordCasingRequirement(password),
            passedLengthRequirement: validatePasswordLengthRequirement(password),
            passedNumberRequirement: validatePasswordNumberRequirement(password),
        };

        setPassword(password);
        setState(updatedState);
    }

    return (
        <Box>
            <TextFieldElement onChange={onChange}
                              slotProps={{
                                  htmlInput: {
                                      minLength: 8,
                                      passwordrules: kPasswordRules,
                                  },
                              }}
                              {...props} />
            <Collapse in={!!password.length}>
                <List dense disablePadding sx={{ pt: 1 }}>
                    <ListItem disablePadding>
                        <ListItemIcon sx={{ minWidth: '32px' }}>
                            { state.passedLengthRequirement &&
                                <CheckCircleIcon color="success" fontSize="small" /> }
                            { !state.passedLengthRequirement &&
                                <CancelIcon color="error" fontSize="small" /> }
                        </ListItemIcon>
                        <ListItemText>
                            At least eight characters in length
                        </ListItemText>
                    </ListItem>
                    <ListItem disablePadding>
                        <ListItemIcon  sx={{ minWidth: '32px' }}>
                            { state.passedNumberRequirement &&
                                <CheckCircleIcon color="success" fontSize="small" /> }
                            { !state.passedNumberRequirement &&
                                <CancelIcon color="error" fontSize="small" /> }
                        </ListItemIcon>
                        <ListItemText slotProps={{ primary: { variant: 'body2' } }}>
                            Contains at least one number
                        </ListItemText>
                    </ListItem>
                    <ListItem disablePadding>
                        <ListItemIcon  sx={{ minWidth: '32px' }}>
                            { state.passedCasingRequirement &&
                                <CheckCircleIcon color="success" fontSize="small" /> }
                            { !state.passedCasingRequirement &&
                                <CancelIcon color="error" fontSize="small" /> }
                        </ListItemIcon>
                        <ListItemText slotProps={{ primary: { variant: 'body2' } }}>
                            Contains both lowercase and uppercase characters
                        </ListItemText>
                    </ListItem>
                </List>
            </Collapse>
        </Box>
    );
}
