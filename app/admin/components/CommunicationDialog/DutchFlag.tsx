// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import SvgIcon from '@mui/material/SvgIcon';

/**
 * The Dutch flag, in SVG format.
 * @see https://upload.wikimedia.org/wikipedia/commons/2/20/Flag_of_the_Netherlands.svg
 */
export function DutchFlag() {
    return (
        <SvgIcon fontSize="large">
            <svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 9 6">
                <rect fill="#21468B" width="9" height="6" />
                <rect fill="#FFF" width="9" height="4" />
                <rect fill="#AE1C28" width="9" height="2" />
            </svg>
        </SvgIcon>
    );
}
