# Checkpoint 2.16.10 Architecture: Persist Scroll with Auto-Jump

## Goal
Improve navigation continuity by persisting scroll positions across view changes and refining the "Auto-Focus" logic to ensure the user never loses their place in the benchmark table.

## Proposed Changes

### 1. Scroll Persistence
- **`AppStateService`**: Introduce `scrollPosition` to the global state, indexed by `DifficultyTier`.
- **`BenchmarkScrollController`**: Updated to capture the scroll offset before a view unmounts and restore it when that difficulty tier is re-selected.

### 2. Intelligent Auto-Jump
- **`FocusManagementService`**: Refined to handle "Intelligent Jumps". When a new score is detected, the system determines if the target scenario is already in view.
- **Scroll Logic**: If the scenario is outside the viewport, a smooth scroll is triggered. If it is already visible, the scroll is suppressed to avoid jarring movement, but the "pulse" highlight is still applied.

### 3. Font Weight Refinement
- **Typography**: Refine the typography of the Benchmark View to improve information hierarchy by adjusting font weights and sizes.
- **Weights**: 700 for Categories/Ranks, 600 for Subcategories, 500 for Scenarios, 400 for Headers/Progress.
- **Canvas**: `DotCloudCanvasRenderer` updated to use 400 weight for internal labels to reduce visual noise.

## Verification Plan
- Scroll halfway down the "Easier" list, switch to "Medium", then switch back to "Easier". Verify the scroll position is exactly where you left it.
- Trigger a new score for a scenario that is already visible on screen. Verify the table does not move, but the row highlights.
- Trigger a new score for a scenario that is off-screen. Verify the table scrolls smoothly to bring that scenario into view.
- Verify typography hierarchy matches the new weight specifications.
