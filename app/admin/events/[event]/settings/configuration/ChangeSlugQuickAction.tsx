// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { TextFieldElement } from '@app/components/proxy/react-hook-form-mui';

import Button from '@mui/material/Button';
import LinkIcon from '@mui/icons-material/Link';

import type { ServerAction } from '@lib/serverAction';
import { ResponsiveFormDialog } from '@app/admin/components/ResponsiveFormDialog';

/**
 * Props accepted by the <ChangeSlugQuickAction> component.
 */
interface ChangeSlugQuickActionProps {
    /**
     * Server Action through which the quick action can be committed.
     */
    action: ServerAction<{ slug: string }>;

    /**
     * Existing slug used to identify the event.
     */
    slug: string;
}

/**
 * The <ChangeSlugQuickAction> component allows an event's slug to be updated.
 */
export function ChangeSlugQuickAction(props: ChangeSlugQuickActionProps) {
    const router = useRouter();

    const [ dialogOpen, setDialogOpen ] = useState<boolean>(false);

    const handleDialogClose = useCallback(() => setDialogOpen(false), []);
    const handleDialogOpen = useCallback(() => setDialogOpen(true), []);

    const handleSubmit = useCallback(async (data: { slug: string }) => {
        const result = await props.action(data);
        if (result.success) {
            // Redirect the user to the new settings page as opposed to closing the dialog, as the
            // current page (& rest of the volunteers area) will no longer exist.
            router.push(`/admin/events/${data.slug}/settings/configuration`);
        } else {
            throw new Error(result.error || 'Unable to change the slug of this event.');
        }
    }, [ props.action, router ]);

    const currentYear = useMemo(() => new Date().getFullYear(), [ /* no dependencies */ ]);
    const defaultValues = useMemo(() => ({ slug: props.slug }), [ props.slug ]);

    return (
        <>
            <Button startIcon={ <LinkIcon /> } size="small" variant="outlined" color="inherit"
                    onClick={handleDialogOpen}>
                Change slug
            </Button>
            <ResponsiveFormDialog
                open={dialogOpen}
                onClose={handleDialogClose}
                onSubmit={handleSubmit}
                defaultValues={defaultValues}
                title="Change this event's slug"
                description={
                    <>
                        This will change the event's identifier used in links (such as
                        "{currentYear}") to something different. All existing links to the event
                        will be broken!
                    </>
                }>

                <TextFieldElement name="slug" label="Event slug" fullWidth size="small"
                                  required />

            </ResponsiveFormDialog>
        </>
    );
}
