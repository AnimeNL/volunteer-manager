// Copyright 2024 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { notFound } from 'next/navigation';

import { CreateQuestionForm } from './CreateQuestionForm';
import { KnowledgeCategories } from './KnowledgeCategories';
import { KnowledgeList } from './KnowledgeList';
import { Section } from '@app/admin/components/Section';
import { SectionIntroduction } from '@app/admin/components/SectionIntroduction';
import { verifyAccessAndFetchPageInfo } from '@app/admin/events/verifyAccessAndFetchPageInfo';
import { createKnowledgeBaseScope } from '@app/admin/content/ContentScope';
import { generateEventMetadataFn } from '../../generateEventMetadataFn';
import { readUserSetting } from '@lib/UserSettings';
import db, { tContentCategories, tEventsTeams, tRoles, tTeams, tTeamsRoles } from '@lib/database';

/**
 * The FAQ provides a library of questions that we've received, or may receive from our visitors. It
 * is made available through the Volunteer Portal for all volunteers to be able to conveniently
 * answer any questions that they may receive from Staff, visitors and guests alike.
 */
export default async function EventTeamFaqPage(
    props: PageProps<'/admin/events/[event]/[team]/knowledge'>)
{
    const { access, event, team, user } = await verifyAccessAndFetchPageInfo(props.params);
    if (!team.flagManagesFaq)
        notFound();

    // Select the categories that questions can be associated with.
    const categories = await db.selectFrom(tContentCategories)
        .where(tContentCategories.eventId.equals(event.id))
            .and(tContentCategories.categoryDeleted.isNull())
        .select({
            id: tContentCategories.categoryId,
            label: tContentCategories.categoryTitle,
        })
        .orderBy(tContentCategories.categoryOrder, 'asc')
        .executeSelectMany();

    // Select the roles that categories can be restricted to.
    const roles = await db.selectFrom(tEventsTeams)
        .innerJoin(tTeamsRoles)
            .on(tTeamsRoles.teamId.equals(tEventsTeams.teamId))
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tTeamsRoles.roleId))
        .where(tEventsTeams.eventId.equals(event.id))
            .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
        .select({
            value: tRoles.roleId,
            label: tRoles.roleName,
        })
        .orderBy('label')
        .executeSelectMany();

    // Select the teams that categories can be restricted to.
    const teams = await db.selectFrom(tEventsTeams)
        .innerJoin(tTeams)
            .on(tTeams.teamId.equals(tEventsTeams.teamId))
        .where(tEventsTeams.eventId.equals(event.id))
            .and(tEventsTeams.enableTeam.equals(/* true= */ 1))
        .select({
            value: tTeams.teamId,
            label: tTeams.teamName,
        })
        .orderBy('label')
        .executeSelectMany();

    // Whether the `<KnowledgeCategories>` section should be expanded by default.
    const expandCategories = await readUserSetting(
        user.id, 'user-admin-knowledge-expand-categories');

    const enableAuthorLink = access.can('organisation.accounts', 'read');
    const scope = createKnowledgeBaseScope(event.id);

    return (
        <>
            <Section title="Knowledge base" subtitle={event.shortName}>
                <SectionIntroduction>
                    The <strong>knowledge base</strong> is a library of questions and answers we
                    expect from our guests, visitors and fellow volunteers, each with a prepared
                    answer.
                </SectionIntroduction>
                <KnowledgeList enableAuthorLink={enableAuthorLink} scope={scope} />
            </Section>
            { !categories.length &&
                <Section title="Create a new question">
                    <SectionIntroduction important>
                        You need to <strong>create a category</strong> before individual questions
                        can be added.
                    </SectionIntroduction>
                </Section> }
            { !!categories.length &&
                <Section title="Create a new question">
                    <CreateQuestionForm categories={categories} scope={scope} />
                </Section> }
            <KnowledgeCategories defaultExpanded={expandCategories} event={event.slug}
                                 roles={roles} teams={teams} />
        </>
    );
}

export const generateMetadata = generateEventMetadataFn('Knowledge base');
