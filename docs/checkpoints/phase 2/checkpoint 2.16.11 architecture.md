```/dev/null/checkpoint 2.16.11 architecture.md#L1-26
# Checkpoint 2.16.11 Architecture: Font Weight Refinement

## Goal
Refine the typography of the Benchmark View to improve information hierarchy by adjusting font weights and sizes for key elements.

## Proposed Changes

### 1. Typography Adjustments in `index.html`
- **Category & Ranks**: Update `.category-label .vertical-text` and `.rank-name` to `font-weight: 700`.
- **Subcategory**: Update `.subcategory-label .vertical-text` to `font-weight: 600`.
- **Scenario Names**: Update `.scenario-name` to `font-weight: 500`.
- **Headers & Progress**: Update `.column-header` and `.rank-progress` (including `+x%` labels) to `font-weight: 400`.
- **Difficulty Text**: Update `.tab-button` to `font-size: 1rem` (base), `font-weight: 600`, and `font-family: "Nunito"`.

### 2. Canvas Typography Adjustments
- **Dot Cloud Rank Labels**: Update `DotCloudCanvasRenderer` to use `400` weight and `Nunito` font for labels rendered within the visualization.

## Verification Plan
- Inspect the Benchmark table and verify that:
    - Vertical category labels and rank names (e.g., "Diamond") are boldest (700).
    - Subcategory labels are clearly defined (600).
    - Scenario names have medium weight (500).
    - Column headers and progress percentages are lighter (400).
    - Difficulty tabs (Easier, Medium, Harder) are larger, prominent, and use the **Nunito** font.
    - Rank labels within the dot cloud (e.g., Gold, Platinum) use **Nunito** at **400** weight.
- Ensure fluid typography `clamp()` or `var(--master-scale)` multipliers still apply correctly on top of these base weights and sizes.
