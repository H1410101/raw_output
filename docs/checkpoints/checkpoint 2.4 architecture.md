# Checkpoint 2.4: Rank Tags - Architecture

## Data Management Layer

### RankService
A new utility service, `RankService`, has been introduced to handle the mathematical determination of rank attainment. 
- **Logic**: It performs a binary search (or sorted iteration) through scenario thresholds to identify the current rank.
- **Progress Calculation**: It calculates the percentage progress toward the next rank using linear interpolation between the current and next threshold.
- **Data Model**: Returns a `RankResult` containing `currentRank`, `nextRank`, and `progressPercentage`.

### HistoryService
To make the benchmark table meaningful, `HistoryService` manages the persistence of user performance data.
- **IndexedDB Persistence**: Highscores for every scenario are stored in a dedicated `RawOutputHistory` database.
- **State Management**: On every new CSV ingestion (either via manual scan or real-time monitoring), the `HistoryService` checks if the score is a new personal best and updates the store accordingly.

## UI Components

### Benchmark Table Integration
The `BenchmarkView` has been upgraded to be asynchronous, allowing it to fetch highscores before rendering rows.
- **Batch Retrieval**: The view requests highscores for all scenarios in the active difficulty category in a single batch operation to minimize DB hits.
- **Rank Badges**: A new `_createRankBadge` helper generates a visual indicator of the user's progress. 
    - **States**:
        - `Unranked`: Displayed if no score is found in history.
        - `Ranked`: Displays the rank name (e.g., "Jade") and the progress percentage (e.g., "+50%").

## Styling & Tokens

### Rank Badge System
New CSS classes define the visual identity of the rank indicator:
- **`.rank-name`**: Uses the theme's accent color and bold weights to emphasize the tier achievement.
- **`.rank-progress`**: A subtle secondary label showing the distance to the next tier.
- **`.unranked-text`**: Low-contrast text for scenarios without recorded data, reducing visual noise.

## Integration Flow
1. **Ingestion**: New CSV detected -> `HistoryService` updates DB.
2. **Navigation**: User clicks "Benchmarks" -> `BenchmarkView` renders.
3. **Data Fetch**: `BenchmarkView` calls `HistoryService` for highscores.
4. **Logic**: `BenchmarkView` calls `RankService` to determine badges for each row.
5. **Render**: Table displays rows with calculated ranks.
