// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

/**
 * Props accepted by the <SectionIntroduction> component.
 */
interface SectionIntroductionProps {
    /**
     * Whether this introduction should be rendered in a full-width grid section.
     */
    grid?: boolean;

    /**
     * Whether the introduction is important and should receive additional emphasis.
     */
    important?: boolean;
}

/**
 * The <SectionIntroduction> component can be used to introduce the user to the purpose of a
 * particular section. The `important` prop can be used to give the explanation additional clarity.
 */
export function SectionIntroduction(props: React.PropsWithChildren<SectionIntroductionProps>) {
    if (props.grid) {
        return (
            <Grid size={{ xs: 12 }}>
                <Typography variant="body2">
                    {props.children}
                </Typography>
            </Grid>
        );
    } else {
        return (
            <Typography variant="body2">
                {props.children}
            </Typography>
        );
    }
}
