// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useForm } from '@proxy/react-hook-form-mui';

import Button from '@mui/material/Button';

import { DataTableAction, type DataTableActionProps } from './DataTableAction';

/**
 * Props accepted by the <DeleteConfirmation> component.
 */
export interface DeleteConfirmationProps extends Pick<DataTableActionProps, 'open' | 'onClose'> {
    /**
     * Callback when the delete action has been confirmed.
     */
    onDelete: () => Promise<void> | void;

    /**
     * Subject describing what is being deleted.
     * @default "item"
     */
    subject?: string;

    /**
     * Whether the delete action is currently loading.
     */
    loading?: boolean;
}

/**
 * The <DeleteConfirmation> component encapsulates the confirmation dialog or drawer when deleting
 * items in the admin panels. Appearance is responsive.
 */
export function DeleteConfirmation(props: DeleteConfirmationProps) {
    const { open, onClose, onDelete, loading, subject = 'item' } = props;

    const formContext = useForm();
    const description =
        `Are you sure that you want to remove this ${subject}? This action can't be undone once ` +
        'you confirm its deletion.';

    return (
        <DataTableAction
            open={open} onClose={onClose} title={`Delete this ${subject}?`}
            description={description} formContext={formContext}
            confirm={
                <Button onClick={onDelete} loading={loading} variant="contained" color="error"
                        autoFocus>
                    Delete
                </Button>
            }
        />
    );
}
