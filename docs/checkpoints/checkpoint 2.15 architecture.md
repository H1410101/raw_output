# Checkpoint 2.15 Architecture: Visual Tuning Refinement

This checkpoint focuses on refining the rank progress display to provide meaningful feedback even after a user has surpassed the highest defined rank threshold.

## Rank Scaling Logic

To provide feedback for performance that exceeds the highest defined rank, we implement a scaling mechanism based on the "ladder" gap established by the final two ranks.

### Beyond-Rank Percentage Calculation

1.  **Identify the Gap**: Retrieve the score thresholds for the highest rank ($T_{max}$) and the second-highest rank ($T_{max-1}$).
2.  **Calculate the Interval**: The interval ($I$) is defined as $T_{max} - T_{max-1}$.
3.  **Calculate Offset**: Determine how far the current score ($S$) is above the highest threshold: $O = S - T_{max}$.
4.  **Calculate Progress**: The total progress percentage ($P$) becomes:
    $$P = \left( \frac{O}{I} \right) \times 100$$

This ensures that:
- A score exactly at the highest threshold shows **+0%**.
- A score exactly one "rank-width" above the highest rank shows **+100%**.
- A score exactly two "rank-widths" above shows **+200%**.

## Implementation Plan

### `RankService.ts`
- Modify `_handleHighestRankReached` to use the clarified formula.
- Instead of starting at 100%, the progress will represent the relative distance beyond the final threshold.
- `_calculateBeyondMaxProgress` will calculate the interval between the last and second-to-last thresholds (falling back to the threshold itself if only one exists).
- Logic remains grouped in short, self-explanatory methods to comply with project style rules.

### `BenchmarkRowRenderer.ts`
- No changes required. It already consumes the `progressPercentage` from the `RankResult` and renders it using the `+x%` template.

## Verification
- **Zero Offset Test**: Set a score exactly at the highest threshold; verify it shows `+0%`.
- **Scaling Test**: Set a score above the highest threshold by exactly the gap amount; verify it shows `+100%`.
- **Large Scaling Test**: Set a score above the highest threshold by twice the gap amount; verify it shows `+200%`.
- **Session Best consistency**: Ensure session-best badges reflect the same logic when they exceed the highest rank.
