# Checkpoint 2.6 Architecture: Live Session Best

The Live Session Best feature provides real-time performance feedback by tracking and displaying the highest rank achieved within a contiguous training session, alongside historical bests.

## Data Structures

### SessionRankRecord
Located in `SessionService.ts`, this interface tracks the best performance for a specific scenario within the current session.
- `scenarioName`: string
- `bestScore`: number
- `rankResult`: RankResult

## Component Interactions

### SessionService
The `SessionService` maintains the state of the current session.
- **Session Definition**: A session is defined as a series of runs where consecutive runs are no longer than 10 minutes apart.
- **`registerRun(...)`**: Updates the session timestamp and checks if the new score exceeds the current `SessionRankRecord` for that scenario.
- **`getScenarioSessionBest(scenarioName)`**: Returns the current session record for a specific scenario.
- **Reactivity**: Implements an observer pattern via `onSessionUpdated` to notify UI components of changes.

### BenchmarkView
The `BenchmarkView` renders the session data within the benchmark table.
- **Subscription**: Listens to `onSessionUpdated` and `onHighscoreUpdated` to trigger re-renders.
- **Table Layout**: The `_createScenarioRow` method renders two distinct rank columns within the `row-right-content` container:
    1. **Session Best**: Displays the highest rank achieved in the current session. If no runs have been recorded this session, the column remains empty. Uses a unique CSS class (`session-badge`) for visual distinction.
    2. **All-time Best**: Displays the historical highscore rank retrieved from `HistoryService`.

## UI/UX Specifications

### Layout
- **Visual Hierarchy**: The "All-time" badge maintains full opacity, while the "Session" badge is styled to be secondary but clearly visible.
- **Contextual Labels**: Each badge includes a small `badge-label` ("Session" or "All-time") to clarify the data source.
- **Real-time Reactivity**: As the user finishes a run in Kovaak's, the `DirectoryMonitoringService` triggers the `RunIngestionService`, which updates both the `HistoryService` and `SessionService`. The `BenchmarkView` reacts instantly, updating the badges without a page refresh.

## Data Flow
1. **File Detection**: `DirectoryMonitoringService` detects a new CSV.
2. **Ingestion**: `RunIngestionService` parses the file and notifies services.
3. **Session Update**: `SessionService` updates the session window and checks for new session bests.
4. **History Update**: `HistoryService` checks for new all-time highscores.
5. **UI Refresh**: `BenchmarkView` receives the update event and re-renders the affected scenario rows with updated badges.