# External Documentation

## External Interactions Diagram

```mermaid
graph LR
    subgraph "src/services"
        SessionService
        RankedSessionService
        VisualSettingsService
    end

    subgraph "src/components"
        BenchmarkView
        RankedView
        UIComponents
    end

    subgraph "Browser Context"
        BrowserUI[Browser DOM]
    end
    
    %% Control Flow / Dependency Direction
    
    BenchmarkView -->|Reads| SessionService
    RankedView -->|Reads| SessionService
    RankedSessionService -->|Subscribes to| SessionService
    
    UIComponents -->|Observes| VisualSettingsService
    VisualSettingsService -->|Updates| BrowserUI
```

## Exposed Internal API

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

### `IdentityService`
Manages the user's "Identity" state, including their current rank and historical performance profile. It handles the persistence of this identity across sessions.
- **Relies on**: `HistoryService`
- **Used by**: `RankedSessionService`, `AppBootstrap`

### `HistoryService`
Manages the long-term storage and retrieval of past activity. It builds the historical context required for generating accurate rank estimates and trends.
- **Used by**: `IdentityService`, `RunIngestionService`, `BenchmarkService`

### `SessionSyncService`
Handles the synchronization of local session data with the Cloudflare Edge backend. It ensures that locally achieved scores are backed up to the cloud.
- **Relies on**: `CloudflareService`
- **Used by**: `SessionService`

### `AudioService`
Manages sound effects and audio feedback throughout the application.
- **Relies on**: `VisualSettingsService` (for volume/mute preferences)

# Internal Documentation

## Internal Interactions Diagram

```mermaid
graph TD
    subgraph "src/services"
        SessionService
        RankedSessionService
        RunIngestionService
        IdentityService
        HistoryService
        SessionSyncService
        DirectoryAccessService
    end

    RankedSessionService -->|Reads| SessionService
    RunIngestionService -->|Writes| SessionService
    SessionService -->|Syncs via| SessionSyncService
    
    IdentityService -->|Queries| HistoryService
    RunIngestionService -->|Queries| HistoryService
    RunIngestionService -->|Uses| DirectoryAccessService
```

## Internal Files and API

The `RankedSessionService` listens for updates from the `SessionService`. When new scores are recorded, the `RankedSessionService` resets its internal run timer. It ensures that the `RankedView` only shows improvements made within the context of an active ranked run.
