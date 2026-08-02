// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import Button from '@mui/material/Button';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';

import type { ServerAction } from '@lib/serverAction';
import { LazyAvatarEditor } from '@components/LazyAvatarEditor';

/**
 * Props accepted by the <ChangeImageQuickAction> component.
 */
interface ChangeImageQuickActionProps {
    /**
     * Server Action through which the quick action can be committed.
     */
    action: ServerAction<{ imageData: string }>;

    /**
     * Hash of the event's current identity image, if any.
     */
    imageHash?: string;
}

/**
 * The <ChangeImageQuickAction> component allows an event's image to be promptly replaced.
 */
export function ChangeImageQuickAction(props: ChangeImageQuickActionProps) {
    const router = useRouter();

    const [ editorOpen, setEditorOpen ] = useState<boolean>(false);

    const handleClose = useCallback(() => setEditorOpen(false), []);
    const handleOpen = useCallback(() => setEditorOpen(true), []);

    const handleImage = useCallback(async (image: Blob) => {
        const base64Header = 'data:image/png;base64,';
        const base64Image = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onloadend =
                () => resolve((reader.result as string).substring(base64Header.length));
            reader.readAsDataURL(image);
        });

        const result = await props.action({ imageData: base64Image as string });
        if (result.success)
            router.refresh();

        return result.success;

    }, [ props.action, router ]);

    const imageSrc =
        props.imageHash ? `/blob/${props.imageHash}.png`
                        : undefined;

    return (
        <>
            <Button startIcon={ <ImageOutlinedIcon /> } size="small" variant="outlined"
                    color="inherit" onClick={handleOpen}>
                Change image
            </Button>
            <LazyAvatarEditor open={editorOpen} requestClose={handleClose} src={imageSrc}
                              requestUpload={handleImage} title="Upload a new image"
                              width={1200} height={960} border={[ 0, 0 ]} borderRadius={0}
                              fullWidth />
        </>
    );
}
