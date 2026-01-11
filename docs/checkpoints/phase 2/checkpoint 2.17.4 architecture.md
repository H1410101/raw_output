```raw_output\docs\checkpoints\phase 2\checkpoint 2.17.4 architecture.md#L1-100
# Checkpoint 2.17.4 Architecture: Advanced Rank Visualization & Data Refinement

This checkpoint consolidates the implementation of the "All-Rank" performance display, interactive UX refinements for popup stability, and the standardization of benchmark data.

## 1. Visual Components & Interactivity

### Rank Popup (`RankPopupComponent`)
A new component responsible for rendering the vertical list of ranks.
- **Trigger**: Hovering over the active difficulty tab or clicking a "caret" icon on the selected benchmark row.
- **Structure**: A vertical stack of rank entries, showing rank names and their required scores.
- **Styling**: 
    - Glass aesthetic matching the settings menu (`backdrop-filter: blur(2rem)`).
    - Connected to the "trigger" via a "tab-like" visual attachment.
    - No scrollbars (content should fit or be reasonably sized).

### Hover Interaction & Animation
- **SVG Caret**: A downward-pointing "v" shape that fades in and slides up from the bottom when a selected benchmark row is hovered.
- **Blur Effect**: When the popup is active, a subtle blur (`backdrop-filter`) is applied to the rest of the application to focus the user's attention.

### Interactive Caret Hover & Precision Dismissal
To ensure the popup is accessible and stable, the following logic is implemented:
- **The Hover Bridge**: An invisible element that spans the gap between the trigger (Tab/Row) and the popup, preventing premature dismissal during mouse transit.
- **Unified Hit-Testing**: Dismissal occurs only when the mouse leaves the combined boundary of the Trigger, Caret, Hover Bridge, and Popup.
- **Terminology Standardization**: All internal and CSS references use "caret" instead of "carrot".

## 2. Integration Points

### `BenchmarkRowRenderer`
- Update `renderRow` to include the SVG caret container.
- Add event listeners for hover states to trigger caret visibility.
- Add click listener to the caret/badge area to toggle the `RankPopupComponent`.

### `BenchmarkView`
- Manage the global blur state.
- Handle the positioning of the popup relative to the viewport/row.

## 3. Data Refinement & Cleanup

### Benchmark CSV Standardization
To ensure the application only displays standardized rank thresholds, individual player highscore columns are removed from the source data.
- **Affected Files**: `benchmarks/Easier.csv`, `benchmarks/Medium.csv`, and `benchmarks/Harder.csv`.
- **Target Columns**: "Viscose" and "Misscolourz".
- **Dynamic Scaling**: The `BenchmarkScenario` parsing logic remains dynamic, automatically adjusting UI elements (Rank Tags, Dot Cloud horizontal scale, and Rank Popups) based on the reduced column count.

## 4. CSS Additions (`index.html`)
- Animations for the caret (`caretFadeInUp`).
- Styles for the glass popup container and rank items.
- Global blur class for background focus.
- Hover bridge positioning and pointer-event management.
