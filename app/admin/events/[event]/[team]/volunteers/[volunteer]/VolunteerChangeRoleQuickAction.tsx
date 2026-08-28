// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo, useState } from 'react';

import { SelectElement, useFormContext } from '@proxy/react-hook-form-mui';

import Alert from '@mui/material/Alert';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';

import type { ServerAction } from '@lib/serverAction';
import { ResponsiveFormDialog } from '@app/admin/components/ResponsiveFormDialog';

/**
 * Props accepted by the <VolunteerChangeRoleQuickAction> component.
 */
interface VolunteerChangeRoleQuickActionProps {
    /**
     * Server Action through which the role change can be committed.
     */
    action: ServerAction<{ role: number }>;

    /**
     * Current role ID of the volunteer.
     */
    currentRole: number;

    /**
     * First name of the volunteer, to contextualise warning prompts.
     */
    firstName: string;

    /**
     * The roles that are available for the current team.
     */
    roles: {
        /**
         * Unique ID of the role.
         */
        id: number;

        /**
         * Name of the role.
         */
        label: string;

        /**
         * Whether a warning should be shown that this role comes with additional privileges.
         */
        privilegeWarning?: boolean;

    }[];
}

/**
 * The <VolunteerChangeRoleQuickAction> component allows event administrators to change the role
 * that has been assigned to a volunteer for a particular event.
 */
export function VolunteerChangeRoleQuickAction(props: VolunteerChangeRoleQuickActionProps) {
    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);

    const handleDialogClose = useCallback(() => setDialogOpen(false), []);
    const handleDialogOpen = useCallback(() => setDialogOpen(true), []);

    const defaultValues = useMemo(() => ({
        role: props.currentRole,
    }), [ props.currentRole ]);

    return (
        <>
            <Button startIcon={ <BadgeOutlinedIcon /> } size="small" variant="outlined"
                    color="inherit" onClick={handleDialogOpen}>
                Change role
            </Button>
            <ResponsiveFormDialog
                open={dialogOpen}
                onClose={handleDialogClose}
                action={props.action}
                defaultValues={defaultValues}
                title="Change role"
                submitLabel="Update"
                description={
                    <>
                        Use this setting to adjust {props.firstName}'s assigned role, which
                        establishes their responsibilities and expectations throughout the event.
                    </>
                }>
                <ChangeRoleFormFields firstName={props.firstName} roles={props.roles} />
            </ResponsiveFormDialog>
        </>
    );
}

/**
 * Props accepted by the <ChangeRoleFormFields> component.
 */
interface ChangeRoleFormFieldsProps {
    /**
     * First name of the volunteer, to contextualise the warning.
     */
    firstName: string;

    /**
     * The roles that are available for the current team.
     */
    roles: VolunteerChangeRoleQuickActionProps['roles'];
}

/**
 * The <ChangeRoleFormFields> component contains the form fields for selecting a role, isolated to
 * enable watching value changes and displaying privilege warnings.
 */
function ChangeRoleFormFields(props: ChangeRoleFormFieldsProps) {
    const { firstName, roles } = props;
    const { watch } = useFormContext();

    const selectedRole = watch('role');
    const selectedRoleWarning =
        roles.some(entry => entry.id === selectedRole && entry.privilegeWarning);

    return (
        <>
            <SelectElement name="role" label="Role" size="small" fullWidth options={roles} />
            <Collapse in={!!selectedRoleWarning} mountOnEnter unmountOnExit>
                <Alert severity="warning" variant="outlined">
                    This role will grant administration access to <strong>{firstName}</strong> for
                    this event.
                </Alert>
            </Collapse>
        </>
    );
}
