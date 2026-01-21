# Components Documentation

This directory contains the primary UI views and high-level controllers of the application.

## Main Views

### `RankedView`
The core terminal-style interface for the "Ranked Run" experience. It manages the sequence of scenarios, the timer, and the final session summary.
- **Relies on**: `RankedSessionService`, `RankTimelineComponent`, `NavigationController`

### `BenchmarkView`
The dashboard interface showing historical performance across all scenarios.
- **Relies on**: `SessionService`, `BenchmarkService`, `BenchmarkTable`

### `NavigationController`
Manages the transitions between different views (e.g., from Benchmark to Ranked).

## Subdirectories

- `benchmark/`: Specific components for the benchmark table and scenario lists.
- `ui/`: Reusable primitive UI components like buttons, tooltips, and layouts.
- `visualizations/`: Specialized data visualization components (see `visualizations/_docs.md`).

## Relationships

```mermaid
graph TD
    NavigationController -->|switches| RankedView
    NavigationController -->|switches| BenchmarkView
    RankedView -->|embeds| RankTimelineComponent
    BenchmarkView -->|embeds| BenchmarkTable
```
