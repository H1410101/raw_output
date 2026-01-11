# Checkpoint 2.10 Architecture: Visual Settings Wiring

## Architecture

### 1. Visual Settings Service
A new `VisualSettingsService` manages the state of user preferences. It uses the Observer pattern to notify UI components of changes and handles persistence via `localStorage`.

```typescript
  interface VisualSettings {
    // Visualization
    showDotCloud: boolean;
    dotOpacity: number;
    scalingMode: "Aligned" | "Floating";
    dotSize: "Small" | "Medium" | "Large";
    dotJitter: boolean;
    showGridLines: boolean;
    highlightRecent: boolean;

    // Layout
    rowHeight: "Compact" | "Normal" | "Spacious";
    showSessionBest: boolean;
    showRankBadges: boolean;
  }
  ```

### 2. Benchmark View Integration
The `BenchmarkView` acts as the primary subscriber to the `VisualSettingsService`.

- **Initialization**: Instantiates the service and subscribes to updates.
- **Reactivity**: On setting change, it triggers a full `render()` (or targeted update) to reflect the new state immediately.
- **UI wiring**: 
  - The settings menu generation logic now accepts callbacks or uses the service directly to update state.
  - Toggles, Sliders, and Segmented Controls are two-way bound to the service state.

### 3. Dot Cloud Component Enhancements
The `DotCloudComponent` is updated to accept `VisualSettings` as a dependency.

- **Visibility**: If `showDotCloud` is false, `BenchmarkView` skips rendering the component entirely (or renders an empty container).
- **Opacity**: The canvas rendering context uses `dotOpacity` to adjust `fillStyle` and `strokeStyle`.
- **Scaling Logic**:
  - **Floating (Default)**: Existing logic. Bounds are calculated based on the min/max of the recent dataset, ensuring the visualization always fills the width.
  - **Aligned**: New logic. Bounds are locked to the integer Rank Units (e.g., Rank 3.2 to 4.5 becomes 3.0 to 5.0). This provides a stable frame of reference where the "goal posts" don't move, but the dots might be clustered in a small section of the canvas.
- **Dot Size**: Configurable radius for performance dots.
- **Jitter**: Optional vertical randomization to reduce dot overlap.
- **Grid Lines**: Optional vertical lines at rank thresholds.
- **Highlight Recent**: Special styling (brightness/shadow) for the most recent run in the dataset.

### 4. Layout Customization
The `BenchmarkView` uses CSS classes and conditional rendering to respect layout settings:

- **Row Height**: Toggles classes `.row-height-compact`, `.row-height-normal`, etc.
- **Column Visibility**: Conditionally appends columns (e.g., Session Best, Rank Badge) to the DOM based on flags.

## Data Flow
1. **User Action**: User adjusts the "Dot Opacity" slider in the UI.
2. **Event**: The input listener calls `VisualSettingsService.updateSetting('dotOpacity', 50)`.
3. **Persistence**: Service saves `{ ...settings, dotOpacity: 50 }` to `localStorage`.
4. **Notification**: Service notifies subscribers (BenchmarkView).
5. **Re-render**: `BenchmarkView` calls `render()`.
6. **Visualization**: `DotCloudComponent` is instantiated with the new opacity and redraws the canvas.

## Technical Decisions
- **Service vs. Prop Drilling**: Given that visual settings might eventually affect multiple views (e.g., a future "Analysis" page), a service is preferred over managing state purely within `BenchmarkView`.
- **Canvas Re-creation**: For this checkpoint, changing settings triggers a re-creation of the canvas. This is acceptable performance-wise because the number of visible rows is limited and the operation is cheap. In the future, we could optimize this to just re-paint the existing context if needed.