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

    expect(gapLeft).toBe(gapRight);
});

function _setupStyleBase(): void {
    const style: HTMLStyleElement = document.createElement("style");
    style.innerHTML = `
        :root { --margin-spacing-multiplier: 1; }
        .dashboard-panel {
            position: relative; width: 62.5rem; height: 31.25rem;
            background: var(--background-1); overflow: hidden;
            display: flex; flex-direction: column;
        }
    `;
    document.head.appendChild(style);
}

function _setupStyleComplex(): void {
    const style: HTMLStyleElement = document.createElement("style");
    style.innerHTML = `
        .benchmark-table {
            flex: 1; overflow-y: scroll; padding: 0;
            margin-right: calc(2.0rem * var(--margin-spacing-multiplier));
        }
        .benchmark-table::-webkit-scrollbar { width: 0; }
        .benchmark-row { height: 3.125rem; width: 100%; background: var(--background-2); }
        .scrollbar-hole {
            position: absolute; top: 1.5rem; bottom: 1.5rem;
            right: calc(0.75rem * var(--margin-spacing-multiplier));
            width: calc(0.5rem * var(--margin-spacing-multiplier));
            background: rgba(var(--tactical-highlight-rgb), 0.1);
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
