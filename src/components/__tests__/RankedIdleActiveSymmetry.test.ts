import { expect, test } from "vitest";

/**
 * Technical Regression Test: Symmetry between Idle and Active Ranked states.
 * Verifies that the primary play button remains in the exact same pixel location.
 */
test("Ranked play button should be in the exact same location in Idle and Active states", async (): Promise<void> => {
    _setupBaseStyles();
    _setupLayoutStyles();

    // --- Phase 1: Idle State ---
    _setupIdleDOM();
    const idleBtn: Element = document.querySelector("#start-ranked-btn")!;
    const idleRect: DOMRect = idleBtn.getBoundingClientRect();
    const idleX: number = idleRect.left;
    const idleY: number = idleRect.top;

    // --- Phase 2: Active State ---
    _setupActiveDOM();
    const activeBtn: Element = document.querySelector("#ranked-play-now")!;
    const activeRect: DOMRect = activeBtn.getBoundingClientRect();
    const activeX: number = activeRect.left;
    const activeY: number = activeRect.top;

    // --- Verification ---
    // --- Verification ---
    expect(idleX).toBeCloseTo(activeX, 1);
    expect(idleY).toBeCloseTo(activeY, 1);
});

function _setupBaseStyles(): void {
    const style: HTMLStyleElement = document.createElement("style");
    style.innerHTML = `
        :root {
            --label-font-multiplier: 1;
            --vertical-spacing-multiplier: 1;
            --margin-spacing-multiplier: 1;
            --glass-border: rgba(var(--upper-band-1-rgb), 0.1);
        }
        *, *::before, *::after { box-sizing: border-box; }
        .ranked-view-container {
            width: 800px;
            height: 600px;
            display: flex;
            flex-direction: column;
            position: relative;
        }
        .ranked-stats-bar {
            display: none; /* Removed in new layout */
        }
    `;
    document.head.appendChild(style);
}

function _setupLayoutStyles(): void {
    const style: HTMLStyleElement = document.createElement("style");
    style.innerHTML = `
        .ranked-view-container {
            width: 100%; height: 15rem; display: flex;
            flex-direction: column; justify-content: space-between; align-items: center;
        }
        .ranked-selector-group, .rank-timeline-container {
            height: 6rem; display: flex; flex-direction: column;
            align-items: center; justify-content: center;
        }
        .ranked-info-top { display: flex; flex-direction: column; align-items: center; }
        .media-controls {
            display: grid; grid-template-columns: 1fr auto 1fr;
            align-items: center; gap: 1rem; width: 100%;
        }
        .media-btn { width: 2.5rem; height: 2.5rem; }
        .media-btn.primary { width: 3.75rem; height: 3.75rem; }
    `;
    document.head.appendChild(style);
}

function _setupIdleDOM(): void {
    document.body.innerHTML = `
      <div class="ranked-view-container idle">
        <div class="ranked-info-top">
            <span class="now-playing" style="visibility: hidden;">NOW PLAYING</span>
            <div class="start-screen-rank-label">Daily Ranked Run</div>
        </div>
        <div class="ranked-selector-group">
            <div class="start-screen-rank-row"></div>
            <div class="difficulty-tabs"></div>
        </div>
        <div class="media-controls">
            <div class="controls-left">
                <button class="media-btn secondary"></button>
            </div>
            <button class="media-btn primary" id="start-ranked-btn"></button>
            <div class="controls-right">
                <button class="media-btn secondary"></button>
            </div>
        </div>
      </div>



    `;
}

function _setupActiveDOM(): void {
    document.body.innerHTML = `
      <div class="ranked-view-container active">
        <div class="ranked-info-top">
            <span class="now-playing">NOW PLAYING</span>
            <h2 class="ranked-scenario-name">Scenario Name</h2>
        </div>
        <div class="rank-timeline-container"></div>
        <div class="media-controls">
            <div class="controls-left">
                <button class="media-btn secondary"></button>
            </div>
            <button class="media-btn primary" id="ranked-play-now"></button>
            <div class="controls-right">
                <button class="media-btn secondary"></button>
                <button class="media-btn secondary destructive"></button>
            </div>
        </div>
      </div>
    `;
}
