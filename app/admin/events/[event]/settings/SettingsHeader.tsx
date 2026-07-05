// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { TextFieldElement } from '@proxy/react-hook-form-mui';

import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import ImageIcon from '@mui/icons-material/Image';
import LinkIcon from '@mui/icons-material/Link';
import Paper from '@mui/material/Paper';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import Stack from '@mui/material/Stack';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import Typography from '@mui/material/Typography';

import type { PageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import { ContrastBox } from '@app/admin/components/ContrastBox';
import { LazyAvatarEditor } from '@components/LazyAvatarEditor';
import { SettingDialog } from '@app/admin/components/SettingDialog';
import { TransitionAlert } from '@app/admin/components/TransitionAlert';
import { callApi } from '@lib/callApi';

/**
 * Description to use for the event publication dialog.
 */
const kPublishDescription =
    'Publishing this event will publicly reference it, and grants administration rights to ' +
    'senior volunteers who participate in it.';

/**
 * Description to use for the event suspension dialog.
 */
const kSuspendDescription =
    'Suspending this event will remove all public references, and revoke the rights granted to ' +
    'senior volunteers who participate in it.';

/**
 * Description to use for the slug update dialog.
 */
const kSlugDescription =
    'Updating the slug will change the URLs through which this event\'s content and settings can ' +
    'be reached. This will invalidate all existing links!'

/**
 * Props accepted by the <SettingsHeader> component.
 */
interface SettingsHeaderProps {
    /**
     * Information about the event whose settings are being changed.
     */
    event: PageInfo['event'];
}

/**
 * The <SettingsHeader> component displays the header for the settings page, as well as some of the
 * more powerful options that we display separately from regular page content.
 */
export function SettingsHeader(props: SettingsHeaderProps) {
    const { event } = props;

    const router = useRouter();

    const imageSrc = useMemo(() => {
        return props.event.identityHash ? `/blob/${props.event.identityHash}.png`
                                        : undefined;
    }, [ props.event.identityHash ]);

    const [ imageOpen, setImageOpen ] = useState<boolean>(false);
    const [ publishOpen, setPublishOpen ] = useState<boolean>(false);
    const [ suspendOpen, setSuspendOpen ] = useState<boolean>(false);
    const [ slugOpen, setSlugOpen ] = useState<boolean>(false);

    const handleClose = useCallback((invalidated: boolean) => {
        if (invalidated)
            router.refresh();

        setPublishOpen(false);
        setSuspendOpen(false);
    }, [ router ]);

    const openPublish = useCallback(() => setPublishOpen(true), [ /* no deps */ ]);
    const handlePublish = useCallback(async () => {
        const response = await callApi('post', '/api/admin/update-event', {
            event: event.slug,
            eventHidden: /* publish= */ false,
        });

        return response.success ? { success: `${event.shortName} has been published.` }
                                : { error: `${event.shortName} could not be published.` };
    }, [ event.shortName, event.slug ]);

    const openSuspend = useCallback(() => setSuspendOpen(true), [ /* no deps */ ]);
    const handleSuspend = useCallback(async () => {
        const response = await callApi('post', '/api/admin/update-event', {
            event: event.slug,
            eventHidden: /* suspend= */ true,
        });

        return response.success ? { success: `${event.shortName} has been suspended.` }
                                : { error: `${event.shortName} could not be suspended.` };
    }, [ event.shortName, event.slug ]);

    const closeImage = useCallback(() => setImageOpen(false), [ /* no deps */ ]);
    const openImage = useCallback(() => setImageOpen(true), [ /* no deps */ ]);

    const handleImage = useCallback(async (avatar: Blob) => {
        const base64Header = 'data:image/png;base64,';
        const base64Avatar = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onloadend =
                () => resolve((reader.result as string).substring(base64Header.length));
            reader.readAsDataURL(avatar);
        });

        const response = await callApi('post', '/api/admin/update-event', {
            event: event.slug,
            eventIdentity: base64Avatar as string,
        });

        if (response.success)
            router.refresh();

        return response.success;
    }, [ event.slug, router ]);

    const [ updatedSlug, setUpdatedSlug ] = useState<string | undefined>();

    const openSlug = useCallback(() => setSlugOpen(true), [ /* no deps */ ]);
    const handleSlug = useCallback(async (data: any) => {
        const response = await callApi('post', '/api/admin/update-event', {
            event: event.slug,
            eventSlug: data.slug,
        });

        if (!response.success || !response.slug)
            return { error: 'The slug could not be updated. Does such an event already exist?' };

        setUpdatedSlug(response.slug);

        return { success: `${event.shortName}'s slug has been updated.` };
    }, [ event ]);

    const handleCloseSlug = useCallback((invalidated: boolean) => {
        setSlugOpen(false);
        if (invalidated && updatedSlug && updatedSlug !== event.slug)
            router.push(`/admin/events/${updatedSlug}/settings`);

    }, [ event, router, updatedSlug ])

    return (
        <Paper sx={{ p: 2 }}>
            <Typography variant="h5">
                Settings
                <Typography component="span" variant="h5" sx={{ color: 'action.active', pl: 1 }}>
                    ({event.shortName})
                </Typography>
            </Typography>
            <ContrastBox sx={{ mt: 1, px: 2, py: 1 }}>
                <Stack divider={ <Divider orientation="vertical" flexItem /> }
                       direction="row" spacing={1}>

                    { event.hidden &&
                        <Button startIcon={ <PlayCircleIcon /> } onClick={openPublish}>
                            Publish
                        </Button> }

                    { !event.hidden &&
                        <Button startIcon={ <StopCircleIcon /> } onClick={openSuspend}>
                            Suspend
                        </Button> }

                    <Button startIcon={ <ImageIcon /> } onClick={openImage}>Change image</Button>

                    <Button startIcon={ <LinkIcon /> } onClick={openSlug}>Change slug</Button>

                </Stack>
            </ContrastBox>
            <TransitionAlert severity={ event.hidden ? 'error' : 'success' } sx={{ mt: 2 }}>
                { event.hidden &&
                    <>
                        <strong>{event.shortName}</strong> is currently suspended. Senior rights
                        granted for this event have been revoked, public references have been
                        removed.
                    </> }
                { !event.hidden &&
                    <>
                        <strong>{event.shortName}</strong> is live. Senior rights granted for this
                        event are active, and public references to the event remain available.
                    </> }
            </TransitionAlert>
            <SettingDialog title={`Publish ${event.shortName}`} open={publishOpen}
                           description={kPublishDescription} submitLabel="Publish"
                           onClose={handleClose} onSubmit={handlePublish} />

            <SettingDialog title={`Suspend ${event.shortName}`} open={suspendOpen}
                           description={kSuspendDescription} submitLabel="Suspend"
                           onClose={handleClose} onSubmit={handleSuspend} />

            <LazyAvatarEditor open={imageOpen} requestClose={closeImage} src={imageSrc}
                              requestUpload={handleImage} title="Upload a new image"
                              width={1200} height={960} border={[ 0, 0 ]} borderRadius={0} />

            <SettingDialog title={`${event.shortName} slug`} open={slugOpen}
                           description={kSlugDescription} onClose={handleCloseSlug}
                           onSubmit={handleSlug} defaultValues={event}>
                <TextFieldElement name="slug" label="Slug" required fullWidth size="small"
                                  sx={{ mt: 2 }} />
            </SettingDialog>
        </Paper>
    );
}
