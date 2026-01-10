```raw_output\roadmap\current checkpoint.md#L1-10
# Current Checkpoint: 2.16.11: Navigation Consolidation & Slider Polish

## Status
In Progress

## Deliverables
- [x] Rename benchmark CSVs to `Easier.csv`, `Medium.csv`, and `Harder.csv`.
- [x] Implement dynamic difficulty discovery based on file names in `src/data/benchmarks.ts`.
- [x] Update navigation selector to "Benchmarks" and "Not Soon" with unified styling.
- [x] Remove "Recent" and "New" views, components, and associated orchestration logic.
- [x] Align difficulty tab and navigation highlight colors with benchmark row states.
- [x] Refactor `updateTrackVisuals` to support logical indexing across external notches.
- [x] Implement conditional "glow" logic to keep deactivated notches dim.
- [x] Fix dot animation direction for left-notched sliders.
