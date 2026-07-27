// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import TipsAndUpdatesOutlinedIcon from '@mui/icons-material/TipsAndUpdatesOutlined';

import { DataTable, createDataSource, withRowModel, type Column, type ExtractRowModel }
    from '@app/admin/components/DataTable';
import { LogBuilder } from '@lib/log/index';
import { Section } from '../../components/Section';
import { SectionIntroduction } from '../../components/SectionIntroduction';
import { createGenerateMetadataFn } from '../../lib/generatePageMetadata';
import { executeAccessCheck, requireAuthenticationContext } from '@lib/auth/AuthenticationContext';
import db, { tNardo, tUsers } from '@lib/database';

/**
 * Data source through which the Del a Rie Advies pieces of advice can be retrieved.
 */
const nardoDataSource = createDataSource('organisation/nardo', withRowModel({
    /**
     * Unique ID of the piece of advice.
     */
    id: z.number(),

    /**
     * The advice text.
     */
    advice: z.string(),

    /**
     * Author who created/updated this advice.
     */
    author: z.object({
        id: z.number(),
        name: z.string(),
    }),

    /**
     * Date and time at which the advice was last updated.
     */
    date: z.string(),

}), {
    async authorize(operation, props) {
        executeAccessCheck(props.authenticationContext, {
            check: 'admin',
            permission: 'organisation.nardo',
        });
    },

    async create(partialRow, props) {
        console.log(partialRow);
        if (!partialRow.advice)
            return false;

        const dbInstance = db;
        const affectedRows = await dbInstance.insertInto(tNardo)
            .set({
                nardoAdvice: partialRow.advice,
                nardoAuthorId: props.user.id,
                nardoAuthorDate: dbInstance.currentZonedDateTime(),
                nardoUpdated: dbInstance.currentZonedDateTime(),
            })
            .executeInsert();

        LogBuilder.for('CreateNardoAdvice')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .record();

        return true;
    },

    async delete(row, props) {
        const dbInstance = db;
        const affectedRows = await dbInstance.update(tNardo)
            .set({ nardoDeleted: dbInstance.currentZonedDateTime() })
            .where(tNardo.nardoId.equals(row.id))
                .and(tNardo.nardoVisible.equals(/* true= */ 1))
            .executeUpdate();

        LogBuilder.for('DeleteNardoAdvice')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withDiff({
                Advice: {
                    before: row.advice,
                    after: '',
                },
            })
            .record();

        return true;
    },

    async list(params) {
        let sortField: 'advice' | 'author.name' | 'date' = 'date';
        switch (params.sort.field) {
            case 'advice':
            case 'date':
                sortField = params.sort.field;
                break;

            case 'author':
                sortField = 'author.name';
                break;
        }

        const dbInstance = db;
        const results = await dbInstance.selectFrom(tNardo)
            .innerJoin(tUsers)
                .on(tUsers.userId.equals(tNardo.nardoAuthorId))
            .where(tNardo.nardoDeleted.isNull())
                .and(tNardo.nardoAdvice.containsInsensitiveIfValue(params.search).or(
                     tUsers.name.containsInsensitiveIfValue(params.search)))
            .select({
                id: tNardo.nardoId,
                advice: tNardo.nardoAdvice,
                author: {
                    id: tUsers.userId,
                    name: tUsers.name,
                },
                date: dbInstance.dateTimeAsString(tNardo.nardoUpdated),
            })
            .orderBy(sortField, params.sort.direction)
            .limit(params.page.limit)
                .offset(params.page.offset)
            .executeSelectPage();

        return {
            rowCount: results.count,
            rows: results.data,
        };
    },

    async update(row, previousRow, props) {
        const dbInstance = db;
        const affectedRows = await dbInstance.update(tNardo)
            .set({
                nardoAdvice: row.advice,
                nardoUpdated: dbInstance.currentZonedDateTime(),
            })
            .where(tNardo.nardoId.equals(row.id))
                .and(tNardo.nardoVisible.equals(/* true= */ 1))
            .executeUpdate();

        LogBuilder.for('UpdateNardoAdvice')
            .withCondition(!!affectedRows)
            .withInitiatorUser(props.user)
            .withDiff({
                Advice: {
                    before: previousRow.advice,
                    after: row.advice,
                },
            })
            .record();

        return true;
    },
});

/**
 * The <NardoPage> component displays the pieces of advice that Del a Rie Advies is able to
 * issue to volunteers. Pieces can be updated and deleted.
 */
export default async function NardoPage() {
    await requireAuthenticationContext({
        check: 'admin',
        permission: 'organisation.nardo',
    });

    const columns: Column<ExtractRowModel<typeof nardoDataSource>>[] = [
        {
            field: 'advice',
            headerName: 'Advice',
            sortable: true,
            editable: true,
            flex: 3,

            editorProps: {
                placeholder: 'What would Nardo say?',
                required: true,
            },
        },
        {
            field: 'author',
            headerName: 'Author',
            sortable: true,
            flex: 1,

            template: 'account',
        },
        {
            field: 'date',
            headerName: 'Date',
            sortable: true,
            width: 115,

            template: 'date',
        },
    ];

    return (
        <>
            <Section icon={ <TipsAndUpdatesOutlinedIcon color="primary" /> }
                     title="Del a Rie Advies"
                     breadcrumbs={[
                         { label: 'Organisation', href: '/admin/organisation' },
                         { label: 'Del a Rie Advies' },
                     ]}>
                <SectionIntroduction>
                    Expert advice offered by our friends from <strong>Del a Rie Advies</strong> will
                    ocassionally be shared with volunteers.
                </SectionIntroduction>
            </Section>
            <Section noHeader tabs>
                <DataTable columns={columns}
                           source={nardoDataSource}
                           defaultSort={{ field: 'date', sort: 'desc' }}
                           pageSize={50} subject="expert advice"
                           listViewProps={{
                               primaryField: 'advice',
                               secondaryTemplate: 'By {author.name}',
                               dateField: 'date',
                           }} />
            </Section>
        </>
    );
}

export const generateMetadata = createGenerateMetadataFn('Del a Rie Advies', 'Organisation');
