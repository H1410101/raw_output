# Checkpoint 2.16.6 Architecture: Stable Dot Cloud

## Responsibility
Enhance the visual quality and stability of the Dot Cloud visualization by ensuring that high-priority information (the latest score) is always visible and that visual jitter remains stable across re-renders.

## Technical Components

### 1. Reverse Layer Rendering
- **Logic**: Updated the rendering loop in `DotCloudCanvasRenderer.drawPerformanceDots` to iterate through the score array in reverse order (`for` loop from `length - 1` to `0`).
- **Purpose**: Since the score array is sorted with the most recent entries at the beginning (index 0), rendering in reverse ensures that index 0 is drawn last, placing it on the highest visual layer.

### 2. Temporal Jitter Seeding
- **Logic**: Replaced the use of the array index as the seed for `_seededRandom` with the `timestamp` of the score entry.
- **Data Flow**:
    - `DotCloudComponent` extracts `timestamps` from `ScoreEntry` during the `RenderContext` assembly.
    - `DotCloudCanvasRenderer` utilizes these timestamps in `_calculateVerticalJitter`.
- **Purpose**: Prevents "shuffling" or "dancing" dots when the data window shifts (e.g., when a new run is added and indices change). Using the play time ensures the vertical offset for a specific score remains identical as long as that score is visible.

### 3. Render Context Extension
- **Update**: `RenderContext` interface now includes a `timestamps: number[]` field to support the new seeding logic.

## Constraints
- The `ScoreProcessor` must preserve timestamps for all processed entries.
- If a timestamp is missing (fallback), the logic reverts to index-based seeding to prevent rendering errors.
- Reverse rendering must be performed manually to maintain performance and avoid unnecessary array mutations like `reverse()`.
