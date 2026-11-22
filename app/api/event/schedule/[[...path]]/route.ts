// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type NextRequest, NextResponse } from 'next/server';

import { RecordErrorLog, kLogSeverity } from '@lib/Log';
import { getAuthenticationContext } from '@lib/auth';
import { getSchedule } from '../getSchedule';
import { runWithUserContext } from '@lib/integrations/Instrumentation';

/**
 * The /api/event/schedule endpoint can be used to acquire information about an event's schedule.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
    const event = request.nextUrl.searchParams.get('event');
    if (!event) {
        return NextResponse.json(
            { success: false, error: 'Missing event parameter' }, { status: 400 });
    }

    const authenticationContext = await getAuthenticationContext();
    if (!authenticationContext.user)
        return NextResponse.json({ success: false }, { status: 404 });

    try {
        const result = await runWithUserContext(
            authenticationContext.user.id,
            () => getSchedule(event, authenticationContext));

        if (result === 'not-found')
            return NextResponse.json({ success: false }, { status: 404 });

        if (result === 'forbidden')
            return NextResponse.json({ success: false }, { status: 403 });

        return NextResponse.json(result);

    } catch (error: any) {
        if (!process.env.VITEST_POOL_ID)
            console.error(`Schedule API (${request.nextUrl.pathname}) threw an exception:`, error);

        RecordErrorLog({
            error,
            requestUrl: request.nextUrl,
            severity: kLogSeverity.Error,
            user: authenticationContext.user,
        });

        return NextResponse.json(
            {
                success: false,
                error: 'The server was not able to handle the request.',
            },
            { status: 500 });
    }
}
