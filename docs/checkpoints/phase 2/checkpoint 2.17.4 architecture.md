# Checkpoint 2.17.4: Dynamic Vertical Label Sizing Architecture

## Problem Statement
The current implementation of `.vertical-label-container` uses a fixed `min-width` and absolute positioning for the `.vertical-text`. This causes the text to overlap or overflow if it is wider than the container's fixed constraints, as the container does not calculate its width based on the rendered height of the vertical text.

## Proposed Solution
We will transition from absolute positioning to a flexbox-based layout combined with proper `writing-mode` handling. This allows the browser's layout engine to treat the vertical text as an in-flow element, naturally expanding the container's width to accommodate the text's block-size (which becomes its width in vertical mode).

### CSS Refinement
1.  **Flexible Containers**: Transition `.vertical-label-container` to `display: flex` with `align-items: flex-start` to support both dynamic width and sticky positioning.
2.  **Sticky Positioning**: Restore `BenchmarkLabelPositioner` logic, using `position: relative` and `top` on the label itself to keep it centered in the visible track. Clamping logic respects parent padding for symmetric alignment.
3.  **Dynamic Spacing**:
    *   Implement `category-spacing-multiplier` for both category and subcategory labels, as well as vertical grouping spacing (base 0.5rem for gaps).
    *   Category labels use 1rem vertical / 0.5rem horizontal base padding.
    *   Subcategory labels use 0.8rem vertical / 0.4rem horizontal base padding.
4.  **Header Refinement**: Remove fixed height from `.column-header`, allowing it to wrap content with padding scaled by `vertical-spacing-multiplier`.

### Expected Outcome
The `vertical-label-container` will automatically expand its width to fit the widest part of the `.vertical-text`, ensuring that long category names or larger font sizes (due to scaling) do not cause visual regressions or overlaps. Furthermore, the overall layout density will be configurable via new spacing settings.

## Verification Plan
1.  **Visual Inspection**: Check the benchmark table to ensure category and subcategory labels are centered and the container width matches the text width plus padding.
2.  **Scaling Test**: Adjust the `--label-font-multiplier` and verify the container scales its width accordingly.
3.  **Content Test**: Inject a long category name to verify the column widens to accommodate it.
