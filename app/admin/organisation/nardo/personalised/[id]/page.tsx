// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import NotesIcon from '@mui/icons-material/Notes';
import Typography from '@mui/material/Typography';

import { GeminiIcon } from '@app/admin/components/icons/GeminiIcon';
import { KeyValueList } from '@app/admin/components/KeyValueList';
import { Markdown } from '@components/Markdown';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { createGenerateMetadataFn } from '../../../../lib/generatePageMetadata';
import { requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tNardoPersonalised, tUsers } from '@lib/database';

/**
 * This page displays an individual piece of personalised advice to the reader, to inspect whether
 * the AI is generating reasonable results based on the given input.
 */
export default async function NardoPersonalisedAdvicePage(
    props: PageProps<'/admin/organisation/nardo/personalised/[id]'>)
{
    const { id } = await props.params;

    await requireAuthenticationContext({
        check: 'admin',
        permission: 'organisation.nardo',
    });

    const dbInstance = db;
    const advice = await dbInstance.selectFrom(tNardoPersonalised)
        .innerJoin(tUsers)
            .on(tUsers.userId.equals(tNardoPersonalised.nardoPersonalisedUserId))
        .where(tNardoPersonalised.nardoPersonalisedId.equals(parseInt(id, /* radix= */ 10)))
        .select({
            date: dbInstance.dateTimeAsString(tNardoPersonalised.nardoPersonalisedDate),
            user: {
                id: tUsers.userId,
                name: tUsers.name,
            },
            input: tNardoPersonalised.nardoPersonalisedInput,
            output: tNardoPersonalised.nardoPersonalisedOutput,
        })
        .executeSelectNoneOrOne();

    if (!advice)
        notFound();

    return (
        <>
            <Section icon={ <GeminiIcon /> }
                    title={`Expert advice #${id}`}
                    breadcrumbs={[
                        { label: 'Organisation', href: '/admin/organisation' },
                        { label: 'Del a Rie Advies', href: '/admin/organisation/nardo' },
                        { label: 'Personalised advice', href: '/admin/organisation/nardo/personalised' },
                        { label: `#${id}` },
                    ]}>
                <SectionIntroduction>
                    Personalised advice generated for <strong>{advice.user.name}</strong> based on
                    their participation.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <KeyValueList items={[
                    {
                        key: 'Volunteer',
                        value: advice.user,
                        valueTemplate: 'account',
                    },
                    {
                        key: 'Date',
                        value: advice.date,
                        valueTemplate: 'localDateTime',
                    },
                ]} />
                <Markdown defaultVariant="body2">{advice.output}</Markdown>
            </Section>
            <Section icon={ <NotesIcon /> } title="Input prompt">
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                    {advice.input}
                </Typography>
            </Section>
        </>
    );
}

export const generateMetadata =
    createGenerateMetadataFn({ param: 'id' }, 'Personalised Advice', 'Del a Rie Advies',
                             'Organisation');
