```raw_output\docs\checkpoints\phase 2\checkpoint 2.16.13 architecture.md#L1-17
# Checkpoint 2.16.13 Architecture: Visual Rounding Consistency

## Purpose
Standardize the visual rounding (border-radius) across major UI components, using the benchmark table as the source of truth for container corner radii.

## Visual Standards
- **Source of Truth**: The `.benchmark-table-container` uses a `border-radius` of `1rem`.
- **Target Component**: The `.settings-menu-container` currently uses `1.5rem`, which creates a visual mismatch.

## Technical Changes
- Update `.settings-menu-container` to use `border-radius: 1rem`.
- Review `.settings-overlay` (currently `1.25rem`) to ensure it aligns with the containment strategy or matches the primary container radius.
- Verify that internal layout elements (like scroll track backgrounds or card groups) do not conflict with the tighter corner radius.
