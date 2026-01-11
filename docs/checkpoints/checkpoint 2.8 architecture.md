```raw_output\docs\checkpoints\phase 2\checkpoint 2.8 architecture.md#L1-94
# Checkpoint 2.8: Visualization & Fluid Typography Architecture

## Objective
This checkpoint integrates high-density performance visualization with a resolution-aware UI system. It introduces the "Dot Cloud" (Strip Plot) for scenario-specific performance analysis and a global fluid typography system to ensure legibility from 1080p to 4K.

## 1. Data Persistence & Ingestion Strategy
To support historical visualization, the `HistoryService` and `RunIngestionService` have been upgraded to track individual run data.

### IndexedDB Schema Evolution
- **Version**: 2
- **Store: `Scores`**:
  - `id`: Auto-incrementing primary key.
  - `scenarioName`: Indexed for fast retrieval.
  - `score`: Numerical result.
  - `timestamp`: Derived from CSV metadata.
- **Incremental Ingestion**: `Metadata` store tracks `lastCheck` to process only new CSVs.

## 2. Visualization Engine: `DotCloudComponent`
A Canvas-based renderer designed for performance and density, plotting the last 100 recorded runs.

### Rendering Logic
- **Strip Plot (Dot Cloud)**: Each run is plotted as a semi-transparent cyan dot (`rgba(0, 242, 255, 0.3)`). Overlapping dots create natural "color stacking" to highlight score density.
- **Vertical Jitter**: Random displacement prevents perfect horizontal alignment, making clusters easier to distinguish.
- **Asynchronous Loading**: Table cells render stable containers (150px x 24px) and populate dots as IndexedDB queries resolve.

### Scaling & Normalization
- **Score-Focused Scaling**: The visualization dynamically sets its X-axis bounds based on the user's actual performance range rather than fixed rank thresholds.
- **Segmented Linear Mapping**: Horizontal space is divided into segments based on rank thresholds. Even if rank intervals are unequal (e.g., 50 points vs 200 points), they occupy equal visual width to maintain focus on relative progress.

### Filtering & Contextual Anchoring
- **Temporal Outlier Filtering**: 
  1. Drops the bottom 5% of the last 100 runs.
  2. Sets the `minScore` bound to the worst run within the *most recent* 20 runs of that pool. This prevents historical "bad days" from compressing the scale of current performance.
- **Beyond-Rank Visibility**: If all scores are above the highest rank, that rank's notch is forced to the left edge (10% gutter) to provide a "floor" for comparison.
- **Multi-Rank Guarantee**: Logic ensures at least two rank notches are visible whenever possible, providing a "ladder" context for the dot spread.
- **10% Gutters**: Notches at the extreme left or right are padded by 15px to prevent labels from clipping and ensure visual breathing room.

## 3. Fluid Typography System
As UI density increases, fixed scaling fails across different resolutions. This system uses CSS `clamp()` to interpolate font sizes.

### Implementation
- **Base Scaling**: `:root` defines `--fluid-base-size` using a viewport-width-based formula:
  `font-size: clamp(min_size, preferred_vw, max_size)`
- **Target Resolutions**: Interpolation is tuned for optimal legibility between 1280px (minimum) and 2560px (maximum) viewport widths.
- **Component Integration**: 
  - **Vertical Labels**: Category text scales to prevent overflow in the benchmark table.
  - **Table Rows**: Heights and padding are derived from the fluid base size to maintain vertical rhythm.
  - **Action Elements**: Play buttons and badges scale proportionally to ensure they remain interactive without dominating the layout.

## Verification Plan
1. **Density Test**: Confirm that 100 runs correctly stack color in the Dot Cloud.
2. **Filtering Test**: Verify that a sudden skill improvement (20 high scores after 80 low scores) causes the visualization to "zoom in" on the new performance tier.
3. **Resolution Test**: Verify UI clarity at 1920x1080 and 3840x2160, ensuring vertical labels do not overlap.
4. **Boundary Test**: Confirm that extreme high-performance (beyond-rank) still renders the highest rank notch at the 10% horizontal mark.
