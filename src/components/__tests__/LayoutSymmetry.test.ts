import { expect, test } from 'vitest';

/**
 * Technical Regression Test: Layout Symmetry and Native Scrollbar Interference.
 * 
 * Recreates a historical bug where the native browser scrollbar (non-zero width)
 * would push the content to the left, breaking the visual symmetry between 
 * the content and the "hole-in-glass" scrollbar track.
 * 
 * Specifically, it verifies that:
 * Dist(ContentRight, HoleLeft) === Dist(HoleRight, ParentRight)
 */
test('Benchmark table layout should maintain symmetry regardless of native scrollbars', async () => {
    // Create the test environment in the browser
    document.body.innerHTML = `
        <style>
            :root {
                --margin-spacing-multiplier: 1;
                --rem-size: 16px;
            }
            .dashboard-panel {
                position: relative;
                width: 1000px;
                height: 500px;
                background: #1a1a1a;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            .benchmark-table {
                flex: 1;
                overflow-y: scroll;
                margin-right: calc(2.0rem * var(--margin-spacing-multiplier)); /* 32px */
                padding: 0;
            }
            /* The FIX: hide native scrollbar so it doesn't consume space */
            .benchmark-table::-webkit-scrollbar {
                width: 0;
            }
            .benchmark-row {
                height: 50px;
                width: 100%;
                background: #333;
            }
            .scrollbar-hole {
                position: absolute;
                top: 1.5rem;
                bottom: 1.5rem;
                right: calc(0.75rem * var(--margin-spacing-multiplier)); /* 12px */
                width: calc(0.5rem * var(--margin-spacing-multiplier));   /* 8px */
                background: rgba(255, 255, 255, 0.1);
            }
        </style>
        <div class="dashboard-panel">
            <div class="benchmark-table">
                <div class="benchmark-row"></div>
                <div style="height: 1000px;"></div> <!-- Force scroll -->
            </div>
            <div class="scrollbar-hole"></div>
        </div>
    `;

    const row = document.querySelector('.benchmark-row')!;
    const hole = document.querySelector('.scrollbar-hole')!;
    const panel = document.querySelector('.dashboard-panel')!;

    const rowRect = row.getBoundingClientRect();
    const holeRect = hole.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();

    // Gap 1: Between content (row) and the hole
    const gapLeft = holeRect.left - rowRect.right;

    // Gap 2: Between the hole and the panel edge
    const gapRight = panelRect.right - holeRect.right;

    /**
     * MATHEMATICAL DERIVATION OF EXPECTED SYMMETRY:
     * Panel Width: 1000px
     * Table Margin-Right: 32px (2.0rem)
     * Hole Right Edge: 1000 - 12px (0.75rem) = 988px
     * Hole Left Edge: 988 - 8px (0.5rem) = 980px
     * 
     * If Scrollbar Width is 0:
     *   Row Right Edge: 1000 - 32px = 968px
     *   GapLeft: 980 - 968 = 12px
     *   GapRight: 1000 - 988 = 12px
     *   Result: 12 === 12 (PASS)
     * 
     * If Scrollbar Width is, say, 17px (Bug State):
     *   Row Right Edge: 1000 - 32px - 17px = 951px
     *   GapLeft: 980 - 951 = 29px
     *   GapRight: 12px
     *   Result: 29 === 12 (FAIL)
     */

    console.log('[DEBUG] Layout Measurements:', {
        rowRight: rowRect.right,
        holeLeft: holeRect.left,
        holeRight: holeRect.right,
        panelRight: panelRect.right,
        gapLeft,
        gapRight
    });

    expect(gapLeft).toBe(gapRight);
});
