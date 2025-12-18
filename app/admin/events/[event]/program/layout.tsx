// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import Paper from '@mui/material/Paper';

import { ProgramHistory } from './ProgramHistory';
import { ProgramNavigation } from './ProgramNavigation';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';

/**
 * The <ProgramLayout> component contains the common elements between the different pages that make
 * up the Program section of the Volunteer Manager. A program is bound to an event.
 */
export default async function ProgramLayout(props: LayoutProps<'/admin/events/[event]/program'>) {
    const { event } = await verifyAccessAndFetchPageInfo(props.params);
    if (!event.festivalId)
        notFound();  // events must be associated with a `festivalId` in order to have a program

    return (
        <>
            <Paper>
                <ProgramNavigation slug={event.slug} />
                {props.children}
            </Paper>
            <ProgramHistory context={{ event: event.slug, festivalId: event.festivalId }} />
        </>
    );
}
