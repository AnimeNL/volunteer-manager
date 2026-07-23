// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';

import { readSetting } from '@lib/Settings';
import db, { tNardo } from '@lib/database';

import { kThemeImageVersion } from '@app/config';

/**
 * Props accepted by the <NardoCard> component.
 */
interface NardoCardProps {
    /**
     * Whether a header should be included with the card.
     */
    header?: boolean;
}

/**
 * The <NardoCard> component is a full-width card that offers advice, through our friends at Del a
 * Rie Advies. It's funny, but also makes sure that the Organisation dashboard is not empty.
 */
export async function NardoCard(props: NardoCardProps) {
    const timeLimitMinutes = await readSetting('schedule-del-a-rie-advies-time-limit') ?? 5;
    const timeLimitSeconds = timeLimitMinutes * 60;

    const seedBase = Math.round(Temporal.Now.instant().epochMilliseconds / 1000);
    const seed = Math.round(seedBase / timeLimitSeconds) * timeLimitSeconds;

    const dbInstance = db;
    const advice = await dbInstance.selectFrom(tNardo)
        .where(tNardo.nardoVisible.equals(/* true= */ 1))
        .selectOneColumn(tNardo.nardoAdvice)
        .orderBy(dbInstance.rawFragment`rand(${dbInstance.const(seed, 'int')})`)
        .limit(1)
        .executeSelectNoneOrOne() ?? undefined;

    return (
        <Card>
            { !!props.header &&
                <CardMedia component="img" height="150" alt="Del a Rie Advies"
                           image={`/images/theme/del-a-rie-advies.jpg?${kThemeImageVersion}`} /> }
            <CardContent sx={{ pb: '16px !important' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {advice}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.disabled', pt: 0.5 }}>
                    — Del a Rie Advies
                </Typography>
            </CardContent>
        </Card>
    );
}
