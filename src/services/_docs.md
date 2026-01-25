# Services Documentation

The `services` folder contains the core business logic of the application. These services are responsible for managing state, processing data, and orchestrating interactions between different components.

## Core Services

### `SessionService`
Manages the lifecycle of a training session. It maintains dual tracks: a **Global Track** for all runs in the current session window, and a **Ranked Track** for data recorded specifically during high-stakes ranked runs.
- **Relies on**: `RankService`, `SessionSettingsService`
- **Used by**: `RankedSessionService`, `RunIngestionService`

### `DirectoryAccessService`
Manages interaction with the Browser File System Access API. It handles folder selection, persistence of directory handles across sessions, and verification of read permissions.
- **Persistence**: Uses IndexedDB to store `FileSystemDirectoryHandle` objects.
- **Used by**: `AppBootstrap`, `RunIngestionService`, `DirectoryMonitoringService`.

### `RunIngestionService`
Orchestrates the ingestion of CSV performance data from the local file system. It detects new runs and populates them into both the Global and Ranked tracks of `SessionService` as appropriate.
- **Relies on**: `DirectoryAccessService`, `KovaaksCsvParsingService`, `HistoryService`, `SessionService`, `BenchmarkService`

### `RankedSessionService`
Manages the "Ranked Run" experience, which includes a guided sequence of scenarios and a timed session. It consumes data exclusively from the Ranked track of `SessionService`.
- **Persistence**: Automatically persists session state per difficulty to `localStorage`. This allows for same-day resumption, switching between difficulties without losing progress, and maintaining consistent daily targets (initial ranks) for fair rank evolution scoring.
- **Relies on**: `BenchmarkService`, `SessionService`, `RankEstimator`, `SessionSettingsService`

### `RankEstimator`
Calculates holographic rank estimates across scenarios and manages the "Rank Identity" state. It implements rank evolution logic (EMA) and daily rank penalties (0.05 RU/day).
- **Relies on**: `BenchmarkService`
- **Used by**: `RankedSessionService`, `AppBootstrap`

### `VisualSettingsService`
Manages and persists visual preferences and display settings. It orchestrates theme transitions and synchronizes browser UI elements (e.g., `theme-color`) with the current application palette.
- **Relies on**: `ScalingService`
- **Used by**: `AppBootstrap`, `AudioService`, and most UI components.

## Relationships

```mermaid
graph TD
    RunIngestionService -->|updates runs| SessionService
    SessionService -->|Global Track| BenchmarkView
    SessionService -->|Ranked Track| RankedView
    SessionService -->|notifies| RankedSessionService
    VisualSettingsService -->|orchestrates| UIComponents
    VisualSettingsService -->|manages| BrowserUI
```

The `RankedSessionService` listens for updates from the `SessionService`. When new scores are recorded, the `RankedSessionService` resets its internal run timer. It ensures that the `RankedView` only shows improvements made within the context of an active ranked run.
