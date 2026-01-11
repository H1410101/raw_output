# Checkpoint 2.7 Architecture: New Runs View

The "New Runs" view provides a focused perspective on the current training session, filtering out historical data to show only what has been achieved since the application was opened or within the active contiguous session.

## Data Filtering Logic

The `RunIngestionService` has been extended to support specific "New Run" criteria, distinguishing it from the standard "Recent Runs" view which simply shows the last 10 entries.

### Filter Criteria
A run is included in the "New Runs" view if it meets either of the following conditions:
1.  **Session Membership**: The run is part of the latest contiguous session (runs with gaps no larger than 10 minutes).
2.  **Application Lifetime**: The run was completed after the current application instance was initialized (`_appStartTime`).

### Implementation
- `_appStartTime`: A private timestamp captured when `RunIngestionService` is instantiated.
- `getNewRuns()`: A new method that retrieves all directory files, identifies the current session via `SessionService` logic, and filters handles based on the union of session timestamps and the application start time.

## UI Components & Integration

### RecentRunsDisplay Reuse
The existing `RecentRunsDisplay` component is utilized for the "New Runs" view, maintaining visual consistency. It handles:
- Rendering the list of `KovaaksChallengeRun` objects.
- Formatting dates and scores.
- Applying difficulty-based styling.

### DOM Structure
- `nav-new`: A new navigation button in the header.
- `view-new`: A dedicated section in the main dashboard panel, initially hidden.
- `new-runs-list`: The UL element where the `NewRunsDisplay` instance mounts its items.

## Orchestration

The `main.ts` entry point coordinates the synchronization of both views:
1.  **Initialization**: Upon directory link or reconnection, both `synchronizeAvailableRuns()` (for Recent) and `getNewRuns()` (for New) are called.
2.  **Monitoring**: The `DirectoryMonitoringService` callback now triggers updates for both display instances whenever a file change is detected.
3.  **Navigation**: The `setupNavigation` helper manages the visibility of the new view and ensures data is refreshed when switching to the "New Runs" tab.