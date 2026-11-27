// Copyright 2026 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import 'server-only';
import { cache } from 'react';
import { cacheLife, cacheTag } from 'next/cache';

import db, { tContent, tContentCategories, tUsersEvents } from '@lib/database';

import { kContentType, kRegistrationStatus } from '@lib/database/Types';

/**
 * Serializable Knowledge Base category summary cached per event.
 */
interface CachedKnowledgeCategory {
    description?: string;
    icon: string;
    id: number;
    questionCount: number;
    roles: string;
    teams: string;
    title: string;
}

/**
 * Knowledge Base category visible to a volunteer on the index page.
 */
export interface KnowledgeBaseCategorySummary {
    description?: string;
    icon: string;
    id: number;
    limited: boolean;
    questionCount: number;
    title: string;
}

/**
 * Single Knowledge Base question and its Markdown answer.
 */
interface KnowledgeBaseQuestion {
    answer: string;
    id: string;
    question: string;
}

/**
 * Full Knowledge Base category detail including all alphabetically sorted FAQ questions.
 */
interface KnowledgeBaseCategoryDetail {
    description?: string;
    icon: string;
    id: number;
    limited: boolean;
    questions: KnowledgeBaseQuestion[];
    title: string;
}

/**
 * Serializable Knowledge Base category detail cached per event and category.
 */
interface CachedKnowledgeCategoryDetail {
    description?: string;
    icon: string;
    id: number;
    questions: KnowledgeBaseQuestion[];
    roles: string;
    teams: string;
    title: string;
}

/**
 * Accepted role and team identifiers for a volunteer participating in an event.
 */
interface VolunteerParticipation {
    roleId: number;
    teamId: number;
}

/**
 * Splits a comma-separated restriction string (`categoryRoles` or `categoryTeams`) into non-empty
 * string identifiers.
 */
function parseRestrictionList(value: string): string[] {
    return value ? value.split(',').filter(Boolean) : [];
}

/**
 * Evaluates whether a volunteer with `participations` (or unrestricted `event.knowledge` access)
 * can view a category with the given `roles` and `teams` restrictions.
 */
function canAccessCategory(
    roles: string, teams: string, hasUnrestrictedAccess: boolean,
    participations: VolunteerParticipation[]): boolean
{
    const restrictedRoles = parseRestrictionList(roles);
    const restrictedTeams = parseRestrictionList(teams);

    if (!restrictedRoles.length && !restrictedTeams.length)
        return true;

    if (hasUnrestrictedAccess)
        return true;

    return participations.some(participation => {
        if (restrictedRoles.length > 0 && !restrictedRoles.includes(`${participation.roleId}`))
            return false;

        if (restrictedTeams.length > 0 && !restrictedTeams.includes(`${participation.teamId}`))
            return false;

        return true;
    });
}

/**
 * Loads all non-empty Knowledge Base categories for `eventId`, ordered by `categoryOrder`.
 */
async function loadCachedKnowledgeCategories(eventId: number): Promise<CachedKnowledgeCategory[]> {
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule-knowledge', `schedule-knowledge:${eventId}`);

    return await db.selectFrom(tContentCategories)
        .innerJoin(tContent)
            .on(tContent.contentType.equals(kContentType.FAQ))
                .and(tContent.contentCategoryId.equals(tContentCategories.categoryId))
                .and(tContent.revisionVisible.equals(/* true= */ 1))
        .where(tContentCategories.eventId.equals(eventId))
            .and(tContentCategories.categoryDeleted.isNull())
        .select({
            description: tContentCategories.categoryDescription,
            icon: tContentCategories.categoryIcon,
            id: tContentCategories.categoryId,
            questionCount: db.count(tContent.contentId),
            roles: tContentCategories.categoryRoles,
            teams: tContentCategories.categoryTeams,
            title: tContentCategories.categoryTitle,
        })
        .groupBy(tContentCategories.categoryId)
        .orderBy(tContentCategories.categoryOrder, 'asc')
        .executeSelectMany();
}

/**
 * Request-cached lookup of accepted team and role participations for `userId` in `eventId`.
 */
const loadVolunteerParticipations = cache(
    async (eventId: number, userId: number): Promise<VolunteerParticipation[]> =>
        db.selectFrom(tUsersEvents)
            .where(tUsersEvents.userId.equals(userId))
                .and(tUsersEvents.eventId.equals(eventId))
                .and(tUsersEvents.registrationStatus.equals(kRegistrationStatus.Accepted))
            .select({
                roleId: tUsersEvents.roleId,
                teamId: tUsersEvents.teamId,
            })
            .executeSelectMany());

/**
 * Returns the ordered list of Knowledge Base categories visible to `userId` in `eventId`.
 */
export async function getKnowledgeBaseCategories(
    eventId: number, userId: number, hasUnrestrictedAccess: boolean)
    : Promise<KnowledgeBaseCategorySummary[]>
{
    const categories = await loadCachedKnowledgeCategories(eventId);
    if (!categories.length)
        return [];

    const needsParticipationCheck = !hasUnrestrictedAccess && categories.some(
        category => category.roles.length > 0 || category.teams.length > 0);

    const participations = needsParticipationCheck
        ? await loadVolunteerParticipations(eventId, userId)
        : [];

    return categories
        .filter(category =>
            canAccessCategory(category.roles, category.teams, hasUnrestrictedAccess,
                participations))
        .map(category => ({
            description: category.description,
            icon: category.icon,
            id: category.id,
            limited: category.roles.length > 0 || category.teams.length > 0,
            questionCount: category.questionCount,
            title: category.title,
        }));
}

/**
 * Returns whether `userId` can access at least one Knowledge Base category in `eventId`.
 */
export async function hasKnowledgeBaseAccess(
    eventId: number, userId: number, hasUnrestrictedAccess: boolean): Promise<boolean>
{
    const categories =
        await getKnowledgeBaseCategories(eventId, userId, hasUnrestrictedAccess);
    return categories.length > 0;
}

/**
 * Loads a single non-empty Knowledge Base category and its visible FAQ questions for `eventId`.
 */
async function loadCachedKnowledgeCategory(
    eventId: number, categoryId: number): Promise<CachedKnowledgeCategoryDetail | null>
{
    'use cache';
    cacheLife('minutes');
    cacheTag('schedule-knowledge', `schedule-knowledge:${eventId}`);

    return await db.selectFrom(tContentCategories)
        .innerJoin(tContent)
            .on(tContent.contentType.equals(kContentType.FAQ))
                .and(tContent.contentCategoryId.equals(tContentCategories.categoryId))
                .and(tContent.revisionVisible.equals(/* true= */ 1))
        .where(tContentCategories.categoryId.equals(categoryId))
            .and(tContentCategories.eventId.equals(eventId))
            .and(tContentCategories.categoryDeleted.isNull())
        .select({
            description: tContentCategories.categoryDescription,
            icon: tContentCategories.categoryIcon,
            id: tContentCategories.categoryId,
            questions: db.aggregateAsArray({
                answer: tContent.content,
                id: tContent.contentPath,
                question: tContent.contentTitle,
            }),
            roles: tContentCategories.categoryRoles,
            teams: tContentCategories.categoryTeams,
            title: tContentCategories.categoryTitle,
        })
        .groupBy(tContentCategories.categoryId)
        .executeSelectNoneOrOne();
}

/**
 * Returns the requested Knowledge Base category and its alphabetically sorted questions if it
 * exists, has visible questions, and is accessible to `userId` in `eventId`.
 */
export const getKnowledgeBaseCategory = cache(
    async (
        eventId: number, categoryParam: string, userId: number, hasUnrestrictedAccess: boolean)
        : Promise<KnowledgeBaseCategoryDetail | undefined> =>
    {
        const categoryId = Number(categoryParam);
        if (!Number.isInteger(categoryId))
            return undefined;

        const category = await loadCachedKnowledgeCategory(eventId, categoryId);
        if (!category || !category.questions.length)
            return undefined;

        const limited = category.roles.length > 0 || category.teams.length > 0;
        const participations = limited && !hasUnrestrictedAccess
            ? await loadVolunteerParticipations(eventId, userId)
            : [];

        if (!canAccessCategory(
            category.roles, category.teams, hasUnrestrictedAccess, participations))
        {
            return undefined;
        }

        const questions = [ ...category.questions ]
            .sort((lhs, rhs) => lhs.question.localeCompare(rhs.question));

        return {
            description: category.description,
            icon: category.icon,
            id: category.id,
            limited,
            questions,
            title: category.title,
        };
    });

