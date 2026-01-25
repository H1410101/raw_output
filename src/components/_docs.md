# External Documentation

## External Interactions Diagram

```mermaid
graph LR
    subgraph "src/components"
        NavigationController
        RankedView
        BenchmarkView
    end

    subgraph "src/services"
        SessionService
        RankedSessionService
    end

    NavigationController -->|Switches| RankedView
    NavigationController -->|Switches| BenchmarkView
    
    RankedView -->|Consumes| RankedSessionService
    BenchmarkView -->|Consumes| SessionService
```

## Exposed Internal API

### `RankedView`
The core terminal-style interface for the "Ranked Run" experience. It manages the sequence of scenarios, the timer, and the final session summary.
- **Relies on**: `RankedSessionService`, `RankTimelineComponent`, `NavigationController`

### `BenchmarkView`
The dashboard interface showing historical performance across all scenarios.
- **Relies on**: `SessionService`, `BenchmarkService`, `BenchmarkTable`

### `NavigationController`
Manages the transitions between different views (e.g., from Benchmark to Ranked).

### `MobileLandingView`
The initial landing screen for mobile users, directing them to desktop for the full experience or providing limited mobile functionality.

# Internal Documentation

## Internal Interactions Diagram

```mermaid
graph TD
    subgraph "src/components"
        RankedView
        BenchmarkView
        MobileLandingView
    end

    subgraph "src/components/visualizations"
        RankTimelineComponent
    end

    subgraph "src/components/benchmark"
        BenchmarkTable
    end

    subgraph "src/components/ui"
        Elements[UI Primitives]
    end

    RankedView -->|Embeds| RankTimelineComponent
    BenchmarkView -->|Embeds| BenchmarkTable
    
    RankedView -->|Uses| Elements
    BenchmarkView -->|Uses| Elements
    MobileLandingView -->|Uses| Elements
```

## Internal Files and API

- `benchmark/`: Specific components for the benchmark table and scenario lists.
- `ui/`: Reusable primitive UI components like buttons, tooltips, and layouts.
- `visualizations/`: Specialized data visualization components (see `visualizations/_docs.md`).
