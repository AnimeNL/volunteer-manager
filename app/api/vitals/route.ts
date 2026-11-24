// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';

import { RecordErrorLog, kLogSeverity } from '@lib/ErrorLog';
import { normalizeVitalRoute } from './normalizeRoute';
import db, { tWebVitals } from '@lib/database';

import { kWebVitalDeviceType, kWebVitalMetric, kWebVitalNavigationType } from '@lib/database/Types';

/**
 * Maximum number of Web Vitals entries accepted in a single beacon payload.
 */
const kMaxBatchSize = 50;

/**
 * Maximum accepted metric value (10 minutes in milliseconds) to guard against bogus clock spikes.
 */
const kMaxMetricValue = 600_000;

/**
 * Maximum length of the `vital_origin` column in MariaDB.
 */
const kMaxOriginLength = 128;

/**
 * Schema for a single Web Vitals measurement within a beacon batch.
 */
const kVitalEntrySchema = z.object({
    metric: z.enum(kWebVitalMetric),
    value: z.number().finite().min(0).max(kMaxMetricValue),
    navigationType: z.enum(kWebVitalNavigationType),
    pathname: z.string().min(1).max(1024).startsWith('/'),
});

/**
 * Schema for the `POST /api/vitals` beacon payload.
 */
const kVitalsPayloadSchema = z.object({
    buildHash: z.string().regex(/^([0-9a-f]{7}|dev)$/),
    deviceType: z.enum(kWebVitalDeviceType),
    vitals: z.array(kVitalEntrySchema).min(1).max(kMaxBatchSize),
});

/**
 * Verifies that an incoming browser beacon originates from the same host as the request target.
 */
function isSameOriginRequest(request: NextRequest, host: string): boolean {
    const originHeader = request.headers.get('origin');
    if (!originHeader)
        return true;

    try {
        return new URL(originHeader).host === host;
    } catch {
        return false;
    }
}

/**
 * Ingestion endpoint for client-side Web Vitals beacons (`navigator.sendBeacon`). Records batched
 * measurements into the `web_vitals` table across the entire portal.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    const host = request.headers.get('host') || request.nextUrl.host || 'unknown';
    if (!isSameOriginRequest(request, host))
        return NextResponse.json({ success: false }, { status: 403 });

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ success: false }, { status: 400 });
    }

    const parsed = kVitalsPayloadSchema.safeParse(body);
    if (!parsed.success)
        return NextResponse.json({ success: false }, { status: 400 });

    const { buildHash, deviceType, vitals } = parsed.data;
    const origin = host.slice(0, kMaxOriginLength);

    try {
        const dbInstance = db;
        await dbInstance.insertInto(tWebVitals)
            .values(vitals.map(entry => ({
                vitalDate: dbInstance.currentZonedDateTime(),
                vitalOrigin: origin,
                vitalRoute: normalizeVitalRoute(entry.pathname),
                vitalMetric: entry.metric,
                vitalValue: entry.value,
                vitalNavigationType: entry.navigationType,
                vitalDeviceType: deviceType,
                vitalBuildHash: buildHash,
            })))
            .executeInsert();

        return new NextResponse(null, { status: 204 });

    } catch (error: any) {
        if (!process.env.VITEST_POOL_ID)
            console.error('Vitals API threw an exception:', error);

        RecordErrorLog({
            error,
            requestUrl: request.nextUrl,
            severity: kLogSeverity.Error,
            user: undefined,
        });

        return NextResponse.json({ success: false }, { status: 500 });
    }
}
