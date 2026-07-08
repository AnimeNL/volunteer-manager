// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import Stack from '@mui/material/Stack';

import type { SectionBreadcrumbsProps } from './SectionBreadcrumbs';
import { ResponsivePaper } from './ResponsivePaper';
import { SectionBreadcrumbs } from './SectionBreadcrumbs';
import { SectionHeader, type SectionHeaderProps } from './SectionHeader';
import { SectionTabs } from './SectionTabs';

/**
 * Props accepted by the <Section> component, that are directly owned by the <Section> component.
 * Other props, e.g. that of the header, will be included.
 */
interface SectionOwnProps extends Partial<SectionBreadcrumbsProps> {
    /**
     * Whether a tab bar should be shown at the section's top.
     */
    tabs?: boolean;
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
    const { breadcrumbs, children, tabs, ...sectionHeaderProps } = props;

    return (
        <ResponsivePaper sx={{ p: 2 }}>
            { !!tabs && <SectionTabs />}
            { !!breadcrumbs && <SectionBreadcrumbs breadcrumbs={breadcrumbs} /> }
            <Stack direction="column" spacing={2} sx={ !!tabs ? { mt: 2 } : undefined }>
                { !('noHeader' in sectionHeaderProps) && <SectionHeader {...sectionHeaderProps} /> }
                {children}
            </Stack>
        </ResponsivePaper>
    );
}
