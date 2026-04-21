// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import type { SxProps } from '@mui/system';
import type { Theme } from '@mui/material/styles';
import Avatar from '@mui/material/Avatar';
import FaceIcon from '@mui/icons-material/Face';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { darken } from '@mui/material/styles';

import type { User } from '@lib/auth/User';
import { AuthenticationHeaderChip } from './AuthenticationHeaderChip';
import { determineInitials } from '@components/Avatar';

/**
 * Manual styles that apply to the <RegistrationHeader> client component.
 */
export const kStyles: { [key: string]: SxProps<Theme> } = {
    avatar: {
        backgroundColor: 'primary.light',
        color: theme => theme.palette.getContrastText(theme.palette.primary.light),
    },
    header: theme => {
        const backgroundColor =
            theme.palette.mode === 'light' ? darken(theme.palette.theme.light, 0.2)
                                           : darken(theme.palette.theme.light, 0.3);

        return {
            backgroundColor,
            color: theme.palette.getContrastText(backgroundColor),
            display: 'flex',

            justifyContent: 'space-between',

            borderTopLeftRadius: `${theme.shape.borderRadius}px`,
            borderTopRightRadius: `${theme.shape.borderRadius}px`,

            margin: theme.spacing(0),
            padding: theme.spacing(1, 2),
        };
    },
    text: {
        flex: 1,
        paddingRight: 2,
    },
};

/**
 * Props accepted by the <RegistrationHeader> client component.
 */
interface RegistrationHeaderProps {
    /**
     * To be called when the user chip has been clicked on, indicating that the authentication flow
     * should be opened. This works the same for guests and signed in users.
     */
    onUserChipClick: () => void;

    /**
     * Title of the page that should be displayed on the header.
     */
    title: string;

    /**
     * Information about the signed in user, as they should be shown in the header.
     */
    user?: User;
}

/**
 * The <RegistrationHeader> component displays a consistent header that includes not just the page
 * title, but also the signed in user's avatar (if any) providing access to their information as
 * well as the ability for them to sign out.
 */
export function RegistrationHeader(props: RegistrationHeaderProps) {
    const { user } = props;

    const initials =
        user ? determineInitials(`${user.firstName} ${user.lastName}`) : undefined;

    return (
        <Stack direction="row" sx={kStyles.header}>
            <Typography sx={kStyles.text} variant="h5" component="h1" noWrap>
                {props.title}
            </Typography>
            { props.user &&
                <AuthenticationHeaderChip clickable
                                          avatar={
                                              <Avatar src={props.user.avatarUrl}
                                                      sx={kStyles.avatar}>
                                                  {initials}
                                              </Avatar> }
                                          label={ props.user.displayName ?? props.user.firstName }
                                          onClick={props.onUserChipClick} /> }
            { !props.user &&
                <AuthenticationHeaderChip clickable
                                          /// @ts-ignore
                                          icon={ <FaceIcon /> }
                                          label="Sign in"
                                          onClick={props.onUserChipClick} /> }
        </Stack>
    );
}
