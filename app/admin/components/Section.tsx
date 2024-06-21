// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';

import { SectionHeader, type SectionHeaderProps } from './SectionHeader';

/**
 * Props accepted by the <Section> component, that are directly owned by the <Section> component.
 * Other props, e.g. that of the header, will be included.
 */
interface SectionOwnProps {
    // TODO: Additional options go here.
}

/**
 * Props accepted by the <Section> component. The `SectionOwnProps` are included, and either a valid
 * header or an explicit, boolean indication that no header should be included.
 */
export type SectionProps = SectionOwnProps & (SectionHeaderProps | { noHeader: true });

/**
 * The <Section> component represents a visually separated section of a page in the administration
 * area. The component is designed to be compatible with server-side rendering once the MUI library
 * supports this, and deliberately avoids the use of callbacks.
 *
 * Visually, a section consists of a header and associated content. The header contains a title, and
 * optionally a subtitle, a permission and an action. The content can be anything, which will be
 * displayed in a flexbox container that automatically adds spacing between the elements.
 *
 * While this component avoids the need for client-side JavaScript, actions can be passed that do
 * require them, to enable interaction such as a clear button.
 */
export function Section(props: React.PropsWithChildren<SectionProps>) {
    const { children, ...sectionHeaderProps } = props;

    return (
        <Paper component={Stack} direction="column" spacing={2} sx={{ p: 2 }}>
            { !('noHeader' in sectionHeaderProps) && <SectionHeader {...sectionHeaderProps} /> }
            {children}
        </Paper>
    );
}
