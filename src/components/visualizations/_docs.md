# Visualizations Documentation

This directory contains specialized UI components for data visualization, specifically focused on performance metrics and rank progression.

## Components

### `RankTimelineComponent`
A visualization of where a score or set of scores sits on a rank timeline. It shows historical "Achieved" marks, "Target" marks, and individual attempts.
- **Inputs**: `RankTimelineConfiguration` (thresholds, achieved/target/expected/attempts RU, visual settings)
- **Features**: 
    - **60% Window**: A clearly visible central area (20-80% of width) for focus.
    - **Dynamic Scroll Algorithm**: Symmetrical centering for target/highscore, or edge-alignment fallbacks.
    - **Dynamic Carets**: Labelled notches automatically transition to caret versions when outside the active Window, even during animations.
    - **Collision Resolution**: Shifting overlapping labels to ensure readability.

### `DotCloudComponent`
A complex visualization of many score attempts over time or across scenarios. It uses HTML-based rendering for improved debuggability and accessibility.
- **Relies on**: `DotCloudHtmlRenderer`, `ScoreProcessor`

### `RankScaleMapper`
A utility for mapping raw scores to a linear "Rank Unit" (RU) scale. This allows consistent spacing on a timeline regardless of non-linear threshold values.

### `ScoreProcessor`
A utility for preparing and filtering raw run data for visualization.

## Relationships

```mermaid
graph TD
    RankTimelineComponent -->|uses| RankScaleMapper
    DotCloudComponent -->|uses| DotCloudHtmlRenderer
    DotCloudComponent -->|uses| ScoreProcessor
```

```mermaid
graph LR
    RankedView -->|configures| RankTimelineComponent
    BenchmarkView -->|configures| DotCloudComponent
```

The `RankTimelineComponent` is primarily used by the `RankedView` to show progression during a ranked session. It depends on `RankScaleMapper` to translate game scores into a linear visual space.
