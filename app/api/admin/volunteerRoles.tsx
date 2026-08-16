// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { z } from 'zod/v4';

import type { ActionProps } from '../Action';
import type { ApiDefinition, ApiRequest, ApiResponse } from '../Types';
import { RecordLog, kLogSeverity, kLogType } from '@lib/Log';
import { executeAccessCheck } from '@lib/auth/AuthenticationContext';
import db, { tRoles, tTeamsRoles, tUsersEvents } from '@lib/database';

/**
 * Interface definition for the Volunteer API, exposed through /api/admin/volunteer-roles.
 */
export const kVolunteerRolesDefinition = z.object({
    request: z.object({
        /**
         * For updating: ID of the event for which the role should be updated.
         */
        eventId: z.number().optional(),

        /**
         * URL-safe slug of the event for which the role should be updated.
         */
        event: z.string(),

        /**
         * For updating: ID of the role that the user should be updated to.
         */
        roleId: z.number().optional(),

        /**
         * For retrieval: ID of team for which roles are being requested.
         */
        teamId: z.number(),

        /**
         * For updating: ID of the user for whom the role should be updated.
         */
        userId: z.number().optional(),
    }),
    response: z.strictObject({
        /**
         * For retrieval: List of the roles that are available for this team.
         */
        roles: z.array(z.strictObject({
            /**
             * ID of the role represented by this entry.
             */
            roleId: z.number(),

            /**
             * Name of the role, as it should be presented.
             */
            roleName: z.string(),

            /**
             * Whether a warning should be shown that this roles comes with certain privileges in
             * the Volunteer Manager. This may be a great mechanism for people to self-promote.
             */
            rolePrivilegeWarning: z.boolean(),

        })).optional(),

        /**
         * Whether the API call was able to execute successfully.
         */
        success: z.boolean(),
    }),
});

export type VolunteerRolesDefinition = ApiDefinition<typeof kVolunteerRolesDefinition>;

type Request = ApiRequest<typeof kVolunteerRolesDefinition>;
type Response = ApiResponse<typeof kVolunteerRolesDefinition>;

/**
 * API that allows to read and write to the roles that can be assigned to a particular volunteer
 * during a particular event. As such, this API serves multiple purposes.
 */
export async function volunteerRoles(request: Request, props: ActionProps): Promise<Response> {
    executeAccessCheck(props.authenticationContext, {
        permission: 'event.volunteers.participation',
        scope: {
            event: request.event,
        },
    });

    const roles = await db.selectFrom(tTeamsRoles)
        .innerJoin(tRoles)
            .on(tRoles.roleId.equals(tTeamsRoles.roleId))
        .where(tTeamsRoles.teamId.equals(request.teamId))
        .select({
            roleId: tRoles.roleId,
            roleName: tRoles.roleName,
            rolePrivilegeWarning: tRoles.rolePermissionGrant.isNotNull(),
        })
        .orderBy(tRoles.roleOrder, 'desc')
        .executeSelectMany();

    if (request.eventId && request.roleId && request.userId) {
        let assignedRoleName: string | undefined;

        // Validate that `request.roleId` is part of the valid `roles`. Abort the request when this
        // is not the case, as we don't want people abusing our APIs.
        for (const { roleId, roleName } of roles) {
            if (roleId !== request.roleId)
                continue;

            assignedRoleName = roleName;
            break;
        }

        if (!assignedRoleName)
            return { success: false };

        const affectedRows = await db.update(tUsersEvents)
            .set({ roleId: request.roleId })
            .where(tUsersEvents.eventId.equals(request.eventId))
                .and(tUsersEvents.userId.equals(request.userId))
                .and(tUsersEvents.teamId.equals(request.teamId))
            .executeUpdate(/* min= */ 0, /* max= */ 1);

        if (affectedRows > 0) {
            RecordLog({
                type: kLogType.AdminEventRoleUpdate,
                severity: kLogSeverity.Warning,
                sourceUser: props.user,
                targetUser: request.userId,
                data: {
                    eventId: request.eventId,
                    teamId: request.teamId,
                    role: assignedRoleName,
                    ip: props.ip
                }
            });
        }

        return { success: !!affectedRows };
    }

    return { roles, success: true };
}
