// Copyright 2023 Peter Beverloo & AnimeCon. All rights reserved.
// Use of this source code is governed by a MIT license that can be found in the LICENSE file.

import { UsersTable } from './scheme/UsersTable';

export { tActivities } from './scheme/ActivitiesTable';
export { tActivitiesAreas } from './scheme/ActivitiesAreasTable';
export { tActivitiesLocations } from './scheme/ActivitiesLocationsTable';
export { tActivitiesLogs } from './scheme/ActivitiesLogsTable';
export { tActivitiesTimeslots } from './scheme/ActivitiesTimeslotsTable';
export { tContentCategory as tContentCategories } from './scheme/ContentCategoryTable';  // fixme
export { tContent } from './scheme/ContentTable';
export { tDisplays } from './scheme/DisplaysTable';
export { tDisplaysRequests } from './scheme/DisplaysRequestsTable';
export { tEnvironments } from './scheme/EnvironmentsTable';
export { tErrorLogs } from './scheme/ErrorLogsTable';
export { tEvents } from './scheme/EventsTable';
export { tEventsDates } from './scheme/EventsDatesTable';
export { tEventsSalesConfiguration } from './scheme/EventsSalesConfigurationTable';
export { tEventsSales } from './scheme/EventsSalesTable';
export { tEventsTeams } from './scheme/EventsTeamsTable';
export { tExports } from './scheme/ExportsTable';
export { tExportsLogs } from './scheme/ExportsLogsTable';
export { tFeedback } from './scheme/FeedbackTable';
export { tHotels } from './scheme/HotelsTable';
export { tHotelsAssignments } from './scheme/HotelsAssignmentsTable';
export { tHotelsBookings } from './scheme/HotelsBookingsTable';
export { tHotelsPreferences } from './scheme/HotelsPreferencesTable';
export { tLogs } from './scheme/LogsTable';
export { tNardo } from './scheme/NardoTable';
export { tNardoPersonalised } from './scheme/NardoPersonalisedTable';
export { tOutboxEmail } from './scheme/OutboxEmailTable';
export { tOutboxTwilio } from './scheme/OutboxTwilioTable';
export { tRefunds } from './scheme/RefundsTable';
export { tRetention } from './scheme/RetentionTable';
export { tRoles } from './scheme/RolesTable';
export { tScheduleLogs } from './scheme/ScheduleLogsTable';
export { tSchedule } from './scheme/ScheduleTable';
export { tSettings } from './scheme/SettingsTable';
export { tShiftsCategories } from './scheme/ShiftsCategoriesTable';
export { tShifts } from './scheme/ShiftsTable';
export { tStorage } from './scheme/StorageTable';
export { tSubscriptions } from './scheme/SubscriptionsTable';
export { tSubscriptionsPublications } from './scheme/SubscriptionsPublicationsTable';
export { tTasks } from './scheme/TasksTable';
export { tTeamsRoles } from './scheme/TeamsRolesTable';
export { tTeams } from './scheme/TeamsTable';
export { tTrainings } from './scheme/TrainingsTable';
export { tTrainingsAssignments } from './scheme/TrainingsAssignmentsTable';
export { tTrainingsExtra } from './scheme/TrainingsExtraTable';
export { tTwilioWebhookCalls } from './scheme/TwilioWebhookCallsTable';
export { tUsersAuth } from './scheme/UsersAuthTable';
export { tUsersEvents } from './scheme/UsersEventsTable';
export { tUsersEventsFavourites } from './scheme/UsersEventsFavouritesTable';
export { tUsersPasskeys } from './scheme/UsersPasskeysTable';
export { tUsersSettings } from './scheme/UsersSettingsTable';
export { tVendorsSchedule } from './scheme/VendorsScheduleTable';
export { tVendors } from './scheme/VendorsTable';

export const tUsers = new class extends UsersTable {
    name = this.displayName.valueWhenNull(this.firstName.concat(' ').concat(this.lastName));
};

// Export the database connection pool as the default export from this file, for convenient access
// to the database throughout the server-side of the Volunteer Manager.
export { globalConnection as default } from './Connection';
