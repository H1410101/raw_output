```raw_output\docs\checkpoints\phase 2\checkpoint 2.17.4 architecture.md#L1-32
# Checkpoint 2.17.4: Dynamic Vertical Label Sizing Architecture

## Problem Statement
The current implementation of `.vertical-label-container` uses a fixed `min-width` and absolute positioning for the `.vertical-text`. This causes the text to overlap or overflow if it is wider than the container's fixed constraints, as the container does not calculate its width based on the rendered height of the vertical text.

## Proposed Solution
We will transition from absolute positioning to a flexbox-based layout combined with proper `writing-mode` handling. This allows the browser's layout engine to treat the vertical text as an in-flow element, naturally expanding the container's width to accommodate the text's block-size (which becomes its width in vertical mode).

### CSS Refinement
1.  **Remove Absolute Positioning**: Remove `position: absolute`, `top`, `left`, and `transform: translate(-50%, -50%)` from `.vertical-text`.
2.  **Container Alignment**: Update `.vertical-label-container` to use `display: flex`, `align-items: center`, and `justify-content: center`.
3.  **Dimension Handling**:
    *   Remove `min-width` from `.vertical-label-container` and `.category-label` to allow dynamic expansion.
    *   The `writing-mode: vertical-rl` on the child already makes the text flow vertically.
    *   The `rotate(180deg)` will be maintained to ensure the text reads from bottom to top (if desired, or adjusted for standard vertical reading).

### Expected Outcome
The `vertical-label-container` will automatically expand its width to fit the widest part of the `.vertical-text`, ensuring that long category names or larger font sizes (due to scaling) do not cause visual regressions or overlaps.

## Verification Plan
1.  **Visual Inspection**: Check the benchmark table to ensure category and subcategory labels are centered and the container width matches the text width plus padding.
2.  **Scaling Test**: Adjust the `--label-font-multiplier` and verify the container scales its width accordingly.
3.  **Content Test**: Inject a long category name to verify the column widens to accommodate it.
