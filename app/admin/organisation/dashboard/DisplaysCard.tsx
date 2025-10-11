// Copyright 2025 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Link from '@app/LinkProxy';

import type { SvgIconProps } from '@mui/material/SvgIcon';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import ReadMoreIcon from '@mui/icons-material/ReadMore';
import TabletIcon from '@mui/icons-material/Tablet';

import { Temporal } from '@lib/Temporal';
import db, { tDisplays } from '@lib/database';

/**
 * The <DisplaysCard> component is a card that shows recently active volunteering displays. It links
 * through to the dedicated Displays page allowing them to be configured as required.
 */
export async function DisplaysCard() {
    const currentTime = Temporal.Now.zonedDateTimeISO();
    const onlineCutoffTime = currentTime.subtract({ minutes: 10 });

    const onlineDisplays = await db.selectFrom(tDisplays)
        .where(tDisplays.displayCheckIn.greaterOrEquals(onlineCutoffTime))
        .selectCountAll()
        .executeSelectNoneOrOne() ?? 0;

    let color: SvgIconProps['color'] = 'success';
    let textColor: 'success' | 'textDisabled' = 'success';
    let title: string;
    switch (onlineDisplays) {
        case 0:
            color = 'disabled';
            textColor = 'textDisabled';
            title = 'There are no active displays…';
            break;

        case 1:
            title = 'There is one active display';
            break;

        default:
            title = `There are ${onlineDisplays} active displays`;
            break;
    }

    return (
        <Card>
            <CardHeader avatar={ <TabletIcon color={color} /> } title={title}
                        action={
                            <IconButton LinkComponent={Link} href="/admin/organisation/displays"
                                        size="small" sx={{ mt: 0.25 }}>
                                <ReadMoreIcon fontSize="small" color={color} />
                            </IconButton>
                        }
                        slotProps={{
                            title: {
                                color: textColor,
                                variant: 'subtitle2'
                            }
                        }} />
        </Card>
    );
}
