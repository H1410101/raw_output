import { expect, test } from "vitest";

/**
 * Technical Regression Test: Layout Symmetry and Native Scrollbar Interference.
 */
test("Benchmark table layout should maintain symmetry regardless of native scrollbars", async (): Promise<void> => {
    _setupStyleBase();
    _setupStyleComplex();
    _setupDOM();

    const row: Element = document.querySelector(".benchmark-row")!;
    const hole: Element = document.querySelector(".scrollbar-hole")!;
    const panel: Element = document.querySelector(".dashboard-panel")!;

    const rowRect: DOMRect = row.getBoundingClientRect();
    const holeRect: DOMRect = hole.getBoundingClientRect();
    const panelRect: DOMRect = panel.getBoundingClientRect();

    const gapLeft: number = holeRect.left - rowRect.right;
    const gapRight: number = panelRect.right - holeRect.right;

    expect(gapLeft).toBeGreaterThanOrEqual(0);
    expect(gapRight).toBeGreaterThanOrEqual(0);
    expect(Math.abs(gapLeft - gapRight)).toBeLessThanOrEqual(2);
});

function _setupStyleBase(): void {
    const style: HTMLStyleElement = document.createElement("style");
    style.innerHTML = `
        :root { --margin-spacing-multiplier: 1; }
        html { font-size: 16px !important; }
        .dashboard-panel {
            position: relative !important; 
            width: 62.5rem !important; 
            height: 31.25rem !important;
            background: var(--background-1) !important; 
            overflow: hidden !important;
            display: flex !important; 
            flex-direction: column !important;
            inset: unset !important;
            padding: 0 !important;
        }
    `;
    document.head.appendChild(style);
}

function _setupStyleComplex(): void {
    const style: HTMLStyleElement = document.createElement("style");
    style.innerHTML = `
        .benchmark-table {
            flex: 1 !important; 
            overflow-y: scroll !important; 
            padding: 0 !important;
            margin-right: calc(2.0rem * var(--margin-spacing-multiplier)) !important;
        }
        .benchmark-table::-webkit-scrollbar { width: 0 !important; }
        .benchmark-row { 
            height: 3.125rem !important; 
            width: 100% !important; 
            background: var(--background-2) !important; 
        }
        .scrollbar-hole {
            position: absolute !important; 
            top: 1.5rem !important; 
            bottom: 1.5rem !important;
            right: calc(0.75rem * var(--margin-spacing-multiplier)) !important;
            width: calc(0.5rem * var(--margin-spacing-multiplier)) !important;
            background: rgba(var(--tactical-highlight-rgb), 0.1) !important;
        }
    `;
    document.head.appendChild(style);
}

function _setupDOM(): void {
    document.body.innerHTML = `
        <div class="dashboard-panel">
            <div class="benchmark-table">
                <div class="benchmark-row"></div>
                <div style="height: 62.5rem;"></div>
            </div>
            <div class="scrollbar-hole"></div>
        </div>
    `;
}
